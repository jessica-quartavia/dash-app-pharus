import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { resolveGa4Config, safeGa4Error } from "../lib/firebase-analytics/config.mjs";

const EXPECTED_PROJECT_ID = "pharus-app";
const EXPECTED_CLIENT_EMAIL = "firebase-adminsdk-fbsvc@pharus-app.iam.gserviceaccount.com";
const READONLY_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function loaded(name) {
  return Boolean(String(process.env[name] || "").trim());
}

function errorDetails(error) {
  const code = Number(error?.code);
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();
  if (
    normalized.includes("invalid_grant") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("jwt signature") ||
    normalized.includes("unauthorized_client")
  ) {
    return { classification: "AUTHENTICATION_FAILED", dataApiReachable: false };
  }
  if (
    normalized.includes("analyticsdata.googleapis.com") &&
    (normalized.includes("disabled") || normalized.includes("has not been used") || normalized.includes("service_disabled"))
  ) {
    return { classification: "API_DISABLED", dataApiReachable: true };
  }
  if (code === 7 && (normalized.includes("sufficient permissions") || normalized.includes("permission_denied"))) {
    return { classification: "PROPERTY_PERMISSION_DENIED", dataApiReachable: true };
  }
  if (code === 5 || normalized.includes("not found")) {
    return { classification: "PROPERTY_NOT_FOUND", dataApiReachable: true };
  }
  if (code === 14 || normalized.includes("no connection established")) {
    return { classification: "CONNECTION_UNAVAILABLE", dataApiReachable: false };
  }
  return { classification: "API_ERROR", dataApiReachable: code > 0 && code !== 14 };
}

