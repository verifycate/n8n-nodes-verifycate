# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-10-30

### Changed

- Republish from GitHub Actions with npm provenance for n8n verification.
- Document the installation, verification, and trusted publishing flow.
- Add CI, npm, and license badges to the README.

## [0.1.0] - 2026-10-29

### Added

- `Verifycate` action node with Certificate, Certificate Issue, Recipient,
  Request, and Correction resources.
- `Verifycate Trigger` webhook node for every documented workspace event, with
  optional certificate scoping, HMAC-SHA256 signature verification, and full
  issue enrichment.
- `Verifycate API` credential with a workspace API key and optional base URL.
- Certificate resource locator and per-certificate attribute resource mapper.
- Simplified, Raw, and Selected Fields output modes.
- Generated operation map from the published OpenAPI document, with CI drift
  checks and a weekly spec sync workflow.
