/**
 * Nexus API client for MCP server context.
 *
 * Replaces direct Supabase access with HTTP calls to the Nexus API.
 * All operations go through /api/mcp/* endpoints, authenticated
 * via the NEXUS_PRIVATE_TOKEN (nxs_pat_*) Bearer token.
 */

import { hostname } from 'node:os'
import { getMachineId } from './machine-id.js'

let _baseUrl: string | null = null
let _token: string | null = null
let _machineId: string | null = null
let _machineName: string | null = null
let _model: string | null = null
let _toolstack: string | null = null

// Eagerly resolve machine ID and hostname (sync, cached after first call)
try {
  _machineId = getMachineId()
} catch {
  // machine_id is optional enrichment — never block startup
}
try {
  _machineName = hostname()
} catch {
  // hostname is optional enrichment
}
// Model + toolstack from environment (optional — enriches session entries)
_model = process.env.NEXUS_MODEL ?? null
_toolstack = process.env.NEXUS_TOOLSTACK ?? null

/**
 * Reset the cached API configuration. Used by E2E tests to switch
 * from mocked env vars to real credentials.
 */
export function resetApiConfig(): void {
  _baseUrl = null
  _token = null
  _machineId = getMachineId()
  _model = process.env.NEXUS_MODEL ?? null
  _toolstack = process.env.NEXUS_TOOLSTACK ?? null
}

function getConfig(): { baseUrl: string; token: string } {
  if (_baseUrl && _token) return { baseUrl: _baseUrl, token: _token }

  const url = process.env.NEXUS_API_URL ?? process.env.NEXUS_URL
  const token = process.env.NEXUS_PRIVATE_TOKEN

  if (!url) {
    throw new Error(
      'MCP: Missing NEXUS_API_URL. Set the base URL of the Nexus app (e.g. https://nexus.gatewarden.eu).',
    )
  }
  if (!token) {
    throw new Error(
      'MCP: Missing NEXUS_PRIVATE_TOKEN. The MCP server requires a valid nxs_pat_* token.',
    )
  }

  // Normalize: strip trailing slash
  _baseUrl = url.replace(/\/$/, '')
  _token = token.trim()

  return { baseUrl: _baseUrl!, token: _token! }
}

export interface NexusApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

/** Default HTTP timeout in milliseconds (30 seconds). */
const DEFAULT_TIMEOUT_MS = 30_000

/** Maximum length of a response body snippet included in error messages. */
const BODY_SNIPPET_MAX = 200

/**
 * Build a short, single-line body snippet for error messages.
 * Collapses whitespace and redacts anything that looks like a token.
 */
function bodySnippet(text: string): string {
  const flat = text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/nxs_pat_[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
  return flat.length > BODY_SNIPPET_MAX ? `${flat.slice(0, BODY_SNIPPET_MAX)}...` : flat
}

/**
 * Build the error message for a non-OK response. Prefers the JSON `error`
 * field (with `ref` when present), otherwise falls back to the HTTP status
 * line plus a sanitized body snippet.
 */
function httpErrorMessage(response: Response, text: string, json: unknown): string {
  const body = json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  if (typeof body?.error === 'string') {
    return typeof body.ref === 'string' ? `${body.error} (ref: ${body.ref})` : body.error
  }
  const statusLine = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
  const snippet = bodySnippet(text)
  return snippet ? `${statusLine}: ${snippet}` : statusLine
}

/**
 * Make an authenticated request to the Nexus API.
 */
export async function nexusApi<T = unknown>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    headers?: Record<string, string>
    timeoutMs?: number
  } = {},
): Promise<NexusApiResponse<T>> {
  const { baseUrl, token } = getConfig()
  const method = options.method ?? 'GET'
  const url = `${baseUrl}${path}`

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(_machineId ? { 'X-Nexus-Machine-Id': _machineId } : {}),
    ...(_machineName ? { 'X-Nexus-Machine-Name': _machineName } : {}),
    ...(_model ? { 'X-Nexus-Model': _model } : {}),
    ...(_toolstack ? { 'X-Nexus-Toolstack': _toolstack } : {}),
    ...(options.headers ?? {}),
  }

  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  }
  if (options.body !== undefined) {
    fetchOpts.body = JSON.stringify(options.body)
  }

  let response: Response
  let text: string
  try {
    response = await fetch(url, fetchOpts)
    text = await response.text()
  } catch (err) {
    // Network errors and timeouts only: no HTTP status is available.
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Unknown fetch error',
    }
  }

  let json: unknown = null
  let parseFailed = false
  if (text.trim()) {
    try {
      json = JSON.parse(text)
    } catch {
      parseFailed = true
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: httpErrorMessage(response, text, json),
    }
  }

  if (parseFailed) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: `Invalid JSON response (HTTP ${response.status})`,
    }
  }

  return { ok: true, status: response.status, data: json as T, error: null }
}

/**
 * Convenience: POST to a Nexus MCP endpoint.
 */
export async function nexusPost<T = unknown>(
  path: string,
  body: unknown,
): Promise<NexusApiResponse<T>> {
  return nexusApi<T>(path, { method: 'POST', body })
}

/**
 * Convenience: GET from a Nexus MCP endpoint.
 */
export async function nexusGet<T = unknown>(
  path: string,
): Promise<NexusApiResponse<T>> {
  return nexusApi<T>(path, { method: 'GET' })
}
