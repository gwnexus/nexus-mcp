/**
 * Package version, read from package.json at runtime so the MCP serverInfo
 * always matches the published release (dist/ and src/ both sit one level
 * below the package root).
 */

import { readFileSync } from 'node:fs'

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

export const SERVER_VERSION: string = pkg.version
