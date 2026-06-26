/**
 * Test helpers for MCP tool tests.
 *
 * Provides utilities for mocking the Nexus API client
 * and parsing MCP tool responses.
 */

import type { NexusApiResponse } from '../nexus-api.js'

/**
 * Create a successful NexusApiResponse.
 */
export function mockApiSuccess<T>(data: T): NexusApiResponse<T> {
  return { ok: true, status: 200, data, error: null }
}

/**
 * Create a failed NexusApiResponse.
 */
export function mockApiError(
  error: string,
  status = 400,
): NexusApiResponse<never> {
  return { ok: false, status, data: null, error }
}

/**
 * Helper to parse the JSON from an MCP tool response.
 */
export function parseToolResponse(result: {
  content: { type: string; text: string }[]
  isError?: boolean
}) {
  const text = result.content[0]?.text
  if (!text) throw new Error('Empty tool response')
  return JSON.parse(text)
}

/**
 * Standard test UUIDs for consistency across tests.
 */
export const TEST_IDS = {
  userId: '83a37012-8add-428f-8bc3-d56c84291671',
  projectId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  targetProjectId: 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  sessionId: '11111111-2222-3333-4444-555555555555',
  taskId: '22222222-3333-4444-5555-666666666666',
  letterId: '33333333-4444-5555-6666-777777777777',
  dispatchId: '33333333-4444-5555-6666-777777777777',  // same UUID, dispatch is the new name
  adrId: '44444444-5555-6666-7777-888888888888',
  entryId: '55555555-6666-7777-8888-999999999999',
  noteId: '66666666-7777-8888-9999-aaaaaaaaaaaa',
  documentId: '77777777-8888-9999-aaaa-bbbbbbbbbbbb',
  agentId: 'nexus-app-agent',
  otherUserId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
  skillId: '88888888-9999-aaaa-bbbb-cccccccccccc',
  tenantId: '20c72e35-d4d8-4e40-a7be-efff14d8eaff',
  reviewId: 'aabbccdd-1122-3344-5566-778899001122',
  assignmentId: 'bbccddee-2233-4455-6677-889900112233',
}
