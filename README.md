# jsonl-audit-kit

Audit JSONL (JSON Lines / NDJSON) files and identify invalid records before they enter your application, database, AI pipeline, or data-processing workflow.

---

## The problem

JSONL files are widely used for logs, datasets, AI training data, and event streams. Each line must be valid JSON, but files produced by flaky exporters, truncated downloads, or manual edits often contain broken records:

```
{"id":1,"event":"created"}
{"id":2,"event":
{"id":3,"event":"deleted"}
```

The second record is incomplete. Standard JSON parsers either crash on the first error or silently discard bad records. Neither behaviour tells you *which* lines are broken or *why*.

`jsonl-audit-kit` scans every line, collects per-line diagnostics, and exits with the right code for CI pipelines — without loading the entire file into memory.

---

## Features

- **Streaming** — reads files line-by-line using `node:readline`; works on files of any size
- **Per-line diagnostics** — precise line numbers and human-readable error messages
- **Configurable validation** — require objects, require specific keys, limit line size
- **Bounded error collection** — store up to N errors; always count all of them
- **Developer-friendly CLI** — human and `--json` machine-readable output
- **CI-friendly exit codes** — 0 valid, 1 invalid, 2 operational error
- **TypeScript declarations** included
- **Zero runtime dependencies** — only Node.js built-in modules

---

## Requirements

- Node.js **≥ 20.0.0**

---

## Installation

```bash
npm install jsonl-audit-kit
```

CLI only (global):

```bash
npm install -g jsonl-audit-kit
```

---

## Quick start

### JavaScript API

```js
import { auditFile } from 'jsonl-audit-kit';

const result = await auditFile('./events.jsonl', {
  requireObject: true,
  requiredKeys: ['id', 'event'],
});

if (!result.valid) {
  console.error(`Found ${result.errorCount} error(s) in ${result.totalLines} line(s)`);

  for (const err of result.errors) {
    console.error(`  Line ${err.line}: [${err.type}] ${err.message}`);
  }

  process.exit(1);
}

console.log('File is valid!');
```

### CLI

```bash
# Basic audit
jsonl-audit events.jsonl

# Require objects with specific keys
jsonl-audit events.jsonl --require-object --required id,event

# Machine-readable output
jsonl-audit events.jsonl --json

# Read from stdin
cat events.jsonl | jsonl-audit -

# Limit stored errors (scanning always continues)
jsonl-audit events.jsonl --max-errors 50
```

---

## JavaScript API

### `auditFile(filePath, options?)`

Audit a JSONL file at the given path.

```js
import { auditFile } from 'jsonl-audit-kit';

const result = await auditFile('./data.jsonl', {
  requireObject: true,
  requiredKeys: ['id', 'timestamp'],
  maxErrors: 100,
});
```

### `auditStream(stream, options?)`

Audit any readable Node.js stream. Use this for `process.stdin`, HTTP responses, or custom sources.

```js
import { auditStream } from 'jsonl-audit-kit';
import { createReadStream } from 'node:fs';

const stream = createReadStream('./data.jsonl', { encoding: 'utf8' });
const result = await auditStream(stream, { requireObject: true });
```

---

## Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requireObject` | `boolean` | `false` | Every record must be a JSON object `{...}` |
| `requireArray` | `boolean` | `false` | Every record must be a JSON array `[...]` |
| `requiredKeys` | `string[]` | `[]` | Keys that must exist in every object record |
| `reportBlankLines` | `boolean` | `false` | Treat blank lines as errors |
| `maxErrors` | `number` | `100` | Maximum stored diagnostics |
| `maxLineBytes` | `number \| null` | `null` | Maximum line size in bytes |

`requireObject` and `requireArray` cannot both be `true`.

---

## Result object

```js
{
  valid: true,          // false if any errors were found
  totalLines: 1000,     // total lines read (including blank lines)
  blankLines: 5,        // blank / whitespace-only lines
  errorCount: 0,        // total errors found (may exceed errors.length)
  errors: [],           // stored diagnostics (at most maxErrors)
  truncated: false      // true when errorCount > errors.length
}
```

---

## Diagnostic format

Each diagnostic in `result.errors` looks like:

```js
// Invalid JSON
{ line: 42, type: 'INVALID_JSON', message: 'JSON parse error: Unexpected end of JSON input' }

// Not an object
{ line: 7, type: 'NOT_AN_OBJECT', message: 'Expected a JSON object but got array' }

// Missing key
{ line: 15, type: 'MISSING_KEY', message: 'Required key "id" is missing', key: 'id' }

// Line too long
{ line: 3, type: 'LINE_TOO_LONG', message: 'Line is 2048 bytes, exceeds limit of 1024 bytes', length: 2048, max: 1024 }

// Blank line (only when reportBlankLines: true)
{ line: 10, type: 'BLANK_LINE', message: 'Line is blank' }
```

