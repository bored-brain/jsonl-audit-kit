# Research: JSONL Ecosystem and Competitors

> This document records findings from pre-implementation research.
> All data was gathered before the implementation was written.
> Package statistics (downloads, stars) are **not included** because
> they fluctuate and were not verified at research time.

---

## 1. Package Name Availability

**Name checked:** `jsonl-audit-kit`

**Finding:** No package named `jsonl-audit-kit` was found on the npm registry
at research time. The name appears to be available.

**Note:** Availability can change between research and publication.
Always run `npm view jsonl-audit-kit` immediately before publishing.

---

## 2. Existing Ecosystem Packages

### 2.1 `ndjson`

| Attribute | Detail |
|-----------|--------|
| Purpose | Parse and stringify NDJSON/JSONL streams |
| Mechanism | Node.js Transform streams |
| CLI | No dedicated CLI |
| Validation | None — it is a parser/serialiser only |
| Maintenance | Maintenance has slowed; older codebase |
| License | BSD-2-Clause |

**Limitations relevant to `jsonl-audit-kit`:**
- No validation, no diagnostics, no line-level error reporting.
- Not designed for auditing — it fails or silently skips on bad input.
- No CLI for quick file inspection.

---

### 2.2 `stream-json`

| Attribute | Detail |
|-----------|--------|
| Purpose | Token-stream parsing of large JSON documents |
| Mechanism | Modular pipeline with `pick`, `ignore`, `filter` |
| CLI | No |
| Validation | None built-in; pairs with AJV |
| Maintenance | Actively maintained; supports ESM, TypeScript |
| License | BSD-3-Clause |

**Limitations:**
- Designed for single large JSON files, not line-delimited files.
- Steep learning curve for simple use cases.
- No concept of "per-line audit" with diagnostics.

---

### 2.3 `JSONStream` (deprecated in practice)

| Attribute | Detail |
|-----------|--------|
| Purpose | JSONPath-based streaming of large arrays/objects |
| Mechanism | CouchDB-style JSONPath expressions |
| CLI | No |
| Validation | None |
| Maintenance | Effectively abandoned; relies on `event-stream` |
| License | Apache-2.0 / MIT |

**Not recommended** for new projects due to maintenance and security history.

---

### 2.4 `@streamparser/json`

| Attribute | Detail |
|-----------|--------|
| Purpose | Dependency-free streaming JSON parser |
| Mechanism | WHATWG TransformStream / Node.js streams |
| CLI | No |
| Validation | None built-in |
| Maintenance | Actively maintained; cross-runtime |
| License | MIT |

**Limitations:**
- No line-level error diagnostics.
- No CLI for file auditing.
- Not designed as a file-audit tool.

---

### 2.5 `ajv` (Another JSON Validator)

| Attribute | Detail |
|-----------|--------|
| Purpose | JSON Schema validation |
| Mechanism | Compiled validators from JSON Schema |
| CLI | Separate `ajv-cli` package |
| Validation | Full JSON Schema draft 2020-12 support |
| Maintenance | Actively maintained; widely used |
| License | MIT |

**Relationship to `jsonl-audit-kit`:**
AJV validates individual objects against a schema. It does not read JSONL
files, does not stream, and does not provide line-level diagnostics. A
user wanting both would need to write glue code. `jsonl-audit-kit` is
complementary rather than competing.

---

### 2.6 `@hexmon_tech/audit-sink-file-jsonl`

| Attribute | Detail |
|-----------|--------|
| Purpose | Write audit log events to a JSONL file (output sink) |
| Maintenance | Small / niche |

**Not relevant** — this writes JSONL; it does not validate it.

---

## 3. Identified Gap

None of the researched packages provides all of:

1. **Streaming read** of a JSONL file without loading it into memory.
2. **Per-line validation** with line numbers preserved.
3. **Actionable diagnostics** (what went wrong, on which line, and why).
4. **Configurable validation rules** (require objects, required keys, size limits).
5. **Bounded error accumulation** (collect N errors, count all, avoid OOM).
6. **Developer-friendly CLI** with human and machine-readable output.
7. **Correct exit codes** for CI pipeline integration.
8. **Zero runtime dependencies** using only Node.js built-ins.

This is the gap `jsonl-audit-kit` fills.

---

## 4. Differentiation Summary

| Feature | ndjson | stream-json | @streamparser/json | **jsonl-audit-kit** |
|---------|--------|-------------|---------------------|----------------------|
| Streaming read | ✓ | ✓ | ✓ | ✓ |
| Per-line diagnostics | ✗ | ✗ | ✗ | ✓ |
| Line numbering | ✗ | ✗ | ✗ | ✓ |
| Configurable rules | ✗ | ✗ | ✗ | ✓ |
| Bounded error list | ✗ | ✗ | ✗ | ✓ |
| CLI with exit codes | ✗ | ✗ | ✗ | ✓ |
| JSON output mode | ✗ | ✗ | ✗ | ✓ |
| Zero runtime deps | ✓ | ✗ | ✓ | ✓ |
| Node.js built-ins only | ✓ | ✗ | ✗ | ✓ |

---

## 5. Node.js API Research

The implementation uses only Node.js built-in modules:

- `node:fs` — `createReadStream`, `stat`
- `node:fs/promises` — `stat`
- `node:readline` — `createInterface` with `for await ... of` async iteration
- `node:stream` — `Readable`
- `node:path` — `resolve`, `join`, `dirname`
- `node:process` — `process.stdin`, `process.stdout`, `process.stderr`, `process.exit`
- `node:module` — `createRequire` (not used in final impl)
- `node:url` — `fileURLToPath`
- `node:child_process` — `spawn` (test-only)
- `node:test` — test runner (test-only)
- `node:assert` — assertions (test-only)

`readline.createInterface` with `crlfDelay: Infinity` correctly handles both
`\n` and `\r\n` line endings without additional processing.

The `for await ... of` loop on the readline interface is the idiomatic,
backpressure-aware way to read a stream line-by-line in Node.js 12+.
