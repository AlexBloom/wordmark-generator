---
name: wordmark-generator
description: "the v1 of your wordmark 9000x faster. Generate 10, 50, 100, or 250 wordmark lockups from brand names using system fonts or a local font directory; export HTML previews, outlined SVGs, PNGs, and rendered boards."
---

# Wordmark Generator

Use this skill for font-based brand-name explorations and wordmark lockups. Rendering requires macOS, Node 22+, and Xcode Command Line Tools (Swift). This uses real local fonts, not generated font approximations.

Run `node scripts/run.mjs` relative to this skill folder. Run `--help` for available commands.

- Interactive: `node scripts/run.mjs serve --port 9000`, then open `http://127.0.0.1:9000`.
- Agent/headless: pass a request JSON file with `generate --request /absolute/request.json --out /absolute/new-output-folder`. The output folder must not already exist. Success returns JSON on stdout; errors return nonzero status and JSON on stderr.
- Font discovery: `fonts --name "Brand"`, optionally `--font-dir /absolute/font-folder`.

Request shape:

```json
{
  "names": ["Brand", "Studio"],
  "combine": true,
  "count": 50,
  "seed": 9000,
  "fontDirectory": "/absolute/font-folder",
  "excludeFamilies": []
}
```

Omit `fontDirectory` to use system fonts. `names` accepts 1–8 names. `combine: true` places all names in every lockup; false explores the names separately. `count` is one of 10, 50, 100, 250. An optional `fontFiles` array accepts individual font paths. An optional `fonts` array limits generation to font IDs returned by discovery. `excludeFamilies` avoids earlier families; use the manifest from a previous run. When fewer families are available than lockups requested, treatments reuse families; report `uniqueFamilies` honestly.

Use the user’s spelling and capitalization. Respect their requested font directory; do not install fonts globally. Validate the output count and inspect rendered boards before delivering. Return the standalone HTML preview, ZIP, and relevant boards. SVG lettering is outlined and does not require the font to view. Figma handoff uses SVG import or the included development plugin; Illustrator uses SVG import or the local app’s open action. Do not claim a remote design document was updated unless that action was separately performed.

Users are responsible for their own font licensing. Exports do not include font files. No GitHub upload, publishing, or messages to other people are implied by using this skill.
