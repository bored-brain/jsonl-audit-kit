# Design Decisions

This document records the key technical decisions made during the design of `jsonl-audit-kit` and the rationale behind each choice.

---

## 1. Pure JavaScript, No Runtime Dependencies

**Decision:** Use only Node.js built-in modules. Zero runtime dependencies.

**Rationale:**
- Zero attack surface from supply-chain vulnerabilities.
- No `node_modules` for the production install.
- Simpler for learners to read and understand.
- Node.js built-ins (`readline`, `fs`, `stream`) are well-maintained and stable.

**Trade-off:** External libraries like `@streamparser/json` offer more streaming flexibility, but the built-in `readline` interface with `for await...of` is sufficient for line-delimited formats and is conceptually simpler.

---

## 2. `readline.createInterface` for Line Splitting

**Decision:** Use `node:readline` with `crlfDelay: Infinity` for line splitting.

**Rationale:**
- Correctly handles both `\n` (Unix) and `\r\n` (Windows) line endings.
- The `for await...of` iteration pattern applies natural backpressure.
- Lines are delivered one at a time — no manual buffer accumulation.
- Well-documented, stable API available since Node.js 0.1.

**Memory implication:** `readline` buffers the current line. For very long lines (e.g. a 10 MB record), that line's bytes will be in memory simultaneously. This is unavoidable for line-based processing and is documented in the README.

---

## 3. ESM (ECMAScript Modules)

**Decision:** Use `"type": "module"` and native ESM throughout.

**Rationale:**
- Node.js 20+ has stable, full ESM support.
- ESM is the modern standard; avoids `require()` and CJS interop complexity.
- `import`/`export` syntax is clearer for learners.
- `node:test` supports ESM without additional configuration.

**Trade-off:** CommonJS consumers must use dynamic `import()`. This is documented in the README.

---

## 4. Bounded Diagnostic Storage

**Decision:** Store at most `maxErrors` diagnostics. Continue scanning the entire file. Count all errors separately.

**Rationale:**
- Prevents unbounded memory growth when validating enormous files with many errors.
- Developers still learn the total error count without loading all errors into memory.
- `truncated: true` signals when the stored list is incomplete.
- The default of 100 is generous for typical use but safe for large files.

**Alternative considered:** Streaming diagnostics via callback or async generator. Rejected for the MVP because it complicates the API without a strong MVP need. Marked as a future enhancement.

---

## 5. `auditFile` checks file existence with `stat` before streaming

**Decision:** Call `fs.stat` before opening the stream to check existence and type.

**Rationale:**
- Surfaces a clear, actionable error message (`Cannot access file "..."`) rather than the raw stream error.
- Distinguishes `ENOENT` (not found), `EACCES` (permission denied), and `EISDIR` (is a directory) early.
- Makes the API easier to use for callers who want to handle errors differently.

---

## 6. Separate `validateLine` function

**Decision:** Export `validateLine` as a named export from `validator.js`.

**Rationale:**
- Enables direct unit testing of the per-line validation logic without file I/O.
- Keeps the streaming orchestration in `auditStream` separate from the rule engine.
- Useful for advanced consumers who want to validate individual lines.

---

## 7. `requiredKeys` only checks plain objects

**Decision:** The required-key check is silently skipped when the parsed value is not a plain object (e.g. array, string, number).

**Rationale:**
- Required keys are only meaningful on objects. Applying them to arrays would produce confusing error messages.
- If the caller also sets `requireObject: true`, non-object records are reported via `NOT_AN_OBJECT` before the key check runs.
- If `requireObject` is false, the caller has opted out of structural enforcement and the key check would be nonsensical.

---

## 8. Node.js 20+ minimum

**Decision:** Set `engines.node` to `>=20.0.0`.

**Rationale:**
- Node.js 20 is the oldest Active LTS version at the time of development.
- `node:test` (the built-in test runner) became stable in Node.js 20.
- `for await...of` on readline is fully supported since Node.js 11.4.

---

## 9. Exit codes 0, 1, 2

**Decision:** CLI exits with 0 (valid), 1 (invalid records), 2 (operational error).

**Rationale:**
- Exit code 0 meaning "success" and 1 meaning "failure" is universal Unix convention.
- Using exit code 2 for operational errors (not found, bad arguments) distinguishes them from validation failures.
- This makes shell scripting and CI pipeline integration straightforward:
  ```sh
  jsonl-audit events.jsonl || echo "Validation failed"
  ```

---

## 10. `--json` outputs to stdout, errors to stderr

**Decision:** JSON output (and human "valid" messages) go to stdout. Human-readable error listings go to stderr.

**Rationale:**
- Allows piping JSON output to `jq` or other tools without mixing error messages.
- Follows Unix conventions: informational/data output on stdout, diagnostics on stderr.
- In `--json` mode, **all** output is on stdout (the JSON object includes errors), so stderr is clean.
