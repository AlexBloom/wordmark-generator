# Agent interface

This tool is deterministic typography software, not a prompt-to-image service. The same request object works through CLI, HTTP, and MCP. It reads fonts available to the local macOS process. It does not install fonts or change agent settings.

## Request / result

The canonical request schema is [request.schema.json](request.schema.json).

- `names`: required array of 1–8 nonempty strings, maximum 100 characters per name.
- `combine`: false alternates between names; true places every name in each lockup.
- `count`: 10, 50, 100, 250 (default 50).
- `fontDirectory`: optional recursive local directory. Omit to use system fonts.
- `fontFiles`: optional array of explicit TTF/OTF/TTC/OTC/DFONT paths.
- `fonts`: optional font IDs from discovery.
- `excludeFamilies`: family names to avoid, useful when continuing a previous batch.
- `seed`: 32-bit integer (default 9000).

Generation returns `schemaVersion`, `names`, `count`, `uniqueFamilies`, `seed`, `variants`, `boards`, `licensing`, `output`, `preview`, and `archive`. Each variant has a number, names, font family, PostScript font name, optional source path, treatment, and SVG/PNG filenames. Source font paths can be personal filesystem data: do not publish manifests without reviewing them. Font files are never bundled in an export.

The font inventory filters character coverage and deduplicates by family. Font formats with legacy symbol encodings may produce unusual glyph shapes despite successful coverage checks. Inspect rendered boards before choosing a final identity. Invalid or unreadable font files are skipped; a source with no compatible families returns an error. Different OS/font inventories can change results even with the same seed.

## CLI

```sh
node bin/wordmark.mjs generate --request /absolute/request.json --out /absolute/new-output-dir
node bin/wordmark.mjs generate --stdin < request.json
node bin/wordmark.mjs fonts --font-dir /absolute/fonts --name "Brand"
```

CLI success is JSON on stdout. Errors are JSON on stderr with a nonzero exit code. The supplied output directory must not already exist. Without `--out`, a unique directory under `.wordmark/outputs/` is used. ZIP is a sibling file. HTML can be opened directly or served by any local static server.

## HTTP

Start `node bin/wordmark.mjs serve --port 9000`. It binds to `127.0.0.1`. Browser requests from foreign origins/hosts are rejected. No authentication token is needed for local tools. Do not expose the port publicly.

| Method | Path | Contract |
| --- | --- | --- |
| GET | `/api/health` | Version and platform |
| POST | `/api/fonts` | Request → `{fonts: [{id, family, name, source?}]}` |
| POST | `/api/upload` | `{files: [{name, data: BASE64}]}` → `{fontFiles, count}` |
| POST | `/api/generate` | Request → 202 `{id, status, statusUrl}` |
| GET | `/api/jobs/:id` | Current session job status: `running`, `complete`, `failed` |
| POST | `/api/export` | `{id, numbers: [1,2]}` → selection SVG `url` and local `path` |
| POST | `/api/illustrator` | Same selection; opens generated SVG using the installed Illustrator app |
| GET | `/outputs/:id/:file` | Generated artifacts; add `?download` for attachment |
| GET | `/outputs/:id.zip` | ZIP download |

Only one generation runs at a time through HTTP; a second gets 409. Poll at a reasonable interval, e.g. 1–2 seconds. Jobs are remembered for the current server session, while exported files persist. The UI uploads fonts in batches; each request has a 48 MB limit and up to 100 files. Fonts are stored under `.wordmark/uploads` without global installation. There is no automatic deletion of user assets.

## MCP

`node bin/wordmark.mjs mcp` is a newline-delimited stdio JSON-RPC server using the MCP `2024-11-05` initialization handshake. Newer clients must support version fallback. No Streamable HTTP or modern stateless MCP transport is implemented in v1.

Tools: `generate_wordmarks` and `list_fonts`. Both use the shared schema. Tool failures return `isError: true`; protocol errors use JSON-RPC errors. Startup/build diagnostics stay off stdout. A generation can take several minutes for a large source; set the client's tool timeout accordingly.

## Agent skill and contributor handoff

The `skills/wordmark-generator/SKILL.md` package can be used by agents that support the standard skill-folder convention. `npm run install:skill` copies a self-contained runtime to the local skill installation. `AGENTS.md` is the cross-agent contributor entry point; `CLAUDE.md` imports it. No automatic third-party account connection is required.

Users are responsible for their own font licensing.
