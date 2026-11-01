#!/usr/bin/env node
// scripts/smoke-test-tarball.mjs — Smoke test of the packed npm tarball
//
// Packs the package, installs the tarball into an empty directory and starts
// the installed binary against a local mock of the Nexus API. Then runs the
// MCP handshake (initialize + tools/list) over stdio and checks that the
// server reports the package version and registers its tools.
//
// Catches packaging errors that unit tests cannot see: missing files in the
// tarball, a broken bin entry, unresolved runtime dependencies.
//
// Requires a prior `npm run build`. Usage: node scripts/smoke-test-tarball.mjs

import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const TIMEOUT_MS = 30_000
const MIN_TOOLS = 10

const tmp = mkdtempSync(join(tmpdir(), 'nexus-mcp-smoke-'))
let mock
let child

function cleanup() {
  child?.kill()
  mock?.close()
  rmSync(tmp, { recursive: true, force: true })
}

function fail(message) {
  console.error(`smoke-test: FAIL: ${message}`)
  cleanup()
  process.exit(1)
}

function npm(args, cwd) {
  return execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

// 1. Pack and install into an empty project
const packed = JSON.parse(npm(['pack', '--json', '--pack-destination', tmp], ROOT))
const tarball = join(tmp, packed[0].filename)
const app = join(tmp, 'app')
mkdirSync(app)
npm(['init', '-y'], app)
npm(['install', '--no-audit', '--no-fund', tarball], app)
const bin = join(app, 'node_modules', '.bin', 'nexus-mcp')
console.error(`smoke-test: installed ${packed[0].filename} (${packed[0].entryCount} files)`)

// 2. Mock Nexus API: identity resolves, everything else is 404 JSON
mock = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'GET' && req.url === '/api/mcp/identity') {
    res.end(
      JSON.stringify({
        userId: '00000000-0000-4000-8000-000000000001',
        email: null,
        displayName: 'smoke-test',
        isPlatformAdmin: false,
        isPlatformOwner: false,
        tenantId: null,
        memberships: [],
        agentAssignments: [],
      }),
    )
    return
  }
  res.statusCode = 404
  res.end(JSON.stringify({ error: 'not found' }))
})
await new Promise((ok) => mock.listen(0, '127.0.0.1', ok))
const apiUrl = `http://127.0.0.1:${mock.address().port}`

// 3. Start the installed binary and run the MCP handshake over stdio
child = spawn(bin, [], {
  cwd: app,
  env: {
    PATH: process.env.PATH,
    NEXUS_API_URL: apiUrl,
    NEXUS_PRIVATE_TOKEN: 'nxs_pat_smoke-test-placeholder',
  },
  stdio: ['pipe', 'pipe', 'inherit'],
})
child.on('exit', (code) => fail(`server exited early with code ${code}`))

const timer = setTimeout(() => fail(`no complete handshake within ${TIMEOUT_MS} ms`), TIMEOUT_MS)
const pending = new Map()
let buffer = ''
child.stdout.on('data', (chunk) => {
  buffer += chunk
  let nl
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim()
    buffer = buffer.slice(nl + 1)
    if (!line) continue
    const msg = JSON.parse(line)
    pending.get(msg.id)?.(msg)
    pending.delete(msg.id)
  }
})

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`)
}

function request(id, method, params = {}) {
  return new Promise((ok) => {
    pending.set(id, ok)
    send({ jsonrpc: '2.0', id, method, params })
  })
}

const init = await request(1, 'initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'smoke-test', version: '0.0.0' },
})
if (init.error) fail(`initialize returned an error: ${JSON.stringify(init.error)}`)
const serverVersion = init.result?.serverInfo?.version
if (serverVersion !== PKG.version) {
  fail(`serverInfo.version is ${serverVersion}, expected ${PKG.version}`)
}
send({ jsonrpc: '2.0', method: 'notifications/initialized' })

const list = await request(2, 'tools/list')
if (list.error) fail(`tools/list returned an error: ${JSON.stringify(list.error)}`)
const tools = list.result?.tools ?? []
if (tools.length < MIN_TOOLS) fail(`tools/list returned ${tools.length} tools, expected >= ${MIN_TOOLS}`)

clearTimeout(timer)
child.removeAllListeners('exit')
console.error(`smoke-test: OK: ${PKG.name}@${serverVersion}, ${tools.length} tools`)
cleanup()
