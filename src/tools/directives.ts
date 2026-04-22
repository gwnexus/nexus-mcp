/**
 * pd_list + pd_get + pd_create + pd_update + pd_delete + pd_toggle + directive_export
 *
 * Project Directives management tools for the Nexus platform.
 * Directives are project-scoped rules/policies that guide agent behavior.
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
    .describe('Project UUID'),
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
// pd_create
// ---------------------------------------------------------------------------

export const pdCreateSchema = {
  project_id: z
    .string()
    .uuid()
    .describe('Project UUID'),
  title: z
    .string()
    .max(500)
    .describe('Directive title'),
  body: z
    .string()
    .max(10000)
    .optional()
    .describe('Directive body (markdown)'),
  category: z
    .string()
    .max(100)
    .default('general')
    .describe('Directive category (e.g. general, security, deployment)'),
  priority: z
    .enum(['low', 'medium', 'high'])
    .default('medium')
    .describe('Directive priority'),
  enabled: z
    .boolean()
    .default(true)
    .describe('Whether the directive is enabled'),
}

type PdCreateArgs = {
  project_id: string
  title: string
  body?: string
  category?: string
  priority?: string
  enabled?: boolean
  user_id: string
}

export async function pdCreate(args: PdCreateArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_create',
    project_id: args.project_id,
    title: args.title,
    body: args.body,
    category: args.category ?? 'general',
    priority: args.priority ?? 'medium',
    enabled: args.enabled !== false,
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
  title: z
    .string()
    .max(500)
    .optional()
    .describe('Updated title'),
  body: z
    .string()
    .max(10000)
    .optional()
    .describe('Updated body (markdown)'),
  category: z
    .string()
    .max(100)
    .optional()
    .describe('Updated category'),
  priority: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe('Updated priority'),
  enabled: z
    .boolean()
    .optional()
    .describe('Updated enabled state'),
}

type PdUpdateArgs = {
  directive_id: string
  title?: string
  body?: string
  category?: string
  priority?: string
  enabled?: boolean
  user_id: string
}

export async function pdUpdate(args: PdUpdateArgs) {
  const result = await nexusPost('/api/mcp/directives', {
    action: 'pd_update',
    directive_id: args.directive_id,
    title: args.title,
    body: args.body,
    category: args.category,
    priority: args.priority,
    enabled: args.enabled,
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
    .describe('Project UUID'),
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
