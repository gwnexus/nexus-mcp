/**
 * MCP Authentication Layer
 *
 * Resolves the NEXUS_PRIVATE_TOKEN environment variable at server startup
 * to a verified user identity. This identity is injected into all tool
 * calls instead of accepting user_id as a parameter from the caller.
 *
 * Flow:
 *   1. Read NEXUS_PRIVATE_TOKEN from process.env
 *   2. Validate nxs_pat_* prefix
 *   3. SHA-256 hash -> look up in api_keys table (service client)
 *   4. Check revocation + expiry
 *   5. Load user profile + platform admin status
 *   6. Cache resolved identity for the lifetime of the MCP process
 *
 * Pattern adapted from GWShield Hub (api-auth.ts) for stdio MCP context.
 */

import crypto from 'crypto'
import { getServiceClient } from './db.js'

const API_TOKEN_PREFIX = 'nxs_pat_'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpIdentity {
  userId: string
  email: string | null
  displayName: string | null
  isPlatformAdmin: boolean
  isPlatformOwner: boolean
}

// Module-level cache: resolved once at startup
let _identity: McpIdentity | null = null

// ---------------------------------------------------------------------------
// Token resolution (internal)
// ---------------------------------------------------------------------------

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex')
}

async function resolveToken(rawToken: string): Promise<McpIdentity | null> {
  if (!rawToken.startsWith(API_TOKEN_PREFIX)) {
    console.error(
      '[nexus-mcp] Token does not start with expected prefix (nxs_pat_)',
    )
    return null
  }

  const keyHash = hashToken(rawToken)
  const db = getServiceClient()

  // Look up by hash
  const { data: keyRow, error: keyError } = await db
    .from('api_keys')
    .select('id, user_id, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .single()

  if (keyError || !keyRow) {
    console.error('[nexus-mcp] Token not found in api_keys')
    return null
  }

  // Check revocation
  if (keyRow.revoked_at !== null) {
    console.error('[nexus-mcp] Token has been revoked')
    return null
  }

  // Check expiry
  if (keyRow.expires_at !== null) {
    if (new Date(keyRow.expires_at) <= new Date()) {
      console.error('[nexus-mcp] Token has expired')
      return null
    }
  }

  const userId = keyRow.user_id

  // Load profile
  const { data: profile } = await db
    .from('profiles')
    .select('display_name')
    .eq('user_id', userId)
    .single()

  // Load auth user for platform admin check
  const {
    data: { user: authUser },
  } = await db.auth.admin.getUserById(userId)

  const platformRole = authUser?.app_metadata?.platform_role as
    | string
    | undefined
  const isPlatformOwner = platformRole === 'platform_owner'
  const isPlatformAdmin =
    platformRole === 'platform_admin' || platformRole === 'platform_owner'

  // Update last_used_at (fire-and-forget)
  void Promise.resolve(
    db
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id),
  ).catch(() => {})

  return {
    userId,
    email: authUser?.email ?? null,
    displayName: profile?.display_name ?? null,
    isPlatformAdmin,
    isPlatformOwner,
  }
}

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

  const identity = await resolveToken(rawToken.trim())
  if (!identity) {
    throw new Error(
      'MCP: NEXUS_PRIVATE_TOKEN could not be resolved. Check that the token is valid, not expired, and not revoked.',
    )
  }

  _identity = identity
  console.error(
    `[nexus-mcp] Identity resolved: ${identity.displayName ?? identity.email ?? identity.userId} (admin=${identity.isPlatformAdmin}, owner=${identity.isPlatformOwner})`,
  )

  return identity
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

/**
 * Validate that an agent_id is registered for a given project.
 * Returns the project_agents row if found, null otherwise.
 */
export async function validateProjectAgent(
  projectId: string,
  agentId: string,
): Promise<{ id: string; agent_id: string; agent_owner: string } | null> {
  const db = getServiceClient()

  const { data, error } = await db
    .from('project_agents')
    .select('id, agent_id, agent_owner')
    .eq('project_id', projectId)
    .eq('agent_id', agentId)
    .single()

  if (error || !data) return null
  return data as { id: string; agent_id: string; agent_owner: string }
}

/**
 * Check if the resolved identity has membership in a project.
 * Returns the membership role or null if not a member.
 * Platform admins bypass this check.
 */
export async function checkProjectAccess(
  projectId: string,
): Promise<string | null> {
  const identity = getIdentity()

  // Platform admins have access to everything
  if (identity.isPlatformAdmin) return 'platform_admin'

  const db = getServiceClient()
  const { data } = await db
    .from('project_memberships')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', identity.userId)
    .single()

  return data?.role ?? null
}
