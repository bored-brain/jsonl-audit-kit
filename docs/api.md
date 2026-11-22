# API Reference — jsonl-audit-kit

## Functions

### `auditFile(filePath, options?)`

Audit a JSONL file at the given path.

```js
import { auditFile } from 'jsonl-audit-kit';

const result = await auditFile('./events.jsonl', {
  requireObject: true,
  requiredKeys: ['id', 'event'],
  maxErrors: 50,
});
```

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filePath` | `string` | Yes | Absolute or relative path to the JSONL file |
| `options` | `AuditOptions` | No | Validation options (see below) |

**Returns:** `Promise<AuditResult>`

**Throws:**
- `TypeError` — `filePath` is not a string, or options are invalid
- `Error` (code `ENOENT`) — file does not exist
- `Error` (code `EISDIR`) — path is a directory
- `Error` (code `EACCES`) — file is not readable

---

### `auditStream(stream, options?)`

Audit a readable Node.js stream containing JSONL data.

```js
import { auditStream } from 'jsonl-audit-kit';
import { createReadStream } from 'node:fs';

const stream = createReadStream('./events.jsonl', { encoding: 'utf8' });
const result = await auditStream(stream, { requireObject: true });
```

**Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `stream` | `Readable` | Yes | A readable Node.js stream |
| `options` | `AuditOptions` | No | Validation options (see below) |

**Returns:** `Promise<AuditResult>`

---

## Types

### `AuditOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `requireObject` | `boolean` | `false` | Require every record to be a JSON object `{...}` |
| `requireArray` | `boolean` | `false` | Require every record to be a JSON array `[...]` |
| `requiredKeys` | `string[]` | `[]` | Keys that must be present in every object record |
| `reportBlankLines` | `boolean` | `false` | Treat blank lines as errors |
| `maxErrors` | `number` | `100` | Maximum stored diagnostics (scanning always completes) |
| `maxLineBytes` | `number \| null` | `null` | Flag lines longer than this many bytes |

`requireObject` and `requireArray` cannot both be `true`.

---

### `AuditResult`

| Property | Type | Description |
|----------|------|-------------|
| `valid` | `boolean` | `true` if no errors were found |
| `totalLines` | `number` | Total number of lines read (including blank lines) |
| `blankLines` | `number` | Number of blank / whitespace-only lines |
| `errorCount` | `number` | Total number of validation errors (may exceed `errors.length`) |
| `errors` | `Diagnostic[]` | Stored diagnostics (at most `maxErrors` entries) |
| `truncated` | `boolean` | `true` when `errorCount > errors.length` |

---

### `Diagnostic`

| Property | Type | Present when |
|----------|------|--------------|
| `line` | `number` | Always — 1-based line number |
| `type` | `DiagnosticTypeName` | Always — category of the problem |
| `message` | `string` | Always — human-readable description |
| `key` | `string` | `MISSING_KEY` diagnostics only |
| `length` | `number` | `LINE_TOO_LONG` diagnostics only |
| `max` | `number` | `LINE_TOO_LONG` diagnostics only |

---

### `DiagnosticType`

```js
import { DiagnosticType } from 'jsonl-audit-kit';

DiagnosticType.INVALID_JSON   // 'INVALID_JSON'
DiagnosticType.BLANK_LINE     // 'BLANK_LINE'
DiagnosticType.NOT_AN_OBJECT  // 'NOT_AN_OBJECT'
DiagnosticType.NOT_AN_ARRAY   // 'NOT_AN_ARRAY'
DiagnosticType.MISSING_KEY    // 'MISSING_KEY'
DiagnosticType.LINE_TOO_LONG  // 'LINE_TOO_LONG'
```

| Constant | Meaning |
|----------|---------|
| `INVALID_JSON` | Line is not valid JSON |
| `BLANK_LINE` | Line is blank (only when `reportBlankLines: true`) |
| `NOT_AN_OBJECT` | Parsed value is not a plain object (when `requireObject: true`) |
| `NOT_AN_ARRAY` | Parsed value is not an array (when `requireArray: true`) |
| `MISSING_KEY` | A required key is absent from the top-level object |
| `LINE_TOO_LONG` | Line exceeds `maxLineBytes` |

---

## CLI Reference

```
jsonl-audit <file|-> [options]
```

### Options

| Flag | Argument | Description |
|------|----------|-------------|
| `--require-object` | — | Require every record to be a JSON object |
| `--require-array` | — | Require every record to be a JSON array |
| `--required` | `k1,k2,...` | Comma-separated required key names |
| `--report-blank-lines` | — | Treat blank lines as errors |
| `--max-errors` | `n` | Max stored errors (default: 100) |
| `--max-line-bytes` | `n` | Flag lines longer than n bytes |
| `--json` | — | Machine-readable JSON output to stdout |
| `--version` / `-v` | — | Print version and exit |
| `--help` / `-h` | — | Show help and exit |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All records valid |
| `1` | One or more records invalid |
| `2` | Operational error (file not found, bad arguments) |

### Human-readable output format

```
✓ events.jsonl: valid — 1000 line(s) checked, 0 errors
```

```
✗ events.jsonl: INVALID — 3 error(s) in 1000 line(s)
  Line 42: [INVALID_JSON] JSON parse error: Unexpected end of JSON input
  Line 87: [MISSING_KEY] Required key "id" is missing [key: id]
  Line 99: [NOT_AN_OBJECT] Expected a JSON object but got array
```

### JSON output format

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
