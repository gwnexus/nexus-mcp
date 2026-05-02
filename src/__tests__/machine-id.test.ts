/**
 * Tests for src/machine-id.ts
 *
 * Covers:
 * - Reading existing machine.toml
 * - Generating new machine ID when file doesn't exist
 * - Caching behavior
 * - Graceful failure on I/O errors
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// Mock fs and os modules
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}))

const EXPECTED_TOML_PATH = join('/mock-home', '.config', 'nexus', 'machine.toml')

describe('machine-id', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    vi.mocked(homedir).mockReturnValue('/mock-home')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should read machine_id from existing machine.toml', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(
      '# Nexus persistent machine identifier\nmachine_id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"\n',
    )

    const { getMachineId, resetMachineId } = await import('../machine-id.js')
    resetMachineId()
    const id = getMachineId()

    expect(id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(existsSync).toHaveBeenCalledWith(EXPECTED_TOML_PATH)
    expect(readFileSync).toHaveBeenCalledWith(EXPECTED_TOML_PATH, 'utf-8')
  })

  it('should generate and persist machine_id when file does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const { getMachineId, resetMachineId } = await import('../machine-id.js')
    resetMachineId()
    const id = getMachineId()

    expect(id).toBeDefined()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(mkdirSync).toHaveBeenCalledWith(
      join('/mock-home', '.config', 'nexus'),
      { recursive: true },
    )
    expect(writeFileSync).toHaveBeenCalledWith(
      EXPECTED_TOML_PATH,
      expect.stringContaining(`machine_id = "${id}"`),
      'utf-8',
    )
  })

  it('should cache the machine_id after first read', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue('machine_id = "cached-id-1234"\n')

    const { getMachineId, resetMachineId } = await import('../machine-id.js')
    resetMachineId()

    const callsBefore = vi.mocked(readFileSync).mock.calls.length
    const id1 = getMachineId()
    const id2 = getMachineId()

    expect(id1).toBe('cached-id-1234')
    expect(id1).toBe(id2)
    // readFileSync should only be called once more after reset (cached on second call)
    expect(vi.mocked(readFileSync).mock.calls.length - callsBefore).toBe(1)
  })

  it('should return null on I/O error', async () => {
    vi.mocked(existsSync).mockImplementation(() => {
      throw new Error('Permission denied')
    })

    const { getMachineId, resetMachineId } = await import('../machine-id.js')
    resetMachineId()
    const id = getMachineId()

    expect(id).toBeNull()
  })

  it('should generate new ID if toml exists but has no machine_id line', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue('# empty config\n')

    const { getMachineId, resetMachineId } = await import('../machine-id.js')
    resetMachineId()
    const id = getMachineId()

    expect(id).toBeDefined()
    expect(id).toMatch(/^[0-9a-f]{8}-/)
    expect(writeFileSync).toHaveBeenCalled()
  })

  it('should resetMachineId clear the cache', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync)
      .mockReturnValueOnce('machine_id = "first-id"\n')
      .mockReturnValueOnce('machine_id = "second-id"\n')

    const { getMachineId, resetMachineId } = await import('../machine-id.js')
    resetMachineId()

    const id1 = getMachineId()
    expect(id1).toBe('first-id')

    resetMachineId()
    const id2 = getMachineId()
    expect(id2).toBe('second-id')

    expect(id1).not.toBe(id2)
  })
})
