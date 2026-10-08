/**
 * Tests for the project directive tools (ADR-0125 short directive rules).
 *
 * Covers:
 *   - pd_create / pd_update input schemas: rule length, level + category enums,
 *     no legacy `general` category, deprecated aliases still accepted
 *   - pd_create: project rule vs. catalog reference (template_slug / template_id)
 *   - pd_update: passthrough of new fields, catalog-reference errors from the backend
 *   - pd_list: effective list passthrough
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'
import {
  DIRECTIVE_CATEGORIES,
  pdCreate,
  pdCreateSchema,
  pdList,
  pdUpdate,
  pdUpdateSchema,
} from '../tools/directives.js'

const directiveId = 'ccccdddd-eeee-4fff-8000-111122223333'
const templateId = 'ddddeeee-ffff-4000-8111-222233334444'

const createInput = z.object(pdCreateSchema)
const updateInput = z.object(pdUpdateSchema)

// Descriptions as MCP clients receive them (JSON schema of the tool input)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jsonDocs = (schema: z.ZodRawShape): Record<string, string> => {
  const props = (z.toJSONSchema(z.object(schema)) as any).properties
  return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, (v as any).description]))
}
const createDocs = jsonDocs(pdCreateSchema)
const updateDocs = jsonDocs(pdUpdateSchema)

describe('pd_create / pd_update schemas', () => {
  it('accepts a project rule with the new fields', () => {
    const parsed = createInput.safeParse({
      rule: 'Write commit messages in English.',
      rationale: 'The repository is public.',
      level: 'must',
      category: 'commits',
      sort_order: 10,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a rule longer than 240 characters', () => {
    expect(createInput.safeParse({ rule: 'x'.repeat(241) }).success).toBe(false)
    expect(createInput.safeParse({ rule: 'x'.repeat(240) }).success).toBe(true)
  })

  it('rejects a rationale longer than 2000 characters', () => {
    expect(createInput.safeParse({ rule: 'r', rationale: 'x'.repeat(2001) }).success).toBe(false)
  })

  it('restricts category to the ADR-0125 enum (no legacy general)', () => {
    expect(DIRECTIVE_CATEGORIES).toEqual([
      'commits', 'language', 'docs', 'security', 'workflow', 'operations', 'communication',
    ])
    expect(createInput.safeParse({ rule: 'r', category: 'general' }).success).toBe(false)
    expect(updateInput.safeParse({ directive_id: directiveId, category: 'general' }).success).toBe(false)
  })

  it('restricts level to must | should', () => {
    expect(createInput.safeParse({ rule: 'r', level: 'should' }).success).toBe(true)
    expect(createInput.safeParse({ rule: 'r', level: 'may' }).success).toBe(false)
  })

  it('requires an integer sort_order', () => {
    expect(createInput.safeParse({ rule: 'r', sort_order: 1.5 }).success).toBe(false)
  })

  it('does not inject a default category or priority', () => {
    const parsed = createInput.parse({ rule: 'r' })
    expect(parsed.category).toBeUndefined()
    expect(parsed.priority).toBeUndefined()
    expect(parsed.level).toBeUndefined()
  })

  it('still accepts the deprecated aliases and marks them as deprecated', () => {
    expect(createInput.safeParse({ title: 'Old style', body: 'b', priority: 'high' }).success).toBe(true)
    expect(createDocs.title).toMatch(/deprecated/i)
    expect(createDocs.body).toMatch(/deprecated/i)
    expect(createDocs.priority).toMatch(/deprecated/i)
    expect(updateDocs.title).toMatch(/deprecated/i)
  })

  it('describes rule as one imperative sentence and template_slug as catalog reference', () => {
    expect(createDocs.rule).toContain('one imperative sentence, at most 240 characters')
    expect(createDocs.rule).toContain('rationale')
    expect(createDocs.template_slug).toContain(
      'Add a default or optional rule from the platform directive catalog instead of writing your own',
    )
  })
})

describe('pdCreate', () => {
  beforeEach(() => {
    vi.mocked(nexusPost).mockReset()
  })

  it('forwards a project rule with the new fields', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ action: 'pd_create', id: directiveId, source: 'project' }),
    )

    const result = await pdCreate({
      project_id: TEST_IDS.projectId,
      rule: 'Write commit messages in English.',
      rationale: 'The repository is public.',
      level: 'must',
      category: 'commits',
      sort_order: 10,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    expect(parseToolResponse(result).source).toBe('project')
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith('/api/mcp/directives', {
      action: 'pd_create',
      project_id: TEST_IDS.projectId,
      rule: 'Write commit messages in English.',
      rationale: 'The repository is public.',
      level: 'must',
      category: 'commits',
      sort_order: 10,
      enabled: undefined,
      template_slug: undefined,
      template_id: undefined,
      title: undefined,
      body: undefined,
      priority: undefined,
    })
  })

  it('forwards a catalog reference by template_slug', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({ action: 'pd_create', id: directiveId, source: 'template' }),
    )

    const result = await pdCreate({
      project_id: TEST_IDS.projectId,
      template_slug: 'english-commit-messages',
      enabled: true,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/directives',
      expect.objectContaining({
        action: 'pd_create',
        template_slug: 'english-commit-messages',
        enabled: true,
        rule: undefined,
      }),
    )
  })

  it('forwards a catalog reference by template_id', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiSuccess({ action: 'pd_create', id: directiveId }))

    await pdCreate({ project_id: TEST_IDS.projectId, template_id: templateId, user_id: TEST_IDS.userId })

    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/directives',
      expect.objectContaining({ template_id: templateId }),
    )
  })

  it('still forwards the deprecated title/body/priority aliases', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiSuccess({ action: 'pd_create', id: directiveId }))

    const result = await pdCreate({
      project_id: TEST_IDS.projectId,
      title: 'Old style rule',
      body: 'Background',
      priority: 'high',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/directives',
      expect.objectContaining({ title: 'Old style rule', body: 'Background', priority: 'high' }),
    )
  })

  it('rejects a catalog reference combined with rule fields without calling the API', async () => {
    const result = await pdCreate({
      project_id: TEST_IDS.projectId,
      template_slug: 'english-commit-messages',
      rule: 'Something else.',
      level: 'must',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    expect(parseToolResponse(result).error).toContain('rule, level')
    expect(vi.mocked(nexusPost)).not.toHaveBeenCalled()
  })

  it('rejects a call with neither rule nor catalog reference without calling the API', async () => {
    const result = await pdCreate({
      project_id: TEST_IDS.projectId,
      category: 'docs',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    expect(parseToolResponse(result).error).toContain('template_slug')
    expect(vi.mocked(nexusPost)).not.toHaveBeenCalled()
  })

  it('passes backend conflicts through (409: catalog rule already in project)', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Catalog rule already added to project', 409))

    const result = await pdCreate({
      project_id: TEST_IDS.projectId,
      template_slug: 'english-commit-messages',
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBe(true)
    expect(parseToolResponse(result).error).toContain('already added')
  })
})

describe('pdUpdate', () => {
  beforeEach(() => {
    vi.mocked(nexusPost).mockReset()
  })

  it('forwards the new fields', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiSuccess({ action: 'pd_update', id: directiveId }))

    const result = await pdUpdate({
      directive_id: directiveId,
      rule: 'Keep PRs under 400 changed lines.',
      level: 'should',
      category: 'workflow',
      sort_order: 5,
      user_id: TEST_IDS.userId,
    })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/directives',
      expect.objectContaining({
        action: 'pd_update',
        directive_id: directiveId,
        rule: 'Keep PRs under 400 changed lines.',
        level: 'should',
        category: 'workflow',
        sort_order: 5,
      }),
    )
  })

  it('passes backend 422 for rule fields on a catalog reference through', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Catalog references accept only enabled', 422),
    )

    const result = await pdUpdate({ directive_id: directiveId, rule: 'x', user_id: TEST_IDS.userId })

    expect(result.isError).toBe(true)
  })
})

describe('pdList', () => {
  beforeEach(() => {
    vi.mocked(nexusPost).mockReset()
  })

  it('returns the effective list with source information', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'pd_list',
        directives: [
          { id: directiveId, source: 'mandatory', rule: 'Never commit secrets.', level: 'must', category: 'security' },
          { id: templateId, source: 'flag', flag_key: 'english_only', rule: 'Write in English.', level: 'must' },
        ],
      }),
    )

    const result = await pdList({ project_id: TEST_IDS.projectId, user_id: TEST_IDS.userId })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.directives.map((d: { source: string }) => d.source)).toEqual(['mandatory', 'flag'])
  })
})
