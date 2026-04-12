/**
 * Global test setup for MCP server tests.
 *
 * Mocks the Supabase service client so tests run without
 * a real database connection.
 */

import { vi } from 'vitest'

// Mock environment variables
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXUS_PRIVATE_TOKEN =
  'nxs_pat_test-token-for-unit-tests-1234567890abc'

// Suppress console.error from MCP tools during tests
vi.spyOn(console, 'error').mockImplementation(() => {})
