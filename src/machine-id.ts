/**
 * Machine ID module for Nexus MCP server.
 *
 * Reads or generates a persistent machine identifier stored at
 * ~/.config/nexus/machine.toml. This ID is sent as X-Nexus-Machine-Id
 * header with every API request so session entries can be attributed
 * to a specific machine.
 *
 * Format of machine.toml:
 *   machine_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const CONFIG_DIR = join(homedir(), '.config', 'nexus')
const MACHINE_TOML = join(CONFIG_DIR, 'machine.toml')

let _cachedId: string | null = null

/**
 * Get the persistent machine ID, creating one if it doesn't exist.
 * Returns null only if file I/O fails (e.g. read-only filesystem).
 */
export function getMachineId(): string | null {
  if (_cachedId) return _cachedId

  try {
    // Try to read existing
    if (existsSync(MACHINE_TOML)) {
      const content = readFileSync(MACHINE_TOML, 'utf-8')
      const match = content.match(/machine_id\s*=\s*"([^"]+)"/)
      if (match?.[1]) {
        _cachedId = match[1]
        return _cachedId
      }
    }

    // Generate new machine ID
    const id = randomUUID()
    mkdirSync(CONFIG_DIR, { recursive: true })
    writeFileSync(
      MACHINE_TOML,
      `# Nexus persistent machine identifier\n# Generated automatically — do not edit\nmachine_id = "${id}"\n`,
      'utf-8',
    )
    _cachedId = id
    return _cachedId
  } catch {
    // Silently fail — machine_id is optional enrichment
    return null
  }
}

/** Reset cached machine ID (for testing). */
export function resetMachineId(): void {
  _cachedId = null
}
