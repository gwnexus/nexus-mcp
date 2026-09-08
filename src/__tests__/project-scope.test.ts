/**
 * Tests for src/project-scope.ts
 *
 * Covers:
 * - resolveProjectId prefers an explicit value over the environment fallback
 * - resolveProjectId falls back to NEXUS_PROJECT_ID when omitted
 * - resolveProjectId throws MissingProjectIdError when neither is available
 * - withProjectFallback only touches args that declare a project_id key
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  MissingProjectIdError,
  resolveProjectId,
  withProjectFallback,
} from '../project-scope.js'

const ENV_PROJECT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const EXPLICIT_PROJECT_ID = '11111111-2222-4333-8444-555555555555'

describe('resolveProjectId', () => {
  const originalEnv = process.env.NEXUS_PROJECT_ID

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXUS_PROJECT_ID
    else process.env.NEXUS_PROJECT_ID = originalEnv
  })

  it('prefers the explicit project_id over the environment fallback', () => {
    process.env.NEXUS_PROJECT_ID = ENV_PROJECT_ID
    expect(resolveProjectId(EXPLICIT_PROJECT_ID)).toBe(EXPLICIT_PROJECT_ID)
  })

  it('falls back to NEXUS_PROJECT_ID when explicit value is omitted', () => {
    process.env.NEXUS_PROJECT_ID = ENV_PROJECT_ID
    expect(resolveProjectId(undefined)).toBe(ENV_PROJECT_ID)
  })

  it('falls back to NEXUS_PROJECT_ID when explicit value is empty string', () => {
    process.env.NEXUS_PROJECT_ID = ENV_PROJECT_ID
    expect(resolveProjectId('')).toBe(ENV_PROJECT_ID)
  })

  it('throws MissingProjectIdError when neither is available', () => {
    delete process.env.NEXUS_PROJECT_ID
    expect(() => resolveProjectId(undefined)).toThrow(MissingProjectIdError)
  })

  it('throws a descriptive error message', () => {
    delete process.env.NEXUS_PROJECT_ID
    expect(() => resolveProjectId(undefined)).toThrow(/NEXUS_PROJECT_ID/)
  })
})

describe('withProjectFallback', () => {
  const originalEnv = process.env.NEXUS_PROJECT_ID

  beforeEach(() => {
    process.env.NEXUS_PROJECT_ID = ENV_PROJECT_ID
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.NEXUS_PROJECT_ID
    else process.env.NEXUS_PROJECT_ID = originalEnv
  })

  it('injects the env fallback when project_id key is present but undefined', async () => {
    const handler = async (args: Record<string, unknown>) => args
    const wrapped = withProjectFallback(handler)

    const result = await wrapped({ project_id: undefined, title: 'x' })
    expect(result.project_id).toBe(ENV_PROJECT_ID)
  })

  it('leaves an explicit project_id untouched', async () => {
    const handler = async (args: Record<string, unknown>) => args
    const wrapped = withProjectFallback(handler)

    const result = await wrapped({ project_id: EXPLICIT_PROJECT_ID })
    expect(result.project_id).toBe(EXPLICIT_PROJECT_ID)
  })

  it('does not touch args without a project_id key at all', async () => {
    const handler = async (args: Record<string, unknown>) => args
    const wrapped = withProjectFallback(handler)

    delete process.env.NEXUS_PROJECT_ID
    const result = await wrapped({ task_id: 'some-task' })
    expect(result).toEqual({ task_id: 'some-task' })
  })

  it('throws when project_id key is present, undefined, and no env fallback exists', async () => {
    delete process.env.NEXUS_PROJECT_ID
    const handler = async (args: Record<string, unknown>) => args
    const wrapped = withProjectFallback(handler)

    await expect(wrapped({ project_id: undefined })).rejects.toThrow(
      MissingProjectIdError,
    )
  })
})
