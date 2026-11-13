# Status

Updated: 2026-11-12, America/New_York. Built directly on Alex's Mac.

Repository: https://github.com/AlexBloom/wordmark-generator (public). Source and workflows are pushed on main and dev. dev is the default development branch; main requires a PR and blocks force-push/deletion. GitHub security updates and vulnerability alerts are enabled. The initial OAuth workflow-scope blocker is resolved.

Working v1: native font renderer, local drag-and-drop GUI, all four output scales, name combinations, font inventory, SVG/PNG/contact-sheet/HTML/ZIP exports, shortlisting, Illustrator open action, Figma export/import plugin, portable skill, CLI/JSON/HTTP/MCP interfaces, and manual generation workflow.

Local validation: five integration tests pass, including all four quantities through 250, output integrity, reproducibility, upload/font-directory discovery, selection export, origin rejection, missing-file response, installed skill launcher, and MCP discovery. Skill frontmatter is validated. Browser verification: generated ten real lockups, opened the selected-SVG Figma handoff dialog, uploaded a system font through the file picker, and generated from that upload. Figma canvas import and Illustrator launching require those apps and are not claimed as verified here.

Preview: http://127.0.0.1:9000, health endpoint verified. Start/restart with `npm start` from this repository. Runtime files: .wordmark/. Source compilation cache: .cache/.

Installed skill: /Users/alexbloom/.codex/skills/wordmark-generator, self-contained launcher verified. VS Code CLI is unavailable; project files can be opened manually in an editor.

Hosted verification: Checks passed on both main and dev. Manual generation run 43342938288 passed, and its uploaded artifact was downloaded and verified: ten SVGs, ten PNGs, a standalone HTML preview, rendered board, manifest, CSV, and ZIP. No production website is deployed.
