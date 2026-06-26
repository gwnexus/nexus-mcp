/**
 * Nexus Dispatch Tools — ADR-0052
 *
 * dispatch_create, dispatch_reply, dispatch_inbox, dispatch_outbox,
 * dispatch_ack, dispatch_assign, dispatch_forward, dispatch_resolve,
 * dispatch_close, dispatch_sweep, dispatch_get, dispatch_related
 *
 * Legacy vl_* tools are thin wrappers at the bottom of this file.
 * All tools delegate to POST /api/mcp/dispatches.
 */

import { z } from 'zod'
import { nexusPost } from '../nexus-api.js'

// ── Shared schemas ────────────────────────────────────────────────────────────

const DISPATCH_TYPES = ['question', 'bug_report', 'implementation_request',
  'review_request', 'decision_notice', 'blocker', 'status_update', 'handover'] as const

const DISPATCH_STATUSES = ['open', 'acknowledged', 'in_progress', 'waiting_for_requester',
  'blocked', 'needs_review', 'resolved', 'closed', 'cancelled'] as const

const DISPATCH_MESSAGE_TYPES = ['reply', 'clarification', 'progress', 'resolution',
  'blocker', 'review_note', 'context', 'system_note'] as const

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function err(error: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ error }, null, 2) }], isError: true }
}

async function dispatch(action: string, args: Record<string, unknown>) {
  const result = await nexusPost('/api/mcp/dispatches', { action, ...args })
  if (!result.ok) return err(result.error)
  return ok(result.data)
}

// ── dispatch_create ───────────────────────────────────────────────────────────

