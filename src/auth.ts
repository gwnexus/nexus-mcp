/**
 * MCP Authentication Layer
 *
 * Resolves the NEXUS_PRIVATE_TOKEN environment variable at server startup
 * to a verified user identity by calling the Nexus API identity endpoint.
 *
 * Flow:
 *   1. Read NEXUS_PRIVATE_TOKEN from process.env
 *   2. Call GET /api/mcp/identity with Bearer token
 *   3. Cache resolved identity for the lifetime of the MCP process
 */

import { nexusGet } from './nexus-api.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpIdentity {
  userId: string
  email: string | null
  displayName: string | null
  isPlatformAdmin: boolean
  isPlatformOwner: boolean
  tenantId: string | null
  memberships: Array<{ project_id: string; role: string }>
  agentAssignments: Array<{
    project_id: string
    agent_id: string
    agent_owner: string
  }>
}

// Module-level cache: resolved once at startup
let _identity: McpIdentity | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the MCP server identity from NEXUS_PRIVATE_TOKEN.
 * Called once at server startup. Caches the result.
 * Throws if no valid token is available.
 */
export async function initIdentity(): Promise<McpIdentity> {
  if (_identity) return _identity

  const rawToken = process.env.NEXUS_PRIVATE_TOKEN
  if (!rawToken) {
    throw new Error(
      'MCP: NEXUS_PRIVATE_TOKEN is not set. The MCP server requires a valid nxs_pat_* token.',
    )
  }

  const result = await nexusGet<McpIdentity>('/api/mcp/identity')

  if (!result.ok || !result.data) {
    throw new Error(
      `MCP: Identity resolution failed: ${result.error ?? 'Unknown error'}. Check that the token is valid, not expired, and not revoked.`,
    )
  }

  _identity = result.data

  console.error(
    `[nexus-mcp] Identity resolved: ${_identity.displayName ?? _identity.email ?? _identity.userId} (admin=${_identity.isPlatformAdmin}, owner=${_identity.isPlatformOwner})`,
  )

  return _identity
}

/**
 * Get the cached MCP identity. Must call initIdentity() first.
 */
export function getIdentity(): McpIdentity {
  if (!_identity) {
    throw new Error('MCP: Identity not initialized. Call initIdentity() first.')
  }
  return _identity
}
