# Status

Updated: 2026-11-12, America/New_York. Built directly on Alex's Mac.

Working v1 implemented: native font renderer, local drag-and-drop GUI, all four output scales, name combinations, font inventory, SVG/PNG/contact-sheet/HTML/ZIP exports, shortlisting, Illustrator open action, Figma export/import plugin, portable skill, CLI/JSON/HTTP/MCP interfaces, and manual generation workflow.

Local tests: five integration tests pass, including all four quantities through 250, output integrity, reproducibility, upload/font-directory discovery, selection export, origin rejection, missing-file response, installed skill launcher, and MCP discovery. Browser verification: generated ten real lockups and opened the selected-SVG Figma handoff dialog. Figma canvas import and Illustrator launching require those apps and are not claimed as verified here.

Preview: http://127.0.0.1:9000. Start/restart with `npm start` from this repository. Runtime files: .wordmark/. Source compilation cache: .cache/.

GitHub creation, branches, protection, and hosted CI are being finalized. No production website is deployed. VS Code CLI is unavailable on this Mac; project files can be opened manually in an editor.
