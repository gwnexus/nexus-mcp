/**
 * Tests for Nexus Dispatch tools (ADR-0052).
 * Covers all 12 dispatch_* tools + legacy vl_* alias wrappers.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockApiError, mockApiSuccess, parseToolResponse, TEST_IDS } from './helpers'

vi.mock('../nexus-api.js', () => ({
  nexusPost: vi.fn(),
}))

import { nexusPost } from '../nexus-api.js'

// ---------------------------------------------------------------------------
// dispatch_create
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_create', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should create a Dispatch and return dispatch_id', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_create',
        dispatch_id: TEST_IDS.dispatchId,
        letter_id: TEST_IDS.dispatchId,
        source_project_id: TEST_IDS.projectId,
        target_project_id: TEST_IDS.targetProjectId,
        title: 'Fix kb_search relevance labels',
        status: 'open',
      }),
    )

    const { dispatchCreate } = await import('../tools/dispatches.js')
    const result = await dispatchCreate({
      project_id: TEST_IDS.projectId,
      to_actor: 'rf-nexus-app-agent',
      title: 'Fix kb_search relevance labels',
      body: 'Semantic search returns "exact" for all results regardless of similarity.',
      type: 'bug_report',
      priority: 'high',
      agent_id: 'rf-nexus-cli-agent',
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_create')
    expect(parsed.dispatch_id).toBe(TEST_IDS.dispatchId)
    expect(parsed.status).toBe('open')
  })

  it('should return error when project not linked', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Projects are not linked.', 403),
    )

    const { dispatchCreate } = await import('../tools/dispatches.js')
    const result = await dispatchCreate({
      project_id: TEST_IDS.projectId,
      to_project_id: TEST_IDS.targetProjectId,
      title: 'Cross-project without link',
      body: 'This should fail.',
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_reply
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_reply', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should append a reply to a Dispatch', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_reply',
        dispatch_id: TEST_IDS.dispatchId,
        letter_id: TEST_IDS.dispatchId,
        message_type: 'reply',
      }),
    )

    const { dispatchReply } = await import('../tools/dispatches.js')
    const result = await dispatchReply({
      dispatch_id: TEST_IDS.dispatchId,
      body: 'Fixed in commit abc123. Similarity tiers now map correctly.',
      message_type: 'resolution',
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_reply')
    expect(parsed.dispatch_id).toBe(TEST_IDS.dispatchId)
  })

  it('should include new_status when provided', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_reply',
        dispatch_id: TEST_IDS.dispatchId,
        letter_id: TEST_IDS.dispatchId,
        message_type: 'reply',
        new_status: 'resolved',
      }),
    )

    const { dispatchReply } = await import('../tools/dispatches.js')
    const result = await dispatchReply({
      dispatch_id: TEST_IDS.dispatchId,
      body: 'Issue resolved.',
      status: 'resolved',
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.new_status).toBe('resolved')
  })

  it('should return error on invalid status transition', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Invalid status transition: closed → in_progress', 409),
    )

    const { dispatchReply } = await import('../tools/dispatches.js')
    const result = await dispatchReply({
      dispatch_id: TEST_IDS.dispatchId,
      body: 'Trying invalid transition.',
      status: 'in_progress',
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_inbox
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_inbox', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should list Dispatches addressed to a project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_inbox',
        project_id: TEST_IDS.projectId,
        count: 2,
        dispatches: [
          { id: TEST_IDS.dispatchId, title: 'Fix search', status: 'open', blocking: false },
          { id: '44444444-5555-6666-7777-888888888888', title: 'Review ADR', status: 'acknowledged', blocking: true },
        ],
        letters: [],
      }),
    )

    const { dispatchInbox } = await import('../tools/dispatches.js')
    const result = await dispatchInbox({
      project_id: TEST_IDS.projectId,
      limit: 20,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.schema).toBe('nexus.dispatch-list.v1')
    expect(parsed.data.action).toBe('dispatch_inbox')
    expect(parsed.data.count).toBe(2)
    expect(parsed.data.dispatches).toHaveLength(2)
  })

  it('should filter by blocking scope', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_inbox',
        project_id: TEST_IDS.projectId,
        count: 1,
        dispatches: [
          { id: TEST_IDS.dispatchId, title: 'Blocker', status: 'open', blocking: true },
        ],
        letters: [],
      }),
    )

    const { dispatchInbox } = await import('../tools/dispatches.js')
    const result = await dispatchInbox({
      project_id: TEST_IDS.projectId,
      scope: 'blocking',
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.data.count).toBe(1)
    expect(parsed.data.dispatches[0].blocking).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_outbox
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_outbox', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should list Dispatches sent by a project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_outbox',
        project_id: TEST_IDS.projectId,
        count: 1,
        dispatches: [
          { id: TEST_IDS.dispatchId, title: 'Sent dispatch', status: 'acknowledged' },
        ],
        letters: [],
      }),
    )

    const { dispatchOutbox } = await import('../tools/dispatches.js')
    const result = await dispatchOutbox({ project_id: TEST_IDS.projectId })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.schema).toBe('nexus.dispatch-list.v1')
    expect(parsed.data.action).toBe('dispatch_outbox')
    expect(parsed.data.count).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// dispatch_ack
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_ack', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should acknowledge an open Dispatch', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_ack',
        dispatch_id: TEST_IDS.dispatchId,
        letter_id: TEST_IDS.dispatchId,
        new_status: 'acknowledged',
      }),
    )

    const { dispatchAck } = await import('../tools/dispatches.js')
    const result = await dispatchAck({ dispatch_id: TEST_IDS.dispatchId })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_ack')
    expect(parsed.new_status).toBe('acknowledged')
  })

  it('should return error when Dispatch is not in open state', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError("Cannot acknowledge Dispatch with status 'acknowledged'", 409),
    )

    const { dispatchAck } = await import('../tools/dispatches.js')
    const result = await dispatchAck({ dispatch_id: TEST_IDS.dispatchId })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_assign
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_assign', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should assign a Dispatch to a new actor', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_assign',
        dispatch_id: TEST_IDS.dispatchId,
        assignee_actor: 'rf-nexus-app-agent',
        target_project_id: TEST_IDS.targetProjectId,
      }),
    )

    const { dispatchAssign } = await import('../tools/dispatches.js')
    const result = await dispatchAssign({
      dispatch_id: TEST_IDS.dispatchId,
      to_actor: 'rf-nexus-app-agent',
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_assign')
    expect(parsed.assignee_actor).toBe('rf-nexus-app-agent')
  })

  it('should return error when actor not found', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Actor not found: unknown-agent', 404),
    )

    const { dispatchAssign } = await import('../tools/dispatches.js')
    const result = await dispatchAssign({
      dispatch_id: TEST_IDS.dispatchId,
      to_actor: 'unknown-agent',
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_forward
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_forward', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should forward a Dispatch to another project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_forward',
        dispatch_id: TEST_IDS.dispatchId,
        new_target_project_id: TEST_IDS.targetProjectId,
      }),
    )

    const { dispatchForward } = await import('../tools/dispatches.js')
    const result = await dispatchForward({
      dispatch_id: TEST_IDS.dispatchId,
      to_project_id: TEST_IDS.targetProjectId,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_forward')
    expect(parsed.new_target_project_id).toBe(TEST_IDS.targetProjectId)
  })

  it('should return error when projects not linked', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError('Projects are not linked.', 403),
    )

    const { dispatchForward } = await import('../tools/dispatches.js')
    const result = await dispatchForward({
      dispatch_id: TEST_IDS.dispatchId,
      to_project_id: TEST_IDS.targetProjectId,
    })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_resolve
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_resolve', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should resolve a Dispatch with resolution note', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_resolve',
        dispatch_id: TEST_IDS.dispatchId,
        new_status: 'resolved',
      }),
    )

    const { dispatchResolve } = await import('../tools/dispatches.js')
    const result = await dispatchResolve({
      dispatch_id: TEST_IDS.dispatchId,
      resolution: 'Fixed by mapping similarity scores to 5 tiers.',
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_resolve')
    expect(parsed.new_status).toBe('resolved')
  })

  it('should return error when Dispatch cannot be resolved from current status', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiError("Cannot resolve Dispatch with status 'closed'", 409),
    )

    const { dispatchResolve } = await import('../tools/dispatches.js')
    const result = await dispatchResolve({ dispatch_id: TEST_IDS.dispatchId })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_close
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_close', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should close a resolved Dispatch', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_close',
        dispatch_id: TEST_IDS.dispatchId,
        new_status: 'closed',
      }),
    )

    const { dispatchClose } = await import('../tools/dispatches.js')
    const result = await dispatchClose({ dispatch_id: TEST_IDS.dispatchId })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_close')
    expect(parsed.new_status).toBe('closed')
  })
})

// ---------------------------------------------------------------------------
// dispatch_get
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_get', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should return full Dispatch with messages and participants', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_get',
        dispatch: {
          id: TEST_IDS.dispatchId,
          title: 'Fix search',
          type: 'bug_report',
          status: 'resolved',
          blocking: false,
          priority: 'high',
          source_project_id: TEST_IDS.projectId,
          target_project_id: TEST_IDS.targetProjectId,
        },
        messages: [
          { id: 'msg-1', message_type: 'reply', body_markdown: 'Initial bug report.', created_at: '2026-06-26T00:00:00Z' },
          { id: 'msg-2', message_type: 'resolution', body_markdown: 'Fixed.', created_at: '2026-06-26T01:00:00Z' },
        ],
        participants: [
          { role: 'requester', project_id: TEST_IDS.projectId },
          { role: 'assignee', project_id: TEST_IDS.targetProjectId },
        ],
      }),
    )

    const { dispatchGet } = await import('../tools/dispatches.js')
    const result = await dispatchGet({ dispatch_id: TEST_IDS.dispatchId })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.schema).toBe('nexus.dispatch-get.v1')
    expect(parsed.data.action).toBe('dispatch_get')
    expect(parsed.data.dispatch.id).toBe(TEST_IDS.dispatchId)
    expect(parsed.data.messages).toHaveLength(2)
    expect(parsed.data.participants).toHaveLength(2)
  })

  it('should return error when Dispatch not found', async () => {
    vi.mocked(nexusPost).mockResolvedValue(mockApiError('Dispatch not found', 404))

    const { dispatchGet } = await import('../tools/dispatches.js')
    const result = await dispatchGet({ dispatch_id: TEST_IDS.dispatchId })

    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// dispatch_sweep
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_sweep', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should return prioritized session-start overview', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_sweep',
        project_id: TEST_IDS.projectId,
        blocking: [
          { id: TEST_IDS.dispatchId, title: 'Critical blocker', status: 'open', blocking: true },
        ],
        waiting_on_me: [],
        overdue: [],
        new_assignments: [],
        recent_updates: [
          { id: TEST_IDS.dispatchId, title: 'Recent update', status: 'in_progress', blocking: false },
        ],
        recommended_next_actions: ['Review 1 blocking Dispatch'],
      }),
    )

    const { dispatchSweep } = await import('../tools/dispatches.js')
    const result = await dispatchSweep({ project_id: TEST_IDS.projectId })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.schema).toBe('nexus.dispatch-sweep.v1')
    expect(parsed.data.action).toBe('dispatch_sweep')
    expect(parsed.data.blocking).toHaveLength(1)
    expect(parsed.data.blocking[0].blocking).toBe(true)
    expect(parsed.data.recommended_next_actions).toHaveLength(1)
  })

  it('should return empty sweep for idle project', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_sweep',
        project_id: TEST_IDS.projectId,
        blocking: [],
        waiting_on_me: [],
        overdue: [],
        new_assignments: [],
        recent_updates: [],
        recommended_next_actions: [],
      }),
    )

    const { dispatchSweep } = await import('../tools/dispatches.js')
    const result = await dispatchSweep({
      project_id: TEST_IDS.projectId,
      acknowledge_non_blocking: true,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.data.blocking).toHaveLength(0)
    expect(parsed.data.recommended_next_actions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// dispatch_related
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: dispatch_related', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('should return structurally related Dispatches', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_related',
        dispatch_id: TEST_IDS.dispatchId,
        related: [
          { id: 'rel-1', title: 'Prior bug about the same API', status: 'closed', type: 'bug_report' },
        ],
        relation_type: 'same_route_and_type',
      }),
    )

    const { dispatchRelated } = await import('../tools/dispatches.js')
    const result = await dispatchRelated({
      dispatch_id: TEST_IDS.dispatchId,
      include_closed: true,
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    expect(parsed.action).toBe('dispatch_related')
    expect(parsed.related).toHaveLength(1)
    expect(parsed.related[0].status).toBe('closed')
  })
})

// ---------------------------------------------------------------------------
// Legacy vl_* alias wrappers
// ---------------------------------------------------------------------------

describe('Nexus Dispatch: legacy vl_* aliases', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('vl_create should delegate to dispatch_create with title=subject', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_create',
        dispatch_id: TEST_IDS.dispatchId,
        letter_id: TEST_IDS.dispatchId,
        status: 'open',
      }),
    )

    const { createLetter } = await import('../tools/dispatches.js')
    const result = await createLetter({
      project_id: TEST_IDS.projectId,
      from_actor: 'nexus-app-agent',
      to_actor: 'human',
      subject: 'Review needed',
      body: 'Please review the ADR',
    })

    expect(result.isError).toBeUndefined()
    const parsed = parseToolResponse(result)
    // dispatch_create returns dispatch_create action
    expect(parsed.dispatch_id ?? parsed.letter_id).toBe(TEST_IDS.dispatchId)

    // Verify it posted to /api/mcp/dispatches with dispatch_create action
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/dispatches',
      expect.objectContaining({ action: 'dispatch_create' }),
    )
  })

  it('vl_reply should delegate to dispatch_reply', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_reply',
        dispatch_id: TEST_IDS.dispatchId,
        letter_id: TEST_IDS.dispatchId,
        message_type: 'reply',
      }),
    )

    const { replyLetter } = await import('../tools/dispatches.js')
    const result = await replyLetter({
      letter_id: TEST_IDS.letterId,
      body: 'Acknowledged.',
    })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/dispatches',
      expect.objectContaining({ action: 'dispatch_reply', dispatch_id: TEST_IDS.letterId }),
    )
  })

  it('vl_ack should delegate to dispatch_ack', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_ack',
        dispatch_id: TEST_IDS.dispatchId,
        letter_id: TEST_IDS.dispatchId,
        new_status: 'acknowledged',
      }),
    )

    const { ackLetter } = await import('../tools/dispatches.js')
    const result = await ackLetter({ letter_id: TEST_IDS.letterId })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/dispatches',
      expect.objectContaining({ action: 'dispatch_ack', dispatch_id: TEST_IDS.letterId }),
    )
  })

  it('vl_inbox should delegate to dispatch_inbox', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_inbox',
        project_id: TEST_IDS.projectId,
        count: 0,
        dispatches: [],
        letters: [],
      }),
    )

    const { letterInbox } = await import('../tools/dispatches.js')
    const result = await letterInbox({ project_id: TEST_IDS.projectId })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/dispatches',
      expect.objectContaining({ action: 'dispatch_inbox' }),
    )
  })

  it('vl_outbox should delegate to dispatch_outbox', async () => {
    vi.mocked(nexusPost).mockResolvedValue(
      mockApiSuccess({
        action: 'dispatch_outbox',
        project_id: TEST_IDS.projectId,
        count: 0,
        dispatches: [],
        letters: [],
      }),
    )

    const { letterOutbox } = await import('../tools/dispatches.js')
    const result = await letterOutbox({ project_id: TEST_IDS.projectId })

    expect(result.isError).toBeUndefined()
    expect(vi.mocked(nexusPost)).toHaveBeenCalledWith(
      '/api/mcp/dispatches',
      expect.objectContaining({ action: 'dispatch_outbox' }),
    )
  })
})
