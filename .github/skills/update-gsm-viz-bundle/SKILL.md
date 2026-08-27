---
name: update-gsm-viz-bundle
description: Replace the vendored gsm.viz bundle from an official release tag or an explicit development commit, re-verify the mirrored upstream contracts, and update every package reference and regression pin.
---
# Update the gsm.viz bundle
Use this skill when upgrading the gsm.viz assets vendored by `gsm.vizr`.

`gsm.vizr` is the canonical home for the bundle: downstream packages consume it through `html_dependency_gsm_viz()` and the widgets rather than vendoring their own copy. Two consequences shape this workflow:
- A bump is a **release event**, not a local change. It is not delivered until the release flow below has run.
- `gsm.vizr` **mirrors upstream behaviour in R** — validation messages, the hook allowlist, the `chart.helpers` signatures, the event contract. Those mirrors can rot silently on a bump, because the test suite asserts *our* behaviour, not upstream's. Re-verifying them is a required step, not a courtesy.
## Inputs
- Required: target version as `X.Y.Z` (without `v`).
- Optional: upstream repository; default to `Gilead-Public/gsm.viz`.
- Optional: upstream commit SHA, abbreviated to at least 7 characters or full-length. Supplying it selects development mode; omitting it selects release mode.
- Development mode only: a numeric manifest version accepted by R's `package_version()`, such as `2.4.1-550`.
Set `VERSION` and `UPSTREAM`. In release mode, set `TAG="v${VERSION}"`. In development mode, set `COMMIT_REF` and `MANIFEST_VERSION`; verification below derives the canonical `SOURCE_SHA` and `SHORT_SHA`. Do not infer an input from a branch, PR, package manifest, or directory name.
## Safety gates
1. Read `AGENTS.md`, inspect `git status`, and do not overwrite unrelated changes.
2. Run the repository's baseline and stop if it fails:
   ```sh
   Rscript -e 'devtools::test(reporter = "check")'
   npm --prefix tests/playwright test
   ```
   Do not pass `--vanilla`: the project profile activates `renv`, and skipping it resolves packages against the wrong library.
3. Select and verify exactly one source mode:
   - **Release mode:** verify the exact release with GitHub CLI:
     ```sh
     gh release view "$TAG" --repo "$UPSTREAM" \
       --json tagName,isDraft,isPrerelease,publishedAt,url
     SOURCE_SHA="$(gh api "repos/$UPSTREAM/commits/$TAG" --jq .sha)"
     ```
     Continue only when `tagName` equals `TAG`, `isDraft` and `isPrerelease` are both false, and the release is published.
   - **Development mode:** require `COMMIT_REF` to match `^[0-9a-fA-F]{7,40}$`, then resolve it to one canonical commit:
     ```sh
     SOURCE_SHA="$(gh api "repos/$UPSTREAM/commits/$COMMIT_REF" --jq .sha)"
     test "$(printf '%s' "$SOURCE_SHA" | cut -c1-${#COMMIT_REF})" = \
       "$(printf '%s' "$COMMIT_REF" | tr '[:upper:]' '[:lower:]')"
     SHORT_SHA="$(printf '%s' "$SOURCE_SHA" | cut -c1-7)"
     Rscript -e "package_version('$MANIFEST_VERSION')"
     ```
     Stop if GitHub cannot resolve the abbreviation uniquely or the resolved SHA does not have the requested prefix. A branch name, PR number/head, non-hex reference, or workflow artifact is not an acceptable substitute. Development mode is provisional: it must never be released, and downstream repos must never be pointed at it.
