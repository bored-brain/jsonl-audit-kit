# Changelog

All notable changes to `jsonl-audit-kit` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

## [0.1.0] — Initial Release

### Added

- **Streaming JSONL auditing** via `auditFile()` and `auditStream()` using
  `node:readline` — files are never fully loaded into memory.
- **Per-line validation** with 1-based line numbers preserved throughout.
- **Configurable validation rules:**
  - `requireObject` — require every record to be a JSON object.
  - `requireArray` — require every record to be a JSON array.
  - `requiredKeys` — require specific top-level keys to be present.
  - `reportBlankLines` — optionally treat blank lines as errors.
  - `maxLineBytes` — flag lines that exceed a byte-length limit.
- **Bounded diagnostics:** `maxErrors` controls how many errors are stored
  while the full error count is always tracked separately.
- **Diagnostic types:** `INVALID_JSON`, `BLANK_LINE`, `NOT_AN_OBJECT`,
  `NOT_AN_ARRAY`, `MISSING_KEY`, `LINE_TOO_LONG`.
- **CLI (`jsonl-audit`)** with:
  - File path and stdin (`-`) input.
  - Human-readable and `--json` machine-readable output.
  - Exit codes: 0 (valid), 1 (invalid), 2 (operational error).
  - `--require-object`, `--require-array`, `--required`, `--report-blank-lines`,
    `--max-errors`, `--max-line-bytes` flags.
  - `--help` / `-h` and `--version` / `-v`.
- **TypeScript declarations** in `types/index.d.ts`.
- **Zero runtime dependencies** — only Node.js built-in modules used.
- **Node.js ≥ 20** support.
- Full automated test suite using `node:test` and `node:assert`.
- API documentation, design-decisions document, and ecosystem research notes.
- Example JSONL files and runnable usage script.
- GitHub Actions CI workflow for Node.js 20, 22, and 24.
