/**
 * Supabase client for MCP server context.
 *
 * Uses the service role key since MCP operations are authenticated
 * via API keys (nxs_pat_*) rather than browser cookies.
 * The MCP layer resolves user_id and agent_id from the API key
 * and applies permission checks at the application level.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getServiceClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'MCP: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _client
}
