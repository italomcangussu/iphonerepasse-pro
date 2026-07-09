/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_RAPID_API_KEY: string
  // Account-level UAZAPI server, used to default a new channel's subdomain.
  // Provide either the bare subdomain or a full server URL.
  readonly VITE_UAZ_SUBDOMAIN?: string
  readonly VITE_UAZAPI_SERVER_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