4. Record the source mode, `VERSION`, `SOURCE_SHA`, upstream repository, and asset checksums in the change description. In release mode also record `TAG` and release URL. Stop if the selected source cannot be resolved exactly; in release mode also stop for an absent, draft, or prerelease release.
## Inspect before editing
Discover the current state; do not assume today's pin list is complete:
```sh
find inst/htmlwidgets/lib -maxdepth 1 -type d -name 'gsm.viz-*' -print
grep -rn 'name:\s*gsmViz\|gsm\.viz-\|gsmViz' inst tests R .github \
  --exclude-dir=node_modules --exclude-dir=fixture
git log --oneline --all -- inst/htmlwidgets/lib 'inst/htmlwidgets/*.yaml'
```
The search is the authority. The known pins are:
- `inst/htmlwidgets/bars.yaml` — the `version:` and `src:` of the single `gsmViz` dependency
- `R/dependency.R` — the `version` and bundle directory in `html_dependency_gsm_viz()`
- `tests/testthat/test-vendored-bundle.R` — the exact directory name, asserted twice
- `tests/testthat/test-dependency.R` — asserts the dependency version, that its files resolve, and that the directory name equals `paste0("gsm.viz-", version)`
- `tests/testthat/test-shiny.R` — asserts the version of the dependency `barsOutput()` carries
- `DESCRIPTION` — `Version` (see the version rule below)
- `tests/playwright/bundle-exports.spec.js` — resolves the bundle by glob rather than pinning, but asserts required exports and source markers
- `tests/playwright/gallery-fingerprint.spec.js` — the structural fingerprint baseline, which drifts if upstream changes rendering
## Re-verify the mirrored upstream contracts
Four surfaces in `gsm.vizr` encode upstream behaviour. Nothing in the suite detects them drifting, because every test asserts what `gsm.vizr` does. Diff each against the new source before validating, and treat any change as in scope for this bump:

1. **Validation mirrors.** `R/bars_spec.R` ports `src/bars/validateSpec.js` and `src/facetBars/validateSpec.js` message-for-message and in upstream's order. Re-read both and reconcile added, removed, or reworded branches, then update the provenance comments naming the mirrored version.
   ```sh
   git -C "$TMP/gsm.viz" diff --stat "$PREVIOUS_SHA" HEAD -- \
     src/bars/validateSpec.js src/facetBars/validateSpec.js
   ```
   Sanctioned divergences to preserve: 1-based `referenceLines[i]` indices, the `data` checks living in `bars()`, and upstream's missing `spec.` prefix on `scales.fill.colors must be a plain object`.
2. **Hook allowlist.** `.JS_SLOTS` in `R/js_hook.R` lists the function-valued spec slots the binding revives. A new upstream function slot is unusable from R until it is added here; a removed one silently stops working.
3. **Proxy verb signatures.** `inst/htmlwidgets/bars.js` calls six `chart.helpers` functions positionally with `chart` first, and passes `options._silent`. Confirm the signatures and the option key in `src/bars/updateData.js`, `updateSpec.js`, `exportImage.js`, and `selection.js`. A helper that becomes pre-bound, gains a parameter, or renames `_silent` breaks every proxy verb without a test failing.
4. **Event contract.** The `gsm-viz-select` glue forwards `point._datum`, whose shape follows `stat` (the aggregated rows array under `count`, the single row under `identity`), and treats `position: "fill"` as normalizing to `{position: "stack", stat: "percent"}`. Both are upstream internals that the documented event contract depends on; re-confirm them in `src/bars/structureData/` and re-read the vignette's event-contract section if either moved.
## Source the assets
Work in a temporary checkout of the verified immutable source. Resolve its `HEAD` and require it to equal `SOURCE_SHA`.
```sh
TMP="$(mktemp -d)"
git init "$TMP/gsm.viz"
git -C "$TMP/gsm.viz" remote add origin "https://github.com/$UPSTREAM.git"
git -C "$TMP/gsm.viz" fetch --depth 1 origin "$SOURCE_SHA"
git -C "$TMP/gsm.viz" checkout --detach FETCH_HEAD
test "$(git -C "$TMP/gsm.viz" rev-parse HEAD)" = "$SOURCE_SHA"
```
Obtain `index.js` and `index.js.map` only from that checkout:
- Prefer the files committed at the verified source.
- If either is not committed, run `npm ci` and the upstream bundle command from that checkout (normally `npm run bundle`). Use the lockfile and build scripts from the same verified source; do not substitute newer dependencies or tooling.
- Stop if the build is not lockfile-based, fails, omits the source map, or cannot be reproduced from the verified source.
Create a fresh staging directory and copy those two files into it:
- release mode: `gsm.viz-${VERSION}`
- development mode: `gsm.viz-${MANIFEST_VERSION}`

**The directory name always equals `gsm.viz-` plus the version the dependency declares**, in both modes — `tests/testthat/test-dependency.R` asserts exactly that coupling, and it is what keeps a provisional bundle from being served under a version string that does not name it. The source SHA is recorded in the `PROVISIONAL` comment, not in the directory name.

