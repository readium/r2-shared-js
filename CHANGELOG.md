# Next

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.30...develop

Changes:
* TODO

# 1.0.30

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM package updates
* Additional file extensions for Readium audiobooks

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.30/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.30/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.30

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.29...v1.0.30

# 1.0.29

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM package updates
* LCP audiobook support (parsing)
* Cson2Json build script fix

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.29/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.29/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.29

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.28...v1.0.29

# 1.0.28

> Build environment: NodeJS `12.16.1`, NPM `6.14.4`

Changes:
* NPM package updates
* camel case pageList JSON property with support for legacy page-list
* fixes incorrect path in zipHasEntry (fallback to raw authored path, potentially percent-escaped), and replaced console.log() with debug().
* added resource URL to transformer parameter
* HTML transformer should not contains FXL vs. reflow heuristics (FXL audio/video patch)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.28/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.28/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.28

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.27...v1.0.28

# 1.0.27

> Build environment: NodeJS `12.16.1`, NPM `6.14.3`

Changes:
* NPM package updates
* EPUB parser: added support for epub:type "roles" when handling links from TOC, landmarks, pagelist, etc.
* BCP47 language code "und" for unknown locale (metadata contributors/authors, (sub)title)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.27/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.27/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.27

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.26...v1.0.27

# 1.0.26

> Build environment: NodeJS `12.16.1`, NPM `6.13.7`

Changes:
* NPM package updates
* Fixed bug with decodeURIComponent for link.Href parsing (syntax normalization)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.26/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.26/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.26

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.25...v1.0.26

# 1.0.25

> Build environment: NodeJS `12.15.0`, NPM `6.13.7`

Changes:
* NPM package updates
* Minor Typescript fixes: typing for XPath Select, and removed rogue "any"
* Content transformers now pass "session info" semantic-agnostic data (serialized string) so that anonymous HTTP requests can be correlated with specific publications and with their reading session (multiple readers scenario). Also see changes in streamer, and of course navigator.
* Support for AudioBook parsing, local-packed (zipped), local-exploded (unzipped), and remote-exploded.

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.25/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.25/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.25

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.24...v1.0.25

# 1.0.24

> Build environment: NodeJS `12.13.0`, NPM `6.13.0`

Changes:
* NPM package updates
* TAJSON now parses/generates arbitrary JSON properties with typed object

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.24/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.24/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.24

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.23...v1.0.24

# 1.0.23

> Build environment: NodeJS `12.13.0`, NPM `6.12.0`

Changes:
* EPUB parser: improved support for percent-encoded URLs, with ZIP entry filename fallback on errors (edge case handling)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.23/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.23/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.23

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.22...v1.0.23

# 1.0.22

> Build environment: NodeJS `12.13.0`, NPM `6.12.0`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.22/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.22/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.22

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.21...v1.0.22

# 1.0.21

> Build environment: NodeJS `10.16.3`, NPM `6.12.0`

Changes:
* EPUB parser fix: title/etc. language map with full xml:lang support (local element and root OPF package)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.21/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.21/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.21

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.20...v1.0.21

# 1.0.20

> Build environment: NodeJS `10.16.3`, NPM `6.12.0`

Changes:
* EPUB parser fixes: added support for file-as/sort-as in Contributor, added language map support for Subject, added "_" default language fallback for object map that already has metadata refines.

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.20/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.20/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.20

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.19...v1.0.20

# 1.0.19

> Build environment: NodeJS `10.16.3`, NPM `6.12.0`

Changes:
* NPM updates (including NodeJS v12 for Electron v6)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.19/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.19/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.19

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.18...v1.0.19

# 1.0.18

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.18/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.18/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.18

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.17...v1.0.18

# 1.0.17

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* NPM updates
* TypeScript sort imports

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.17/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.17/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.17

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.16...v1.0.17

# 1.0.16

> Build environment: NodeJS `10.16.3`, NPM `6.11.3`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.16/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.16/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.16

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.15...v1.0.16

# 1.0.15

> Build environment: NodeJS `10.16.0`, NPM `6.10.2`

Changes:
* support for publications without resources (but with valid spine items, navdoc, etc.)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.15/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.15/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.15

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.14...v1.0.15

# 1.0.14

> Build environment: NodeJS `10.16.0`, NPM `6.10.2`

Changes:
* NPM updates
* Buffer.from() API to remove deprecation messages

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.14/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.14/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.14

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.13...v1.0.14

# 1.0.13

> Build environment: NodeJS `10.16.0`, NPM `6.9.0`

Changes:
* NPM updates (notable: Ava unit tests)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.13/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.13/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.13

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.12...v1.0.13

# 1.0.12

> Build environment: NodeJS `10.15.3`, NPM `6.9.0`

Changes:
* When no `page-progression-direction` is specified on EPUB spine, check the `dc:language` to enforce RTL if necessary (matches `dir="rtl"` injection logic, which occurs on a per-document basis)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.12/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.12/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.12

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.11...v1.0.12

# 1.0.11

