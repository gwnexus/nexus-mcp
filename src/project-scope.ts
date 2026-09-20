/**
 * Server-side project scope resolution.
 *
 * Tools that operate on a specific project accept an optional `project_id`
 * argument. When the caller omits it, we fall back to the `NEXUS_PROJECT_ID`
 * environment variable (populated by the CLI from the workspace binding).
 *
 * This is defense-in-depth against agents silently guessing or omitting a
 * project scope: if neither an explicit argument nor the environment
 * fallback is available, we fail loudly instead of proceeding unscoped.
 */

export class MissingProjectIdError extends Error {
  constructor() {
    super(
      'Missing project_id: no project_id argument was provided and ' +
        'NEXUS_PROJECT_ID is not set in the environment. Refusing to ' +
        'proceed without an explicit project scope.',
    )
    this.name = 'MissingProjectIdError'
  }
}

/**
 * Resolve a project_id from an explicit argument, falling back to
 * process.env.NEXUS_PROJECT_ID. Throws MissingProjectIdError if neither
 * is available.
 */
export function resolveProjectId(explicit?: string | null): string {
  if (explicit) return explicit
  const fallback = process.env.NEXUS_PROJECT_ID
  if (fallback) return fallback
  throw new MissingProjectIdError()
}

/**
 * Wrap a tool handler whose schema declares an optional `project_id` field.
 * Resolves the project scope via NEXUS_PROJECT_ID before the handler runs.
 *
 * Only wrap tools whose schema actually declares a `project_id` parameter --
 * this helper always injects a resolved value, regardless of whether the
 * caller's args object included the key at all. MCP clients commonly omit
 * optional parameters entirely (no key present) rather than sending them as
 * `undefined`, so checking for key presence would miss the common case and
 * defeat the fallback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withProjectFallback(handler: (args: any) => Promise<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (args: any) => {
    const base = args && typeof args === 'object' ? args : {}
    return handler({
      ...base,
      project_id: resolveProjectId(base.project_id),
    })
  }
}