Copy the required `main.css` unchanged from the current vendored bundle because gsm.viz does not publish that package integration stylesheet; compare its SHA-256 before and after copying. Do not rename an old/provisional directory or reuse its JavaScript artifacts.

Verify all three staged files are non-empty, `index.js.map` parses as JSON, and the bundle/source map identify no unexpected local paths. Capture SHA-256 checksums. Remove the temporary checkout when finished.
## Replace and repoint
1. Replace the existing bundle directory with the staged directory in one change. Do not add alongside it.
2. Update the `gsmViz` dependency in `inst/htmlwidgets/bars.yaml`:
   - release mode: `version: ${VERSION}` and `src: htmlwidgets/lib/gsm.viz-${VERSION}`
   - development mode: `version: ${MANIFEST_VERSION}` and `src: htmlwidgets/lib/gsm.viz-${MANIFEST_VERSION}`
   - retain `script: index.js` and `stylesheet: main.css`
3. Update `html_dependency_gsm_viz()` in `R/dependency.R` in the same change: its `version` and bundle directory must match `bars.yaml` exactly. Downstream packages consume the bundle through that function, so a mismatch serves new assets under a stale cache key.
4. Update all exact test pins to the selected manifest version and directory.
5. **Bump `gsm.vizr` itself.** `gsm.vizr`'s minor version tracks the bundled gsm.viz minor: an upstream minor bump (`2.4.x` → `2.5.0`) is a `gsm.vizr` minor bump, an upstream patch is a `gsm.vizr` patch. Update `DESCRIPTION` `Version` and add a `NEWS.md` entry naming the bundled version, the upstream changes that affect the R surface, and any mirrored-contract change from the section above. A development-mode bundle takes a `.9000`-style development version and must not take a release version.
6. Remove obsolete bundle directories, version strings, and source references. In release mode, remove all PR-head SHAs and provisional comments. In development mode, replace stale provisional references and add a concise `PROVISIONAL` comment to the exact bundle pin stating `SOURCE_SHA` and that a release-tag rebuild is required before merge/release. Search again rather than relying on today's filenames:
   ```sh
   find inst/htmlwidgets/lib -maxdepth 1 -type d -name 'gsm.viz-*' -print
   grep -rn 'gsm\.viz-\|pr[0-9]\+\|PROVISIONAL\|name:\s*gsmViz' inst tests R .github \
     --exclude-dir=node_modules --exclude-dir=fixture
   ```
Exactly one `gsm.viz-*` directory must remain, and every manifest and exact pin must reference it.
## Validate
Run the focused safeguards, then package and browser regressions:
```sh
Rscript -e 'devtools::test(filter = "vendored-bundle", reporter = "check")'
Rscript -e 'devtools::test(reporter = "check")'
Rscript -e 'devtools::check(error_on = "note")'
npm --prefix tests/playwright ci
npm --prefix tests/playwright test
npm --prefix tests/playwright run test:shiny
```
`npm test` re-renders the gallery fixture through its `pretest` script, so the browser specs always run against freshly generated HTML rather than a stale fixture. Run the Shiny suite too: it is the only coverage of the proxy handler and the `chart.helpers` signatures re-verified above.

Do not refresh the structural baseline merely to make failures pass. `gallery-fingerprint.spec.js` checks the chart-ID manifest **before** it writes or compares a baseline, so a capture cannot bless a gallery that stopped rendering; inspect and explain intentional rendering changes first, then recapture with `CAPTURE_BASELINE=1` and review the diff hunk by hunk.

Review `git diff --check`, `git status --short`, the complete diff, the single-directory invariant, and all remaining `gsm.viz` references. Stop instead of completing the upgrade if provenance is uncertain, required exports disappear, a widget throws, fingerprints drift without an understood cause, R checks warn/error, a mirrored contract changed without a corresponding R change, or stale provisional references remain.
## Release
A bump is not delivered when the tests pass. Downstream packages consume `gsm.vizr` by released tag, so finish the release flow before treating the upgrade as available: merge to the integration branch, open the release PR to the default branch, tag the merged commit explicitly (never let `gh release create` invent a tag from whichever branch is default), and confirm the registered version in `gsm.library` still resolves.

Never release a development-mode bundle: repeat this workflow in release mode from the official tag first. A provisional bundle that reaches a tag propagates to every downstream consumer.