> Build environment: NodeJS `10.15.3`, NPM `6.9.0`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.11/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.11/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.11

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.10...v1.0.11

# 1.0.10

> Build environment: NodeJS `8.15.1`, NPM `6.4.1`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.10/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.10/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.10

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.9...v1.0.10

# 1.0.9

> Build environment: NodeJS `8.15.1`, NPM `6.4.1`

Changes:
* Added EPUB subtitle parsing
* Added string enums for publication metadata
* Support for iBooks and Kobo display-options EPUB metadata (META-INF XML)
* Support for Adobe page map
* Added Locator JSON-Schema references

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.9/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.9/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.9

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.8...v1.0.9

# 1.0.8

> Build environment: NodeJS `8.15.1`, NPM `6.4.1`

Changes:
* NPM updates
* JSON Schema reference updates
* NodeTS (TypeScript) unit test runner

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.8/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.8/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.8

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.7...v1.0.8

# 1.0.7

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.7/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.7/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.7

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.6...v1.0.7

# 1.0.6

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Reviewed and annotated the data models based on the most current JSON Schema
* Added fallback mechanism for (de)serialization to/from legacy (since renamed) JSON dictionary keys (e.g. `sort_as`, `belongs_to`, `direction`, `spine`)
* Minor NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.6/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.6/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.6

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.5...v1.0.6

# 1.0.5

> Build environment: NodeJS `8.14.1`, NPM `6.4.1`

Changes:
* Updated documentation (minor)
* NPM 6.5.* has regression bugs for global package installs, so revert back to NPM 6.4.1 (which is officially shipped with the NodeJS installer).

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.5/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.5/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.5

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.4...v1.0.5

# 1.0.4

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* NPM updates

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.4/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.4/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.4

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.3...v1.0.4

# 1.0.3

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* NPM updates (r2-xxx-js)
* Support for remote HTTP exploded publications

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.3/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.3/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.3

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.2...v1.0.3

# 1.0.2

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* Fixed EPUB detection and adapted CLI + publication parser (matrix: local vs. remote, exploded vs. packed)
* NPM updates (minor)
* Replaced deprecated RawGit URLs
* Improved Ava unit test setup

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.2/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.2/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.2

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.1...v1.0.2

# 1.0.1

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* Chainable transforms for HTML now configurable via constructor (function pointer)
* Minor import aliases change

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.1/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.1/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.1

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.0...v1.0.1

# 1.0.0

> Build environment: NodeJS `8.14.0`, NPM `6.5.0`

Changes:
* EPUB - ReadiumWebPubManifest converter CLI (demo)
* Chainable transforms (content filters)
* Sample HTML transform (will evolve into ReadiumCSS injector for navigator)
* Locator model
* NPM updates (minor)
* README info
* VisualStudio code tweaks (developer workflow)
* Semantic versioning bump 1.*.* (3-digit style now, "-alphaX" suffix caused issues with NPM tooling: updates, lockfile, etc.)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.0/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.0/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.0

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.0-alpha.6...v1.0.0

# 1.0.0-alpha.6

> Build environment: NodeJS `8.12.0`, NPM `6.4.1`

Changes:
* NPM updates (minor)
* Git revision JSON info now includes NodeJS and NPM version (build environment)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.0-alpha.6/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.0-alpha.6/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.0-alpha.6

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.0-alpha.5...v1.0.0-alpha.6

# 1.0.0-alpha.5

Changes:
* Dependency "ta-json" GitHub semver dependency becomes "ta-json-x" NPM package (fixes https://github.com/readium/r2-testapp-js/issues/10 )
* Removed TypeScript linter warning message (checks for no unused variables)
* NPM updates related to the Node TypeScript typings

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.0-alpha.5/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.0-alpha.5/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.0-alpha.5

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.0-alpha.4...v1.0.0-alpha.5

# 1.0.0-alpha.4

Changes:
* NPM updates (external deps)

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.0-alpha.4/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.0-alpha.4/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.0-alpha.4

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.0-alpha.3...v1.0.0-alpha.4

# 1.0.0-alpha.3

Changes:
* correct version in `package-lock.json`

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.0-alpha.3/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.0-alpha.3/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.0-alpha.3

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.0-alpha.2...v1.0.0-alpha.3

# 1.0.0-alpha.2

Changes (NPM updates):
* `@types/node`
* `r2-utils-js`
* `r2-lcp-js`

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.0-alpha.2/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.0-alpha.2/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.0-alpha.2

Git diff:
* https://github.com/readium/r2-shared-js/compare/v1.0.0-alpha.1...v1.0.0-alpha.2

# 1.0.0-alpha.1

Changes:
* initial NPM publish

Git revision info:
* https://unpkg.com/r2-shared-js@1.0.0-alpha.1/dist/gitrev.json
* https://github.com/edrlab/r2-shared-js-dist/blob/v1.0.0-alpha.1/dist/gitrev.json

Git commit history:
* https://github.com/readium/r2-shared-js/commits/v1.0.0-alpha.1

Git diff:
* initial NPM publish
