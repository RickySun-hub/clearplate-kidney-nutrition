# REA installation and public recipe behavior review

REA was absent from PATH; the global npm location was also absent. The official https://github.com/morluto/rea README explicitly identifies the npm package `rea-agents`. Registry metadata for version 6.5.0 points to `git+https://github.com/morluto/rea.git` and declares `rea` / `rea-agents` CLI binaries.

Installed exact registry version **rea-agents@6.5.0** under `/workspace/tools/rea-cli`, outside the application repository. The isolated package.json and package-lock pin it. Install used the public npm registry with lifecycle scripts disabled; no GitHub shell scripts were run. CLI help started successfully and reported `rea@6.5.0`. No `setup`, MCP registration, persistent agent configuration, credentials, or production changes were used. CLI execution received a minimal environment without inherited credentials.

Registry tarball integrity:
`sha512-C6BG7LyrAdR74mSjertM6PrxJkcNZ2bfQNOJornPo9erDEp2tyPRVYPnV5Yodr+1RqewCQla68WulXlVnveD+A==`

## Public observations

Sources:
- https://support.cronometer.com/hc/en-us/articles/360018510311-Create-Custom-Recipe
- https://support.cronometer.com/hc/en-us/articles/4406291608724-Set-Cooked-Recipe-Weight

The public recipe guide describes combining chosen ingredient records into a named reusable recipe, choosing equal servings or weight-based portions, reviewing imperfect ingredient matches, then saving for later diary entry. The cooked-weight guide places this option in Advanced Info and explains that changing cooked weight changes portion scaling while non-water nutrients stay unchanged.

Nepholio uses those general behaviors with its own UI, USDA records, independent calculations, explicit unknowns, and immutable log snapshots. Its simplified description-first entry, collapsed nutrient review, and visible incomplete-data warnings are product choices, not claims about Cronometer's private behavior. Nepholio permits explicitly incomplete records; it does not claim to duplicate Cronometer's import validation.

## Limits

Official help pages were readable through the web research tool. A fresh local browser's direct visit to the public cooked-weight page failed with `net::ERR_TUNNEL_CONNECTION_FAILED`. No proxy/access-control bypass was attempted. REA's CLI was verified locally, but there is no successful interactive Cronometer capture or end-to-end application verification. No account/login, proprietary JavaScript extraction, private API, food database copying, recipe/image copying, or binary analysis was performed. Native analysis providers and lifecycle-script-dependent components were not installed or verified; this is a CLI-only installation.

REA `list-browser-targets` also succeeded against the fresh loopback CDP browser with the exact allowed origin `https://support.cronometer.com` (evidence `ev_a81e417d4f2ada35410717de3444d3af1490712017d4872daf1bf33b1778c1de`). This proves browser target discovery only: the target URL existed, but the page navigation failed. The result is retained at `/workspace/tools/rea-cli/rea-public-browser-check.json`. The temporary browser was closed after the check.