export const dispatchCreateSchema = {
  project_id: z.string().uuid()
    .describe('Sender project UUID — the project the calling agent belongs to'),
  to_project_id: z.string().uuid().optional()
    .describe('Target/recipient project UUID (optional — can be resolved from to_actor)'),
  to_actor: z.string().max(200).optional()
    .describe('Recipient actor slug or UUID'),
  title: z.string().max(500)
    .describe('Dispatch title — short, actionable description of the request'),
  body: z.string().max(100_000)
    .describe('Initial message body (Markdown supported)'),
  type: z.enum(DISPATCH_TYPES).default('question')
    .describe('Dispatch type'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
    .describe('Priority'),
  blocking: z.boolean().default(false)
    .describe('Whether this Dispatch blocks the sender'),
  due_at: z.string().optional()
    .describe('Optional due date (ISO 8601)'),
  agent_id: z.string().max(200).optional()
    .describe('Agent identifier of the calling agent'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchCreate(args: any) {
  return dispatch('dispatch_create', args as Record<string, unknown>)
}

// ── dispatch_reply ────────────────────────────────────────────────────────────

export const dispatchReplySchema = {
  dispatch_id: z.string().uuid()
    .describe('Dispatch UUID to reply to'),
  body: z.string().max(100_000)
    .describe('Reply body (Markdown supported)'),
  message_type: z.enum(DISPATCH_MESSAGE_TYPES).optional()
    .describe('Type of message being appended'),
  status: z.enum(DISPATCH_STATUSES).optional()
    .describe('Optionally update the Dispatch status (must follow allowed transitions)'),
  agent_id: z.string().max(200).optional()
    .describe('Agent identifier of the replying agent'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchReply(args: any) {
  return dispatch('dispatch_reply', args as Record<string, unknown>)
}

// ── dispatch_inbox ────────────────────────────────────────────────────────────

export const dispatchInboxSchema = {
  project_id: z.string().uuid()
    .describe('Project UUID — returns Dispatches addressed to this project'),
  scope: z.enum(['project', 'blocking', 'waiting_on_me', 'cross_project', 'watching']).optional()
    .describe('Filter scope (default: project)'),
  status_filter: z.array(z.string()).optional()
    .describe('Filter by status (default: open, acknowledged, in_progress, waiting_for_requester, blocked, needs_review)'),
  include_closed: z.boolean().optional()
    .describe('Include closed/cancelled Dispatches (default: false)'),
  limit: z.number().int().min(1).max(50).optional()
    .describe('Max results (default: 20)'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchInbox(args: any) {
  return dispatch('dispatch_inbox', args)
}

// ── dispatch_outbox ───────────────────────────────────────────────────────────

export const dispatchOutboxSchema = {
  project_id: z.string().uuid()
    .describe('Project UUID — returns Dispatches created by this project'),
  status_filter: z.array(z.string()).optional()
    .describe('Filter by status (default: all non-closed)'),
  limit: z.number().int().min(1).max(50).optional()
    .describe('Max results (default: 20)'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchOutbox(args: any) {
  return dispatch('dispatch_outbox', args)
}

// ── dispatch_ack ──────────────────────────────────────────────────────────────

export const dispatchAckSchema = {
  dispatch_id: z.string().uuid()
    .describe('Dispatch UUID to acknowledge (must be in open status)'),
  agent_id: z.string().max(200).optional()
    .describe('Agent identifier'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchAck(args: any) {
  return dispatch('dispatch_ack', args)
}

// ── dispatch_assign ───────────────────────────────────────────────────────────

export const dispatchAssignSchema = {
  dispatch_id: z.string().uuid()
    .describe('Dispatch UUID to (re-)assign'),
  to_actor: z.string().max(200)
    .describe('Target actor slug or UUID'),
  agent_id: z.string().max(200).optional()
    .describe('Agent identifier of the assigning agent'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchAssign(args: any) {
  return dispatch('dispatch_assign', args)
}

// ── dispatch_forward ──────────────────────────────────────────────────────────

export const dispatchForwardSchema = {
  dispatch_id: z.string().uuid()
    .describe('Dispatch UUID to forward'),
  to_project_id: z.string().uuid()
    .describe('Target project UUID (must be linked to the source project)'),
  to_actor: z.string().max(200).optional()
    .describe('Optional new assignee actor in the target project'),
  agent_id: z.string().max(200).optional()
    .describe('Agent identifier of the forwarding agent'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchForward(args: any) {
  return dispatch('dispatch_forward', args)
}

// ── dispatch_resolve ──────────────────────────────────────────────────────────

export const dispatchResolveSchema = {
  dispatch_id: z.string().uuid()
    .describe('Dispatch UUID to mark as resolved'),
  resolution: z.string().max(10_000).optional()
    .describe('Resolution note — what was done, what was the outcome, any follow-up'),
  agent_id: z.string().max(200).optional()
    .describe('Agent identifier'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchResolve(args: any) {
  return dispatch('dispatch_resolve', args)
}

// ── dispatch_close ────────────────────────────────────────────────────────────

export const dispatchCloseSchema = {
  dispatch_id: z.string().uuid()
    .describe('Dispatch UUID to close (must be in resolved or needs_review status)'),
  agent_id: z.string().max(200).optional()
    .describe('Agent identifier'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchClose(args: any) {
  return dispatch('dispatch_close', args)
}

// ── dispatch_get ──────────────────────────────────────────────────────────────

export const dispatchGetSchema = {
  dispatch_id: z.string().uuid()
    .describe('Dispatch UUID — returns full Dispatch with messages and participants'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchGet(args: any) {
  return dispatch('dispatch_get', args)
}

// ── dispatch_sweep ────────────────────────────────────────────────────────────

export const dispatchSweepSchema = {
  project_id: z.string().uuid()
    .describe('Project UUID — returns prioritized session-start overview of relevant Dispatches'),
  include_blocking: z.boolean().optional()
    .describe('Include blocking Dispatches (default: true)'),
  include_overdue: z.boolean().optional()
    .describe('Include overdue Dispatches (default: true)'),
  include_waiting_on_me: z.boolean().optional()
    .describe('Include Dispatches waiting on this actor/project (default: true)'),
  include_recent_updates: z.boolean().optional()
    .describe('Include recently updated Dispatches (default: true)'),
  acknowledge_non_blocking: z.boolean().optional()
    .describe('Auto-acknowledge all non-blocking open Dispatches (default: false)'),
  limit: z.number().int().min(1).max(25).optional()
    .describe('Max results per category (default: 10)'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchSweep(args: any) {
  return dispatch('dispatch_sweep', args)
}

// ── dispatch_related ──────────────────────────────────────────────────────────

export const dispatchRelatedSchema = {
  dispatch_id: z.string().uuid().optional()
    .describe('Dispatch UUID — find structurally related Dispatches'),
  project_id: z.string().uuid().optional()
    .describe('Project UUID — find related Dispatches within the project'),
  include_closed: z.boolean().optional()
    .describe('Include closed/cancelled Dispatches (default: true — useful for loop prevention)'),
  limit: z.number().int().min(1).max(20).optional()
    .describe('Max results (default: 5)'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dispatchRelated(args: any) {
  return dispatch('dispatch_related', args)
}

// ── Legacy vl_* compat wrappers ───────────────────────────────────────────────
// These delegate to the dispatch_* functions via the alias mapping in the API.

export const createLetterSchema = {
  project_id: z.string().uuid().describe('Recipient project UUID'),
  from_project_id: z.string().uuid().optional().describe('Sender project UUID'),
  from_actor: z.string().max(200).describe('Sender actor identifier'),
  to_actor: z.string().max(200).describe('Recipient actor identifier'),
  subject: z.string().max(500).describe('Letter subject (used as Dispatch title)'),
  body: z.string().max(100_000).describe('Initial message body'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal').describe('Priority'),
  blocking: z.boolean().default(false).describe('Whether this letter blocks the sender'),
  thread_id: z.string().uuid().optional().describe('Optional thread UUID'),
  agent_id: z.string().max(200).optional().describe('Agent identifier'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createLetter(args: any) {
  // Map legacy vl_create → dispatch_create
  return dispatch('dispatch_create', {
    project_id: args.from_project_id ?? args.project_id,
    to_project_id: args.project_id,
    to_actor: args.to_actor,
    title: args.subject,
    body: args.body,
    type: 'question',
    priority: args.priority ?? 'normal',
    blocking: args.blocking ?? false,
    agent_id: args.agent_id,
  })
}

export const replyLetterSchema = {
  letter_id: z.string().uuid().describe('Dispatch/Letter UUID to reply to'),
  body: z.string().max(100_000).describe('Reply body'),
  message_type: z.enum(['response', 'clarification', 'review_note', 'follow_up', 'context']).optional()
    .describe('Message type'),
  new_status: z.enum(['acknowledged', 'in_progress', 'answered', 'blocked', 'needs_review', 'closed']).optional()
    .describe('Optional status update'),
  agent_id: z.string().max(200).optional().describe('Agent identifier'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function replyLetter(args: any) {
  // Map legacy status values
  const statusMap: Record<string, string> = { answered: 'resolved' }
  const newStatus = args.new_status ? (statusMap[args.new_status] ?? args.new_status) : undefined

  return dispatch('dispatch_reply', {
    dispatch_id: args.letter_id,
    body: args.body,
    message_type: args.message_type === 'response' ? 'reply' : (args.message_type ?? 'reply'),
    status: newStatus,
    agent_id: args.agent_id,
  })
}

export const letterInboxSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  status_filter: z.array(z.string()).optional().describe('Filter by status'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default: 20)'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function letterInbox(args: any) {
  return dispatch('dispatch_inbox', args)
}

export const letterOutboxSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  status_filter: z.array(z.string()).optional().describe('Filter by status'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results (default: 20)'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function letterOutbox(args: any) {
  return dispatch('dispatch_outbox', args)
}

export const ackLetterSchema = {
  letter_id: z.string().uuid().describe('Letter/Dispatch UUID to acknowledge'),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ackLetter(args: any) {
  return dispatch('dispatch_ack', { dispatch_id: args.letter_id })
}
