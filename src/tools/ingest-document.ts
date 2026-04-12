/**
 * ingest_document -- Layer 2 Coordination
 *
 * Allows agents to push text/markdown content into a project's
 * knowledge base via the ingest_items table. Content is stored
 * inline (no file upload required).
 *
 * Ingested items start as 'unclassified' and can be classified
 * later through the UI or another tool.
 */

import { z } from 'zod'
import { getServiceClient } from '../db.js'

export const ingestDocumentSchema = {
  project_id: z.string().uuid().describe('Project UUID'),
  title: z.string().describe('Document title'),
  body: z.string().describe('Document content (text or markdown)'),
  source: z
    .string()
    .optional()
    .describe(
      'Source identifier (e.g. "mcp-agent", "research", "session-extract")',
    ),
  source_url: z.string().url().optional().describe('Source URL if applicable'),
  agent_id: z.string().optional().describe('Agent identifier if applicable'),
}

type IngestDocumentArgs = {
  project_id: string
  title: string
  body: string
  source?: string
  source_url?: string
  user_id: string
  agent_id?: string
}

export async function ingestDocument(args: IngestDocumentArgs) {
  const db = getServiceClient()
  const { project_id, title, body, source, source_url, user_id, agent_id } =
    args

  const { data: doc, error } = await db
    .from('ingest_items')
    .insert({
      project_id,
      title,
      body,
      source: source ?? (agent_id ? `agent:${agent_id}` : 'mcp'),
      source_url: source_url ?? null,
      classification: 'unclassified',
      created_by: user_id,
    })
    .select()
    .single()

  if (error || !doc) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              error: 'Failed to ingest document',
              detail: error?.message,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            action: 'ingest_document',
            document_id: doc.id,
            project_id,
            title,
            classification: 'unclassified',
            source: doc.source,
            body_length: body.length,
          },
          null,
          2,
        ),
      },
    ],
  }
}
