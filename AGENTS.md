# Wordmark Generator — agent handoff

Read PROJECT.md and STATUS.md first. This repository is usable by any coding agent; no conversation-specific state is required. CLAUDE.md imports this file.

## Commands

- Install: `npm ci --ignore-scripts` (no package dependencies)
- Build: `npm run build` (macOS + Swift)
- Syntax checks: `npm run check`
- Tests: `npm test`
- Preview: `npm start` → http://127.0.0.1:9000
- Skill installer: `npm run install:skill`
- Headless use: `node bin/wordmark.mjs generate --request request.json --out output/new-run`

## Structure

- engine/Renderer.swift: real-font shaping, outlined SVG, PNG, rendered boards
- lib/core.mjs: shared request validation, build/runtime, preview/ZIP packaging
- lib/server.mjs: loopback-only local HTTP API
- lib/mcp.mjs: legacy MCP stdio tool transport
- bin/wordmark.mjs: CLI
- web/: dependency-free web app
- skills/wordmark-generator/: portable skill and runtime launcher
- figma-plugin/: optional SVG importer, no network
- docs/AGENT_API.md and docs/request.schema.json: interoperability contract

## Invariants

Preserve user text. Never install fonts globally. Do not bundle source fonts. Render real outlines instead of approximating fonts with generated imagery. Never overwrite a generation directory. Report uniqueFamilies separately from count; family reuse is expected with small inventories. Keep subprocess arguments structured and user input out of shell commands. Keep stdout machine-readable in CLI/MCP mode. SVGs use path outlines; escape all text used in HTML/CSV. The local server must remain loopback-only and reject foreign origins and Host headers. Do not add telemetry or cloud uploads implicitly.

Font licensing is the user's responsibility. Keep the disclaimer in the UI, README, and exports. The software's MIT license does not license fonts.

Work on dev or a branch off dev. main is protected and updated via PR. Do not release or deploy publicly unless the user explicitly requests it. Never commit secrets, font files, uploads, local paths from user font catalogs, or generated private brand work. Ignore .wordmark/ and .cache/. Do not discard someone else's changes. Update STATUS.md when infrastructure, CI, or preview setup changes.
