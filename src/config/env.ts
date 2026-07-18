// Central place the app reads its runtime config from. Values come from
// Vite's import.meta.env, which is populated from .env / .env.local at
// dev-server start or build time — see README.md "Configuration".

function requireEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const apiBaseUrl = requireEnv('VITE_API_BASE_URL')
