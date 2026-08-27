const DEFAULT_ACCOUNT = "quartavia";
const DEFAULT_SLUG = "pharus";

function trimEnv(value) {
  return String(value || "").trim();
}

export function getExpoToken() {
  return trimEnv(process.env.EXPO_ACCESS_TOKEN || process.env.EXPO_TOKEN);
}

export function getExpoConfig() {
  const account = trimEnv(process.env.EXPO_ACCOUNT) || DEFAULT_ACCOUNT;
  const slug = trimEnv(process.env.EXPO_PROJECT_SLUG) || DEFAULT_SLUG;
  return {
    account,
    slug,
    fullName: `@${account}/${slug}`,
  };
}

export function getConfiguredProjectId() {
  return trimEnv(process.env.EXPO_PROJECT_ID) || null;
}
