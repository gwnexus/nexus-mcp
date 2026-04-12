/**
 * Global test setup for MCP server tests.
 *
 * Sets environment variables needed for the Nexus API client.
 */

import { vi } from 'vitest'

// Mock environment variables for Nexus API client
process.env.NEXUS_API_URL = 'https://test.nexus.example.com'
process.env.NEXUS_PRIVATE_TOKEN =
  'nxs_pat_test-token-for-unit-tests-1234567890abc'

// Suppress console.error from MCP tools during tests
vi.spyOn(console, 'error').mockImplementation(() => {})
