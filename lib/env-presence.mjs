const KEYS = [
  "GA4_PROPERTY_ID",
  "GOOGLE_SERVICE_ACCOUNT_PROJECT_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "EXPO_ACCESS_TOKEN",
  "EXPO_ACCOUNT",
  "EXPO_PROJECT_SLUG",
  "AUTH_SUPABASE_URL",
  "AUTH_SUPABASE_ANON_KEY",
  "DATA_SUPABASE_URL",
  "DATA_SUPABASE_ANON_KEY",
  "DATA_SUPABASE_SCHEMA",
  "DATA_SUPABASE_SERVICE_ROLE_KEY",
];

export function envPresence(env = process.env, keys = KEYS) {
  return Object.fromEntries(keys.map((key) => [key, Boolean(String(env[key] || "").trim())]));
}
