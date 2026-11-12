# Wordmark Generator

Description: the v1 of your wordmark 9000x faster

Purpose: turn one or multiple brand names into 10, 50, 100, or 250 real-font wordmark lockups using installed fonts or a directory of fonts. Users can browse a local drag-and-drop GUI, shortlist, export HTML/SVG/PNG/contact sheets/ZIP, and import vector artwork into Figma or Illustrator.

Platform: local macOS application, portable agent skill, CLI/JSON, loopback HTTP API, and stdio MCP. GitHub Actions runs on macOS and creates downloadable artifacts. Node 22+ plus Swift/CoreText/CoreGraphics; no npm runtime dependencies. The rendering engine intentionally stays macOS-specific in v1 to match native font behavior. The UI uses ordinary HTML/CSS/JavaScript because a single local tool does not need a framework or external build chain.

Repository: AlexBloom/wordmark-generator, public. dev is development/default; main is protected. No production deployment or domain is requested. The macOS runner uses its own system fonts unless the workflow is given a licensed repository font directory.

Implementation scope: full working v1, not just scaffolding, as explicitly requested. App, engine, exports, skill, CLI/API/MCP, Figma import plugin, documentation, tests and workflows are included. Potential later work: Windows/Linux rendering backend, modern MCP transports, font-classification presets, live design-document integrations. Those are not promised as part of v1.
