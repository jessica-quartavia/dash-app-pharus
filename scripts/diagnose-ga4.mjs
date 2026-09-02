import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectEnv } from "../lib/load-env.mjs";
import { resolveGa4Config, safeGa4Error } from "../lib/firebase-analytics/config.mjs";
import {
  APP_EVENT_NAMES,
  GA4_METRICS,
  WEB_EVENT_NAMES,
  createGa4DataClient,
  queryGa4Usage,
} from "../lib/firebase-analytics/usage.mjs";

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

function printMetric(name, result) {
  if (!result || result.supported === false) {
    console.log(`${name}: unavailable${result?.error ? ` (${result.error})` : ""}`);
    return;
  }
  console.log(`${name}: ${result.value ?? "no rows"}`);
}

function formatSeconds(value) {
  if (value == null || !Number.isFinite(Number(value))) return "unavailable";
  const total = Math.round(Number(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) return `${hours}h ${minutes}min ${seconds}s (${total}s)`;
  if (minutes) return `${minutes}min ${seconds}s (${total}s)`;
  return `${seconds}s`;
}

async function queryWindow(client, property, metric, startDate, endDate) {
  try {
    const [response] = await client.runReport({
      property,
      dateRanges: [{ startDate, endDate }],
      metrics: [{ name: metric }],
    });
    const raw = response?.rows?.[0]?.metricValues?.[0]?.value;
    const value = Number(raw);
    return { supported: true, value: Number.isFinite(value) ? value : null };
  } catch (error) {
    return { supported: false, value: null, error: safeGa4Error(error) };
  }
}

async function probeRetention(client, property) {
  try {
    await client.runReport({
      property,
      dimensions: [{ name: "cohort" }, { name: "cohortNthDay" }],
      metrics: [{ name: "cohortActiveUsers" }],
      cohortSpec: {
        cohorts: [{
          name: "cohort",
          dimension: "firstSessionDate",
          dateRange: { startDate: "28daysAgo", endDate: "21daysAgo" },
        }],
        cohortsRange: { granularity: "DAILY", startOffset: 0, endOffset: 7 },
      },
    });
    return {
      available: false,
      probed: true,
      message: "Retenção: indisponível pela integração atual",
      reason: "A API de coorte existe, mas não é um equivalente simples e direto da retenção do painel Firebase.",
    };
  } catch (error) {
    return {
      available: false,
      probed: true,
      message: "Retenção: indisponível pela integração atual",
      reason: safeGa4Error(error),
    };
  }
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
    const client = createGa4DataClient({ ...config, clientOptions: { ...config.clientOptions, scopes: [READONLY_SCOPE] } });
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
    let basicError = null;
    let usage = null;
    if (oauthGenerated) {
      try {
        usage = await queryGa4Usage({ startDate: undefined, endDate: undefined }, { config, client, force: true, includeSamples: true });
      } catch (error) {
        basicError = error;
        usage = null;
      }
    }
    const classified = basicError ? errorDetails(basicError) : null;
    const authorized = Boolean(usage?.available);
    const latestDailyValue = usage?.dailySummary?.lastValue ?? null;

    console.log("");
    console.log("PROPERTY");
    console.log(`property id: ${propertyId}`);
    console.log(`Data API reachable: ${authorized || classified?.dataApiReachable || false}`);
    console.log(`Property authorization: ${authorized ? "OK" : classified?.classification === "PROPERTY_PERMISSION_DENIED" ? "DENIED" : "UNKNOWN"}`);
    if (basicError) console.log(`Error: ${safeGa4Error(basicError)}`);
    if (usage?.userMessage && !authorized) console.log(`Usage error: ${usage.userMessage}`);

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
      const metricResults = usage.metricResults || {};
      console.log("");
      console.log("METRICS");
      for (const name of GA4_METRICS) printMetric(name, metricResults[name]);

      const windows = {
        "activeUsers today": await queryWindow(client, property, "activeUsers", "today", "today"),
        "activeUsers yesterday": await queryWindow(client, property, "activeUsers", "yesterday", "yesterday"),
        "activeUsers 7d window": await queryWindow(client, property, "activeUsers", "6daysAgo", "today"),
        "activeUsers 28d window": await queryWindow(client, property, "activeUsers", "27daysAgo", "today"),
        "activeUsers 30d window": await queryWindow(client, property, "activeUsers", "29daysAgo", "today"),
      };
      console.log("");
      console.log("WINDOWS (activeUsers by date range, not summed daily)");
      for (const [label, result] of Object.entries(windows)) printMetric(label, result);

      const daily = usage.dailySummary || {};
      console.log("");
      console.log("DAILY");
      console.log(`First date: ${daily.firstDate || "unavailable"}`);
      console.log(`Last date: ${daily.lastDate || "unavailable"}`);
      console.log(`Min: ${daily.min ?? "unavailable"}`);
      console.log(`Max: ${daily.max ?? "unavailable"}`);
      console.log(`Last value: ${daily.lastValue ?? "unavailable"}`);
      console.log(`Points: ${daily.points ?? 0}`);

      const platforms = usage.classification || {};
      console.log("");
      console.log("PLATFORM");
      console.log(`WEB = ${platforms.WEB ?? "unavailable"}`);
      console.log(`ANDROID = ${platforms.ANDROID ?? "unavailable"}`);
      console.log(`IOS = ${platforms.IOS ?? "unavailable"}`);
      if (platforms.other?.length) {
        for (const item of platforms.other) console.log(`${item.platform} = ${item.activeUsers}`);
      }
      console.log(`Property type: ${String(platforms.kind || "unknown").toUpperCase()}`);

      console.log("");
      console.log("VERSIONS");
      for (const item of (usage.versionRows || []).slice(0, 15)) {
        console.log(`${item.version} | ${item.platform || "(not set)"} | ${item.activeUsers}`);
      }
      if (!usage.versionRows?.length) console.log("No appVersion rows returned.");

      console.log("");
      console.log("EVENTS");
      for (const item of usage.events || []) {
        console.log(`${item.name}: ${item.count} [${item.class}]`);
      }
      const hasWebEvents = (usage.events || []).some((item) => WEB_EVENT_NAMES.includes(item.name));
      const hasAppEvents = (usage.events || []).some((item) => APP_EVENT_NAMES.includes(item.name));
      console.log(`Typical web events: ${hasWebEvents}`);
      console.log(`Typical app events: ${hasAppEvents}`);

      const engagement = usage.engagement || {};
      console.log("");
      console.log("ENGAGEMENT");
      console.log(`sessionsPerUser: ${engagement.sessionsPerUser ?? "unavailable"}`);
      console.log(`averageSessionDuration: ${formatSeconds(engagement.averageSessionDuration)}`);
      console.log(`userEngagementDuration: ${formatSeconds(engagement.userEngagementDuration)}`);
      console.log(`average engagement per active user: ${formatSeconds(engagement.averageEngagementPerActiveUser)}`);
      console.log(`average engagement source: ${engagement.averageEngagementPerActiveUserSource || "unavailable"}`);

      const retention = await probeRetention(client, property);
      console.log("");
      console.log("RETENTION");
      console.log(retention.message);
      console.log(`Reason: ${retention.reason}`);

      const identification = usage.userId || {};
      console.log("");
      console.log("IDENTIFICATION");
      console.log(`userId available: ${Boolean(identification.available)}`);
      console.log(`possible Supabase relationship: ${Boolean(identification.possibleSupabaseRelationship)}`);
      console.log(`Field: ${identification.field || "none"}`);
      console.log(`Origin: ${identification.origin || "none"}`);
      console.log(`Distinct in sample: ${identification.distinctInSample || 0}`);
      console.log(`UUID-like sample: ${Boolean(identification.uuidLike)}`);
      if (identification.candidates?.length) {
        console.log(`Candidates probed: ${identification.candidates.map((item) => item.apiName).join(", ")}`);
      }
      if (identification.maskedSamples?.length) console.log(`Samples (masked): ${identification.maskedSamples.join(", ")}`);
      console.log(identification.note || "");

      console.log("");
      console.log("SUMMARY");
      console.log(`PROPERTY ${propertyId}`);
      console.log(`METRICS activeUsers 1d=${metricResults.active1DayUsers?.value ?? "unavailable"} 7d=${metricResults.active7DayUsers?.value ?? "unavailable"} 28d=${metricResults.active28DayUsers?.value ?? "unavailable"}`);
      console.log(`NOTE 1d/7d/28d use official snapshot metrics on the last day of the range, not summed daily users.`);
      console.log(`METRICS sessions=${metricResults.sessions?.value ?? "unavailable"} newUsers=${metricResults.newUsers?.value ?? "unavailable"} events=${metricResults.eventCount?.value ?? "unavailable"} sessionsPerUser=${metricResults.sessionsPerUser?.value ?? "unavailable"}`);
      console.log(`METRICS engagement=${formatSeconds(engagement.averageEngagementPerActiveUser)}`);
      console.log(`PLATFORM WEB=${platforms.WEB ?? "unavailable"} ANDROID=${platforms.ANDROID ?? "unavailable"} IOS=${platforms.IOS ?? "unavailable"}`);
      console.log(`VERSIONS ${(usage.versionRows || []).slice(0, 8).map((item) => `${item.version}/${item.platform}`).join(", ") || "none"}`);
      console.log(`EVENTS ${(usage.events || []).slice(0, 8).map((item) => item.name).join(", ") || "none"}`);
      console.log(`IDENTIFICATION userId available=${Boolean(identification.available)} possible Supabase relationship=${Boolean(identification.possibleSupabaseRelationship)}`);
      console.log(`Latest daily value: ${latestDailyValue ?? "unavailable"}`);
    }
    await client.close();
  }
}
