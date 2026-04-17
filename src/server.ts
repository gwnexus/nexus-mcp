#!/usr/bin/env node
/**
 * nexus-mcp -- MCP Server for mpowr-nexus
 *
 * Provides Knowledge Access (Layer 1), Coordination (Layer 2),
 * Governance (Layer 3), and Reviews (Layer 4) tools.
 * Runs as a standalone stdio MCP server.
 *
 * Authentication:
 *   Identity is resolved once at startup from NEXUS_PRIVATE_TOKEN (nxs_pat_*).
 *   All write tools receive user_id automatically from the resolved identity.
 *   Callers no longer pass user_id as a parameter.
 *
 * Layer 1 - Knowledge Access:
 *   - kb_search: Search project knowledge (keyword/semantic/hybrid)
 *   - kb_memory: Curated project context for agent bootstrapping
 *   - kb_get: Fetch a single knowledge object
 *   - kb_related: Navigate entity relationships
 *   - project_list: List accessible projects
 *
 * Layer 2 - Coordination:
 *   - vl_create: Create a new vault letter
 *   - vl_reply: Reply to an existing vault letter
 *   - vl_inbox: List letters addressed to the calling agent/user
 *   - vl_outbox: List letters sent by the calling agent/user
 *   - vl_ack: Acknowledge receipt of a new vault letter
 *   - task_create: Create a task in a project
 *   - task_update: Update task status, priority, or assignee
 *   - task_note: Append a note to a task (append-only)
 *   - task_list: List tasks for a project with filters
 *   - dc_add: Add a comment to an ADR (append-only)
 *   - dc_list: List comments for an ADR
 *   - sk_list: List skills for the current tenant
 *   - sk_get: Get full skill content by identifier
 *   - sk_create: Create a new skill in draft status
 *   - sk_update: Update skill content or metadata
 *   - sk_activate: Change skill status (draft/active/archived)
 *   - sk_assign: Assign a skill to a project
 *   - sk_unassign: Remove a skill assignment from a project
 *   - sk_export: Export all skill assignments for a project
 *   - doc_ingest: Push text/markdown content into project knowledge base
 *   - doc_list: List ingested documents for a project
 *   - session_append: Append to a session (write-isolated)
 *   - session_create: Start a new work session
 *   - session_close: End a session with summary and next entry point
 *   - session_list: List open sessions for a project
 *
 * Layer 3 - Governance:
 *   - adr_create: Create a new ADR draft
 *   - adr_submit: Submit an ADR for review
 *   - adr_decide: Accept or reject an ADR
 *
 * Layer 4 - Reviews:
 *   - rv_list: List reviews with optional filters
 *   - rv_get: Get a review by ID or entity reference
 *   - rv_create: Create a new review for an entity
 *   - rv_decide: Transition a review state
 *   - rv_comment: Add a comment to a review
 *
 * Usage:
 *   npx tsx src/mcp/server.ts
 *
 * Or via .mcp.json configuration:
 *   { "command": "npx", "args": ["tsx", "src/mcp/server.ts"] }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { getIdentity, initIdentity } from './auth.js'

// Layer 1: Knowledge Access
import { projectList, projectListSchema } from './tools/project-list.js'
import { getDocument, getDocumentSchema } from './tools/get-document.js'
import {
  getProjectMemory,
  getProjectMemorySchema,
} from './tools/get-project-memory.js'
import {
  getRelatedEntities,
  getRelatedEntitiesSchema,
} from './tools/get-related-entities.js'
import {
  searchKnowledge,
  searchKnowledgeSchema,
} from './tools/search-knowledge.js'

// Layer 2: Coordination
import { addTaskNote, addTaskNoteSchema } from './tools/add-task-note.js'
import {
  appendSessionEntry,
  appendSessionEntrySchema,
} from './tools/append-session-entry.js'
import { createTask, createTaskSchema } from './tools/create-task.js'
import {
  addDecisionComment,
  addDecisionCommentSchema,
  listDecisionComments,
  listDecisionCommentsSchema,
} from './tools/decision-comments.js'
import {
  ingestDocument,
  ingestDocumentSchema,
} from './tools/ingest-document.js'
import {
  acknowledgeLetter,
  acknowledgeLetterSchema,
  listInbox,
  listInboxSchema,
  listOutbox,
  listOutboxSchema,
} from './tools/letter-inbox.js'
import {
  createLetter,
  createLetterSchema,
  replyLetter,
  replyLetterSchema,
} from './tools/letters.js'
import {
  listDocuments,
  listDocumentsSchema,
} from './tools/list-documents.js'
import { listTasks, listTasksSchema } from './tools/list-tasks.js'
import {
  closeSession,
  closeSessionSchema,
  createSession,
  createSessionSchema,
  listOpenSessions,
  listOpenSessionsSchema,
} from './tools/sessions.js'
import {
  skActivate,
  skActivateSchema,
  skCreate,
  skCreateSchema,
  skGet,
  skGetSchema,
  skList,
  skListSchema,
  skUpdate,
  skUpdateSchema,
} from './tools/skills.js'
import {
  skAssign,
  skAssignSchema,
  skExport,
  skExportSchema,
  skUnassign,
  skUnassignSchema,
} from './tools/skill-assign.js'
import {
  updateTaskStatus,
  updateTaskStatusSchema,
} from './tools/update-task-status.js'

// Layer 3: Governance
import {
  createAdrDraft,
  createAdrDraftSchema,
  recordAdrDecision,
  recordAdrDecisionSchema,
  submitAdrReview,
  submitAdrReviewSchema,
} from './tools/governance.js'

// Layer 4: Reviews
import {
  rvComment,
  rvCommentSchema,
  rvCreate,
  rvCreateSchema,
  rvDecide,
  rvDecideSchema,
  rvGet,
  rvGetSchema,
  rvList,
  rvListSchema,
} from './tools/reviews.js'

// ---------------------------------------------------------------------------
// Identity injection helper
// ---------------------------------------------------------------------------

/**
 * Wrap a write-tool handler to inject user_id from the resolved identity.
 * The caller does not need to pass user_id — it comes from the token.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function withIdentity(handler: (args: any) => Promise<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (args: any) => {
    const identity = getIdentity()
    return handler({ ...args, user_id: identity.userId })
  }
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer(
  {
    name: 'nexus-mcp',
    version: '0.6.1',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// ---------------------------------------------------------------------------
// Layer 1: Knowledge Access tools
// ---------------------------------------------------------------------------

server.tool(
  'kb_search',
  'Search project knowledge using keyword, semantic, or hybrid mode. Applies project scope filters before retrieval. Returns matching entities with relevance ranking.',
  searchKnowledgeSchema,
  async (args) => searchKnowledge(args),
)

server.tool(
  'kb_memory',
  'Get curated project context for agent bootstrapping. Returns ADRs, active tasks, recent sessions, open letters, and other project knowledge based on selected categories and depth.',
  getProjectMemorySchema,
  async (args) => getProjectMemory(args),
)

server.tool(
  'kb_get',
  'Fetch a single knowledge object (session, decision, letter, task, etc.) in structured, markdown, or summary format. Includes child entries for sessions and letters.',
  getDocumentSchema,
  async (args) => getDocument(args),
)

server.tool(
  'kb_related',
  'Navigate entity relationships. Returns graph-neighbor entities related to a given item, such as supersession chains for ADRs, thread siblings for letters, or tasks created during sessions.',
  getRelatedEntitiesSchema,
  async (args) => getRelatedEntities(args),
)

server.tool(
  'project_list',
  'List accessible projects for the authenticated user or agent. Returns project metadata ordered by name.',
  projectListSchema,
  async (args) => projectList(args),
)

// ---------------------------------------------------------------------------
// Layer 2: Coordination tools
// ---------------------------------------------------------------------------

server.tool(
  'vl_create',
  'Create a new vault letter for agent-to-agent or agent-to-human coordination. Returns the new letter ID and status.',
  createLetterSchema,
  withIdentity(createLetter),
)

server.tool(
  'vl_reply',
  'Reply to an existing vault letter with a new message. Optionally update the letter status. Enforces append-only semantics.',
  replyLetterSchema,
  withIdentity(replyLetter),
)

server.tool(
  'vl_inbox',
  'List vault letters addressed to the calling agent or user. Returns letters scoped to the given project, ordered by blocking status and recency. Supports status filtering.',
  listInboxSchema,
  withIdentity(listInbox),
)

server.tool(
  'vl_outbox',
  'List vault letters sent by the calling agent or user. Returns letters scoped to the given project, ordered by recency. Supports status filtering.',
  listOutboxSchema,
  withIdentity(listOutbox),
)

server.tool(
  'vl_ack',
  'Acknowledge receipt of a new vault letter. Transitions the letter from new to acknowledged status and appends an acknowledgment message.',
  acknowledgeLetterSchema,
  withIdentity(acknowledgeLetter),
)

server.tool(
  'task_create',
  'Create a new task within a project scope. Returns the new task ID.',
  createTaskSchema,
  withIdentity(createTask),
)

server.tool(
  'task_update',
  'Update the status of an existing task. Optionally change priority or assignee. Automatically records a status-change note for audit trail.',
  updateTaskStatusSchema,
  withIdentity(updateTaskStatus),
)

server.tool(
  'task_note',
  'Append a note to an existing task. Notes are append-only and maintain a chronological audit trail. Useful for recording progress, blockers, or decisions.',
  addTaskNoteSchema,
  withIdentity(addTaskNote),
)

server.tool(
  'task_list',
  'List tasks for a project with optional status filtering. Returns tasks ordered by creation date (newest first).',
  listTasksSchema,
  withIdentity(listTasks),
)

server.tool(
  'doc_ingest',
  'Push text or markdown content into a project knowledge base. Creates an ingest item that can later be classified. Useful for agents to persist research results, generated documents, or extracted knowledge.',
  ingestDocumentSchema,
  withIdentity(ingestDocument),
)

server.tool(
  'doc_list',
  'List ingested documents for a project with optional source filtering. Returns documents ordered by creation date (newest first).',
  listDocumentsSchema,
  withIdentity(listDocuments),
)

server.tool(
  'session_append',
  'Append an entry to an existing session. Enforces session write isolation: only the session creator can append entries.',
  appendSessionEntrySchema,
  withIdentity(appendSessionEntry),
)

server.tool(
  'session_create',
  'Create a new work session for a project. Returns the session ID. The session starts in open status and must be closed explicitly via session_close.',
  createSessionSchema,
  withIdentity(createSession),
)

server.tool(
  'session_close',
  'Close an open session. Sets status to closed, optionally records a summary and next entry point. Only the session creator can close it.',
  closeSessionSchema,
  withIdentity(closeSession),
)

server.tool(
  'session_list',
  'List open sessions for a project. Returns sessions ordered by creation date (newest first). Useful for checking active work before starting a new session.',
  listOpenSessionsSchema,
  async (args) => listOpenSessions(args),
)

// ---------------------------------------------------------------------------
// Layer 2 (continued): Decision comment tools
// ---------------------------------------------------------------------------

server.tool(
  'dc_add',
  'Add a comment to an ADR decision. Comments are append-only and support both human and agent actors.',
  addDecisionCommentSchema,
  withIdentity(addDecisionComment),
)

server.tool(
  'dc_list',
  'List comments for an ADR decision in chronological order.',
  listDecisionCommentsSchema,
  async (args) => listDecisionComments(args),
)

// ---------------------------------------------------------------------------
// Layer 2 (continued): Skill management tools
// ---------------------------------------------------------------------------

server.tool(
  'sk_list',
  'List skills for the current tenant. Supports status filtering (draft, active, archived). Returns skill metadata without full body content.',
  skListSchema,
  withIdentity(skList),
)

server.tool(
  'sk_get',
  'Get full skill content by skill identifier or UUID. Includes associated command information.',
  skGetSchema,
  withIdentity(skGet),
)

server.tool(
  'sk_create',
  'Create a new skill in draft status. Optionally auto-generates an OpenCode command. Skill content is markdown-based instruction text.',
  skCreateSchema,
  withIdentity(skCreate),
)

server.tool(
  'sk_update',
  'Update an existing skill content, metadata, or command auto-generation setting. Increments version when body changes.',
  skUpdateSchema,
  withIdentity(skUpdate),
)

server.tool(
  'sk_activate',
  'Change a skill status (draft, active, archived). Active skills are available for agent loading and project selection.',
  skActivateSchema,
  withIdentity(skActivate),
)

server.tool(
  'sk_assign',
  'Assign a skill to a project. Optionally pin to a specific version and set enabled state.',
  skAssignSchema,
  withIdentity(skAssign),
)

server.tool(
  'sk_unassign',
  'Remove a skill assignment from a project.',
  skUnassignSchema,
  withIdentity(skUnassign),
)

server.tool(
  'sk_export',
  'Export all skill assignments for a project. Returns the full assignment list with pinned versions and enabled states.',
  skExportSchema,
  withIdentity(skExport),
)

// ---------------------------------------------------------------------------
// Layer 3: Governance tools
// ---------------------------------------------------------------------------

server.tool(
  'adr_create',
  'Create a new ADR (Architecture Decision Record) in draft state. Auto-assigns the next ADR number for the project. Optionally links to a superseded ADR.',
  createAdrDraftSchema,
  withIdentity(createAdrDraft),
)

server.tool(
  'adr_submit',
  'Submit an ADR for review. Transitions an ADR from draft to under_review state. Only drafts can be submitted.',
  submitAdrReviewSchema,
  withIdentity(submitAdrReview),
)

server.tool(
  'adr_decide',
  'Accept or reject an ADR that is under review. If accepted and it supersedes another ADR, the superseded ADR is automatically marked. Optional rationale is appended to the ADR body.',
  recordAdrDecisionSchema,
  withIdentity(recordAdrDecision),
)

// ---------------------------------------------------------------------------
// Layer 4: Review tools
// ---------------------------------------------------------------------------

server.tool(
  'rv_list',
  'List reviews with optional filters by entity type and status. Returns reviews ordered by recency.',
  rvListSchema,
  withIdentity(rvList),
)

server.tool(
  'rv_get',
  'Get a review by review ID, or by entity type and entity ID. Returns full review details including status and history.',
  rvGetSchema,
  withIdentity(rvGet),
)

server.tool(
  'rv_create',
  'Create a new review for a skill or agent entity. Returns the new review ID and initial status.',
  rvCreateSchema,
  withIdentity(rvCreate),
)

server.tool(
  'rv_decide',
  'Transition a review state (submit, accept, reject, request_revision, resubmit, archive). Enforces valid state transitions. Optional rationale is recorded.',
  rvDecideSchema,
  withIdentity(rvDecide),
)

server.tool(
  'rv_comment',
  'Add a comment to a review. Supports inline comments with optional line range. Comments are append-only and maintain a chronological audit trail.',
  rvCommentSchema,
  withIdentity(rvComment),
)

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  // Resolve identity from NEXUS_PRIVATE_TOKEN before accepting connections
  await initIdentity()

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[nexus-mcp] Server started on stdio')
}

main().catch((err) => {
  console.error('[nexus-mcp] Fatal error:', err)
  process.exit(1)
})
