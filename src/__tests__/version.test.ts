/**
 * Tests for the runtime package version (MCP serverInfo.version).
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SERVER_VERSION } from '../version.js'

describe('SERVER_VERSION', () => {
  it('matches the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    expect(SERVER_VERSION).toBe(pkg.version)
  })

  it('is not hardcoded in server.ts', () => {
    const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8')
    expect(server).toMatch(/version:\s*SERVER_VERSION/)
  })
})
