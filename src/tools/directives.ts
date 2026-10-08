/**
 * pd_list + pd_get + pd_create + pd_update + pd_delete + pd_toggle + directive_export
 *
 * Project Directives management tools for the Nexus platform.
 * Directives are short binding rules (ADR-0125): a platform catalog (mandatory,
 * flag, default, optional rules) plus project rules. Each rule is one imperative
 * sentence; the optional rationale is stored for humans and never sent to agents.
 * The backend still accepts the legacy title/body/priority fields as aliases.
 * Delegates to POST /api/mcp/directives.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function errorResult(result: { error: string | null }) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: result.error }, null, 2),
      },
    ],
    isError: true,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function okResult(data: any) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(data, null, 2) },
    ],
  }
}

// ---------------------------------------------------------------------------
// pd_list
// ---------------------------------------------------------------------------

export const pdListSchema = {
  project_id: z
    .string()
    .uuid()
    .optional()
    .describe('Project UUID (falls back to NEXUS_PROJECT_ID env var when omitted)'),
  enabled: z
    .boolean()
    .optional()
    .describe('Filter by enabled status'),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe('Maximum results to return'),
}

type PdListArgs = {
  project_id: string
  enabled?: boolean
  limit?: number
  user_id: string
}

export async function pdList(args: PdListArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_list',
    project_id: args.project_id,
    enabled: args.enabled,
    limit: args.limit ?? 50,
  })

  if (!result.ok) return errorResult(result)
  return okResult(result.data)
}

// ---------------------------------------------------------------------------
// pd_get
// ---------------------------------------------------------------------------

export const pdGetSchema = {
  directive_id: z
    .string()
    .uuid()
    .describe('Directive UUID'),
}

type PdGetArgs = {
  directive_id: string
  user_id: string
}

export async function pdGet(args: PdGetArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_get',
    directive_id: args.directive_id,
  })

  if (!result.ok) return errorResult(result)
  return okResult(result.data)
}

// ---------------------------------------------------------------------------
// Directive rule fields (ADR-0125)
// ---------------------------------------------------------------------------

export const DIRECTIVE_LEVELS = ['must', 'should'] as const

export const DIRECTIVE_CATEGORIES = [
  'commits',
  'language',
  'docs',
  'security',
  'workflow',
  'operations',
  'communication',
] as const

export const DIRECTIVE_RULE_MAX = 240
export const DIRECTIVE_RATIONALE_MAX = 2000

const ruleField = z
  .string()
  .min(1)
  .max(DIRECTIVE_RULE_MAX)
  .describe(
    'The rule: one imperative sentence, at most 240 characters; put background into rationale. Always rendered to agents.',
  )

const rationaleField = z
  .string()
  .max(DIRECTIVE_RATIONALE_MAX)
  .describe('Why the rule exists (at most 2000 characters). Stored for humans, never sent to agents.')

const levelField = z
  .enum(DIRECTIVE_LEVELS)
  .describe('Binding level: must (hard rule) or should (strong default)')

const categoryField = z
  .enum(DIRECTIVE_CATEGORIES)
  .describe('Rule category')

const sortOrderField = z
  .number()
  .int()
  .describe('Position within the rendered rule list (ascending)')

const deprecatedTitleField = z
  .string()
  .max(DIRECTIVE_RULE_MAX)
  .describe('Deprecated alias for rule; use rule instead')

const deprecatedBodyField = z
  .string()
  .max(DIRECTIVE_RATIONALE_MAX)
  .describe('Deprecated alias for rationale; use rationale instead')

const deprecatedPriorityField = z
  .enum(['low', 'medium', 'high'])
  .describe('Deprecated: use level instead (high maps to must, anything else to should)')

// ---------------------------------------------------------------------------
// pd_create
// ---------------------------------------------------------------------------

export const pdCreateSchema = {
  project_id: z
    .string()
    .uuid()
    .optional()
    .describe('Project UUID (falls back to NEXUS_PROJECT_ID env var when omitted)'),
  rule: ruleField.optional(),
  rationale: rationaleField.optional(),
  level: levelField.optional(),
  category: categoryField.optional(),
  sort_order: sortOrderField.optional(),
  enabled: z
    .boolean()
    .optional()
    .describe('Whether the directive is enabled (default: true)'),
  template_slug: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Add a default or optional rule from the platform directive catalog instead of writing your own. Do not combine with rule fields.',
    ),
  template_id: z
    .string()
    .uuid()
    .optional()
    .describe('Catalog rule UUID; alternative to template_slug'),
  title: deprecatedTitleField.optional(),
  body: deprecatedBodyField.optional(),
  priority: deprecatedPriorityField.optional(),
}

type PdCreateArgs = {
  project_id: string
  rule?: string
  rationale?: string
  level?: string
  category?: string
  sort_order?: number
  enabled?: boolean
  template_slug?: string
  template_id?: string
  title?: string
  body?: string
  priority?: string
  user_id: string
}

export async function pdCreate(args: PdCreateArgs) {
  const isTemplateRef = args.template_slug !== undefined || args.template_id !== undefined
  const ruleFields = [
    'rule', 'rationale', 'level', 'category', 'sort_order', 'title', 'body', 'priority',
  ] as const
  const sentRuleFields = ruleFields.filter((key) => args[key] !== undefined)

  if (isTemplateRef && sentRuleFields.length > 0) {
    return errorResult({
      error: `A catalog reference (template_slug/template_id) accepts only enabled; remove: ${sentRuleFields.join(', ')}`,
    })
  }
  if (!isTemplateRef && args.rule === undefined && args.title === undefined) {
    return errorResult({
      error: 'Provide either rule (one imperative sentence) or template_slug/template_id of a catalog rule',
    })
  }

  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_create',
    project_id: args.project_id,
    rule: args.rule,
    rationale: args.rationale,
    level: args.level,
    category: args.category,
    sort_order: args.sort_order,
    enabled: args.enabled,
    template_slug: args.template_slug,
    template_id: args.template_id,
    title: args.title,
    body: args.body,
    priority: args.priority,
  })

  if (!result.ok) return errorResult(result)
  return okResult(result.data)
}

// ---------------------------------------------------------------------------
// pd_update
// ---------------------------------------------------------------------------

export const pdUpdateSchema = {
  directive_id: z
    .string()
    .uuid()
    .describe('Directive UUID'),
  rule: ruleField.optional(),
  rationale: rationaleField.optional(),
  level: levelField.optional(),
  category: categoryField.optional(),
  sort_order: sortOrderField.optional(),
  enabled: z
    .boolean()
    .optional()
    .describe('Updated enabled state (the only field accepted for catalog references)'),
  title: deprecatedTitleField.optional(),
  body: deprecatedBodyField.optional(),
  priority: deprecatedPriorityField.optional(),
}

type PdUpdateArgs = {
  directive_id: string
  rule?: string
  rationale?: string
  level?: string
  category?: string
  sort_order?: number
  enabled?: boolean
  title?: string
  body?: string
  priority?: string
  user_id: string
}

export async function pdUpdate(args: PdUpdateArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_update',
    directive_id: args.directive_id,
    rule: args.rule,
    rationale: args.rationale,
    level: args.level,
    category: args.category,
    sort_order: args.sort_order,
    enabled: args.enabled,
    title: args.title,
    body: args.body,
    priority: args.priority,
  })

  if (!result.ok) return errorResult(result)
  return okResult(result.data)
}

// ---------------------------------------------------------------------------
// pd_delete
// ---------------------------------------------------------------------------

export const pdDeleteSchema = {
  directive_id: z
    .string()
    .uuid()
    .describe('Directive UUID to delete'),
}

type PdDeleteArgs = {
  directive_id: string
  user_id: string
}

export async function pdDelete(args: PdDeleteArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_delete',
    directive_id: args.directive_id,
  })

  if (!result.ok) return errorResult(result)
  return okResult(result.data)
}

// ---------------------------------------------------------------------------
// pd_toggle
// ---------------------------------------------------------------------------

export const pdToggleSchema = {
  directive_id: z
    .string()
    .uuid()
    .describe('Directive UUID to toggle'),
  enabled: z
    .boolean()
    .optional()
    .describe('Explicit enabled state (omit to invert current)'),
}

type PdToggleArgs = {
  directive_id: string
  enabled?: boolean
  user_id: string
}

export async function pdToggle(args: PdToggleArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_toggle',
    directive_id: args.directive_id,
    enabled: args.enabled,
  })

  if (!result.ok) return errorResult(result)
  return okResult(result.data)
}

// ---------------------------------------------------------------------------
// directive_export
// ---------------------------------------------------------------------------

export const directiveExportSchema = {
  project_id: z
    .string()
    .uuid()
    .optional()
    .describe('Project UUID (falls back to NEXUS_PROJECT_ID env var when omitted)'),
}

type DirectiveExportArgs = {
  project_id: string
  user_id: string
}

export async function directiveExport(args: DirectiveExportArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'directive_export',
    project_id: args.project_id,
  })

  if (!result.ok) return errorResult(result)
  return okResult(result.data)
}