### Diagnostic types

| Type | Meaning |
|------|---------|
| `INVALID_JSON` | Line is not valid JSON |
| `BLANK_LINE` | Line is blank (only when `reportBlankLines: true`) |
| `NOT_AN_OBJECT` | Parsed value is not a plain object (when `requireObject: true`) |
| `NOT_AN_ARRAY` | Parsed value is not an array (when `requireArray: true`) |
| `MISSING_KEY` | A required key is absent |
| `LINE_TOO_LONG` | Line exceeds `maxLineBytes` |

You can import `DiagnosticType` to avoid hardcoding strings:

```js
import { auditFile, DiagnosticType } from 'jsonl-audit-kit';

const result = await auditFile('./data.jsonl');
const parseErrors = result.errors.filter(e => e.type === DiagnosticType.INVALID_JSON);
```

---

## CLI usage

```
jsonl-audit <file|-> [options]
```

| Flag | Description |
|------|-------------|
| `--require-object` | Require every record to be a JSON object |
| `--require-array` | Require every record to be a JSON array |
| `--required k1,k2` | Required top-level key names (comma-separated) |
| `--report-blank-lines` | Treat blank lines as errors |
| `--max-errors n` | Maximum stored errors (default: 100) |
| `--max-line-bytes n` | Flag lines longer than n bytes |
| `--json` | Machine-readable JSON output |
| `--version` / `-v` | Print version |
| `--help` / `-h` | Show help |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | All records valid |
| `1` | One or more records invalid |
| `2` | Operational error (file not found, bad arguments) |

### Example output

**Human-readable (valid):**
```
✓ events.jsonl: valid — 1000 line(s) checked, 0 errors
```

**Human-readable (invalid):**
```
✗ events.jsonl: INVALID — 3 error(s) in 1000 line(s)
  Line 42: [INVALID_JSON] JSON parse error: Unexpected end of JSON input
  Line 87: [MISSING_KEY] Required key "id" is missing [key: id]
  Line 99: [NOT_AN_OBJECT] Expected a JSON object but got array
```

**JSON output (`--json`):**
```json
{
  "source": "events.jsonl",
  "valid": false,
  "totalLines": 1000,
  "blankLines": 0,
  "errorCount": 3,
  "errors": [
    {
      "line": 42,
      "type": "INVALID_JSON",
      "message": "JSON parse error: Unexpected end of JSON input"
    }
  ],
  "truncated": false
}
```

---

## Error handling

```js
import { auditFile } from 'jsonl-audit-kit';

try {
  const result = await auditFile('./data.jsonl', { requireObject: true });
  // ...
} catch (err) {
  if (err.code === 'ENOENT') {
    console.error('File not found');
  } else if (err.code === 'EACCES') {
    console.error('Permission denied');
  } else if (err.name === 'TypeError') {
    console.error('Invalid options:', err.message);
  } else {
    console.error('Unexpected error:', err.message);
  }
}
```

---

## TypeScript

TypeScript declarations are included:

```ts
import { auditFile, AuditResult, AuditOptions, Diagnostic, DiagnosticType } from 'jsonl-audit-kit';

const options: AuditOptions = {
  requireObject: true,
  requiredKeys: ['id', 'event'],
};

const result: AuditResult = await auditFile('./data.jsonl', options);
```

---

## Node.js compatibility

| Node.js version | Supported |
|-----------------|-----------|
| 24.x | ✓ |
| 22.x | ✓ |
| 20.x | ✓ |
| 18.x and earlier | ✗ |

> **Note:** Node.js 18 is end-of-life. The built-in test runner used by this package became stable in Node.js 20.

---

## Limitations

- **Line buffer:** `node:readline` buffers one line at a time. A single line of several megabytes will occupy that memory. There is no per-line size enforcement by default; use `maxLineBytes` to guard against this.
- **UTF-8 only:** The streaming reader assumes UTF-8 input. Other encodings (Latin-1, UTF-16) must be transcoded before auditing.
- **No JSON Schema validation:** `requiredKeys` checks for key presence only. For full structural/type validation, pair `jsonl-audit-kit` with a schema validator such as [AJV](https://ajv.js.org/).
- **CommonJS consumers** must use dynamic `import()` since the package is ESM-only.

---

## Development setup

```bash
git clone https://github.com/<your-username>/jsonl-audit-kit.git
cd jsonl-audit-kit
npm install
```

### Run tests

```bash
npm test
```

### Syntax check

```bash
npm run check
```

### Run examples

```bash
node examples/usage.js
```

### Inspect package contents

```bash
npm pack --dry-run
```

---

## License

[MIT](./LICENSE)