function numberValue(response) {
  const raw = response?.rows?.[0]?.metricValues?.[0]?.value;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function rows(response, dimensions, metric) {
  return (response?.rows || []).map((row) => {
    const item = {};
    dimensions.forEach((name, index) => {
      item[name] = row.dimensionValues?.[index]?.value || "(not set)";
    });
    const value = Number(row.metricValues?.[0]?.value);
    item[metric] = Number.isFinite(value) ? value : null;
    return item;
  });
}

function masked(value) {
  const text = String(value || "");
  if (text.length < 9) return "[masked]";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

async function runReport(client, property, request) {
  const [response] = await client.runReport({ property, ...request });
  return response;
}

loadProjectEnv(root);
const configuredPropertyId = String(process.env.GA4_PROPERTY_ID || "").trim();
const propertyIdValid = /^\d+$/.test(configuredPropertyId);
let remote = "unavailable";
try {
  remote = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" }).trim();
} catch {
  // Git metadata is informative and does not affect the API diagnosis.
}
console.log("PROJECT");
console.log(`Path: ${root}`);
console.log(`Remote: ${remote}`);
console.log(`GA4 Property configured: ${configuredPropertyId || "unavailable"}`);
console.log("");
console.log("CREDENTIAL");
for (const name of ["GA4_PROPERTY_ID", "GOOGLE_SERVICE_ACCOUNT_PROJECT_ID", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_APPLICATION_CREDENTIALS"]) {
  console.log(`${name} loaded: ${loaded(name)}`);
}

const credentialPath = resolve(root, String(process.env.GOOGLE_APPLICATION_CREDENTIALS || ""));
const credentialFileExists = loaded("GOOGLE_APPLICATION_CREDENTIALS") && existsSync(credentialPath);
console.log(`Credential file exists: ${credentialFileExists}`);

let credential;
try {
  credential = credentialFileExists ? JSON.parse(readFileSync(credentialPath, "utf8")) : null;
} catch {
  credential = null;
}
const credentialJsonValid = Boolean(
  credential &&
  credential.type === "service_account" &&
  credential.project_id === EXPECTED_PROJECT_ID &&
  credential.client_email === EXPECTED_CLIENT_EMAIL &&
  String(credential.private_key || "").trim(),
);
console.log(`Credential JSON valid: ${credentialJsonValid}`);
console.log(`Service account: ${credential?.client_email || "unavailable"}`);
console.log(`Project: ${credential?.project_id || "unavailable"}`);

if (!credentialJsonValid) {
  console.log("Credential validation stopped: expected service account identity did not match.");
  process.exitCode = 1;
} else {
  const config = resolveGa4Config(process.env, { cwd: root });
  const propertyId = configuredPropertyId;
  if (!propertyIdValid) {
    console.log("Configuration valid: false (GA4_PROPERTY_ID must be non-empty and contain only numbers)");
    process.exitCode = 1;
  } else if (!config.ok) {
    console.log(`Configuration valid: false (${config.errorCode || "invalid configuration"})`);
    process.exitCode = 1;
  } else {
    const client = new BetaAnalyticsDataClient({ ...config.clientOptions, scopes: [READONLY_SCOPE] });
    let oauthGenerated = false;
    let oauthError = null;
    try {
      const authClient = await client.auth.getClient();
      const accessToken = await authClient.getAccessToken();
      oauthGenerated = Boolean(typeof accessToken === "string" ? accessToken : accessToken?.token);
    } catch (error) {
      oauthError = error;
    }

    console.log("");
    console.log("AUTH");
    console.log(`OAuth readonly token generated: ${oauthGenerated}`);
    console.log(`Google authentication: ${oauthGenerated ? "OK" : "FAILED"}`);
    if (oauthError) console.log(`Authentication error: ${safeGa4Error(oauthError)}`);

    const property = `properties/${propertyId}`;
    let basicResponse = null;
    let basicError = null;
    if (oauthGenerated) {
      try {
        basicResponse = await runReport(client, property, {
          dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [{ name: "activeUsers" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        });
      } catch (error) {
        basicError = error;
      }
    }
    const classified = basicError ? errorDetails(basicError) : null;
    const authorized = Boolean(basicResponse);
    const basicRows = basicResponse?.rows || [];
    const latestDailyValue = basicRows.length ? Number(basicRows.at(-1)?.metricValues?.[0]?.value) : null;

    console.log("");
    console.log("GA4");
    console.log(`Data API reachable: ${authorized || classified?.dataApiReachable || false}`);
    console.log(`Property: ${propertyId}`);
    console.log(`Property authorization: ${authorized ? "OK" : classified?.classification === "PROPERTY_PERMISSION_DENIED" ? "DENIED" : "UNKNOWN"}`);
    console.log("");
    console.log("BASIC REPORT");
    console.log(`Request sent: ${oauthGenerated}`);
    console.log(`Response received: ${authorized}`);
    console.log(`activeUsers: ${authorized ? "OK" : "ERROR"}`);
    console.log(`Rows: ${basicRows.length}`);
    console.log(`Latest daily value: ${authorized && Number.isFinite(latestDailyValue) ? latestDailyValue : "unavailable"}`);
    console.log(`Error classification: ${classified?.classification || "none"}`);
    if (basicError) console.log(`Error: ${safeGa4Error(basicError)}`);

    if (!authorized) {
      console.log("");
      console.log("NEXT ACTION");
      if (classified?.classification === "PROPERTY_PERMISSION_DENIED") {
        console.log(`Add ${credential.client_email} as Viewer on GA4 property ${propertyId}.`);
      }
      console.log("");
      console.log("METRICS / PLATFORM / VERSIONS / EVENTS / IDENTIFICATION");
      console.log("Skipped because the minimum activeUsers report was not authorized.");
    } else {
      const metricNames = ["activeUsers", "active1DayUsers", "active7DayUsers", "active28DayUsers", "sessions", "newUsers", "eventCount", "engagedSessions", "userEngagementDuration"];
      const metricResults = {};
      for (const metric of metricNames) {
        try {
          const response = await runReport(client, property, {
            dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
            metrics: [{ name: metric }],
          });
          metricResults[metric] = { supported: true, value: numberValue(response) };
        } catch (error) {
          metricResults[metric] = { supported: false, value: null, error: safeGa4Error(error) };
        }
      }
      console.log("");
      console.log("METRICS");
      for (const [name, result] of Object.entries(metricResults)) {
        console.log(`${name}: ${result.supported ? result.value ?? "no rows" : `unavailable (${result.error})`}`);
      }

      const daily = rows(basicResponse, ["date"], "activeUsers");
      console.log("");
      console.log("DAILY");
      console.log(`First date: ${daily[0]?.date || "unavailable"}`);
      console.log(`Last date: ${daily.at(-1)?.date || "unavailable"}`);
      console.log(`Points: ${daily.length}`);

      const platformResponse = await runReport(client, property, {
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "platform" }], metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      });
      const platforms = rows(platformResponse, ["platform"], "activeUsers");
      console.log("");
      console.log("PLATFORM");
      for (const item of platforms) console.log(`${item.platform}: ${item.activeUsers}`);

      const versionsResponse = await runReport(client, property, {
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "appVersion" }, { name: "platform" }], metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 10,
      });
      const versionRows = rows(versionsResponse, ["appVersion", "platform"], "activeUsers");
      console.log("");
      console.log("VERSIONS");
      for (const item of versionRows) console.log(`${item.appVersion} | ${item.platform} | ${item.activeUsers}`);

      const eventsResponse = await runReport(client, property, {
        dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }], limit: 20,
      });
      const eventRows = rows(eventsResponse, ["eventName"], "eventCount");
      console.log("");
      console.log("EVENTS");
      for (const item of eventRows) console.log(`${item.eventName}: ${item.eventCount}`);

      const webEvents = new Set(["page_view", "scroll", "click", "form_start", "form_submit", "view_search_results"]);
      const appEvents = new Set(["screen_view", "app_open", "app_update", "app_remove", "first_open", "in_app_purchase", "notification_open"]);
      const hasWebPlatform = platforms.some((item) => item.platform.toUpperCase() === "WEB" && item.activeUsers > 0);
      const hasMobilePlatform = platforms.some((item) => ["ANDROID", "IOS"].includes(item.platform.toUpperCase()) && item.activeUsers > 0);
      const hasAppVersion = versionRows.some((item) => ["ANDROID", "IOS"].includes(item.platform.toUpperCase()) && !["", "(not set)"].includes(item.appVersion));
      const hasWebEvents = eventRows.some((item) => webEvents.has(item.eventName));
      const hasAppEvents = eventRows.some((item) => appEvents.has(item.eventName));
      const propertyType = hasWebPlatform && hasMobilePlatform ? "mixed" : hasMobilePlatform ? "mobile" : "web";
      console.log("");
      console.log("CLASSIFICATION");
      console.log(`Typical web events: ${hasWebEvents}`);
      console.log(`Typical app events: ${hasAppEvents}`);
      console.log(`Property type: ${propertyType}`);
      console.log(`App versions confirmed: ${hasAppVersion}`);
      console.log(`Can feed App Usage: ${hasMobilePlatform && hasAppVersion}`);
      console.log(`Recommended GA4 section: ${hasMobilePlatform && hasAppVersion ? "App Usage" : "Pharus Web Usage"}`);

      const [metadata] = await client.getMetadata({ name: `${property}/metadata` });
      const idCandidates = (metadata.dimensions || []).filter((item) => {
        const text = `${item.apiName || ""} ${item.uiName || ""} ${item.description || ""}`.toLowerCase();
        return /user.?id|uuid|supabase/.test(text) && item.apiName !== "signedInWithUserId";
      });
      let idEvidence = null;
      for (const candidate of idCandidates) {
        try {
          const sampleResponse = await runReport(client, property, {
            dateRanges: [{ startDate: "28daysAgo", endDate: "today" }], dimensions: [{ name: candidate.apiName }], metrics: [{ name: "activeUsers" }], limit: 5,
          });
          const samples = rows(sampleResponse, [candidate.apiName], "activeUsers").map((item) => item[candidate.apiName]).filter((value) => value && value !== "(not set)");
          if (samples.length) {
            idEvidence = { candidate, samples };
            break;
          }
        } catch {
          // A metadata candidate may not be compatible with activeUsers.
        }
      }
      console.log("");
      console.log("IDENTIFICATION");
      console.log(`GA4 userId available: ${Boolean(idEvidence)}`);
      console.log(`Possible Supabase relationship: ${Boolean(idEvidence?.samples.some(looksLikeUuid))}`);
      if (idEvidence) {
        console.log(`Field: ${idEvidence.candidate.apiName}`);
        console.log(`Samples (masked): ${idEvidence.samples.map(masked).join(", ")}`);
        console.log(`UUID-like sample: ${idEvidence.samples.some(looksLikeUuid)}`);
      } else {
        console.log("No real identifier compatible with auth.users.id was confirmed. signedInWithUserId is only a boolean indicator.");
      }
    }
    await client.close();
  }
}
