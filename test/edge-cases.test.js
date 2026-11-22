/**
 * edge-cases.test.js
 *
 * Tests for unusual, boundary, and stress conditions:
 *   - UTF-8 edge cases
 *   - Very long lines
 *   - JSON edge cases (numbers, booleans, null, nested)
 *   - Large file performance
 *   - Configuration edge cases
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { auditFile, auditStream } from '../src/index.js';
import { DiagnosticType } from '../src/diagnostics.js';

let tmpDir;

async function tmpFile(name, content) {
  const p = join(tmpDir, name);
  await writeFile(p, content, 'utf8');
  return p;
}

function stringStream(str) {
  return Readable.from([str]);
}

before(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'jsonl-edge-'));
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// JSON value types as top-level records
// ═════════════════════════════════════════════════════════════════════════════

describe('top-level JSON value types', () => {
  test('top-level string is valid JSON (no structural rule)', async () => {
    const stream = stringStream('"hello"\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('top-level number is valid JSON (no structural rule)', async () => {
    const stream = stringStream('42\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('top-level boolean true is valid', async () => {
    const stream = stringStream('true\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('top-level null is valid', async () => {
    const stream = stringStream('null\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('top-level array is valid', async () => {
    const stream = stringStream('[1,2,3]\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('deeply nested JSON object is valid', async () => {
    const stream = stringStream('{"a":{"b":{"c":1}}}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('JSON with Unicode string values is valid', async () => {
    const stream = stringStream('{"greeting":"こんにちは"}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('JSON with emoji values is valid', async () => {
    const stream = stringStream('{"icon":"🚀"}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Invalid JSON varieties
// ═════════════════════════════════════════════════════════════════════════════

describe('invalid JSON varieties', () => {
  test('trailing comma is invalid JSON', async () => {
    const stream = stringStream('{"id":1,}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].type, DiagnosticType.INVALID_JSON);
  });

  test('single quote strings are invalid JSON', async () => {
    const stream = stringStream("{'id':1}\n");
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
  });

  test('unquoted keys are invalid JSON', async () => {
    const stream = stringStream('{id:1}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
  });

  test('naked undefined is not valid JSON', async () => {
    const stream = stringStream('undefined\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
  });

  test('JavaScript-style comments are invalid JSON', async () => {
    const stream = stringStream('// comment\n{"id":1}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].line, 1);
  });

  test('truncated string is invalid JSON', async () => {
    const stream = stringStream('{"id":"unterminated\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
  });

  test('lone bracket is invalid JSON', async () => {
    const stream = stringStream('{\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Number formats
// ═════════════════════════════════════════════════════════════════════════════

describe('number formats', () => {
  test('integer is valid', async () => {
    const stream = stringStream('{"n":42}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('float is valid', async () => {
    const stream = stringStream('{"n":3.14}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('negative number is valid', async () => {
    const stream = stringStream('{"n":-1}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('scientific notation is valid', async () => {
    const stream = stringStream('{"n":1e10}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
  });

  test('hex literal 0x1 is not valid JSON', async () => {
    const stream = stringStream('{"n":0x1}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// maxLineBytes
// ═════════════════════════════════════════════════════════════════════════════

describe('maxLineBytes', () => {
  test('line within limit is accepted', async () => {
    const stream = stringStream('{"id":1}\n');
    const result = await auditStream(stream, { maxLineBytes: 100 });
    assert.equal(result.valid, true);
  });

  test('line exactly at limit is accepted', async () => {
    const content = '{"id":1}'; // 8 bytes
    const stream = stringStream(content + '\n');
    const result = await auditStream(stream, { maxLineBytes: 8 });
    assert.equal(result.valid, true);
  });

  test('line one byte over limit is rejected', async () => {
    const content = '{"id":1}'; // 8 bytes
    const stream = stringStream(content + '\n');
    const result = await auditStream(stream, { maxLineBytes: 7 });
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].type, DiagnosticType.LINE_TOO_LONG);
    assert.equal(result.errors[0].length, 8);
    assert.equal(result.errors[0].max, 7);
  });

  test('multi-byte UTF-8 characters are counted by byte length', async () => {
    // '€' is 3 bytes in UTF-8
    const content = '{"c":"€"}'; // 9 chars but more bytes
    const byteLen = Buffer.byteLength(content, 'utf8');
    const stream = stringStream(content + '\n');
    // Set limit to byte length - 1 to trigger the error
    const result = await auditStream(stream, { maxLineBytes: byteLen - 1 });
    assert.equal(result.valid, false);
    assert.equal(result.errors[0].type, DiagnosticType.LINE_TOO_LONG);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Very long lines
// ═════════════════════════════════════════════════════════════════════════════

describe('very long lines', () => {
  test('a 1 MB valid JSON line is processed correctly', async () => {
    // Build a large but valid JSON object
    const payload = { id: 1, data: 'x'.repeat(1_000_000) };
    const line = JSON.stringify(payload);
    const stream = stringStream(line + '\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Large file performance
// ═════════════════════════════════════════════════════════════════════════════

describe('large file', () => {
  test('processes 50 000 valid records correctly', async () => {
    const COUNT = 50_000;
    const lines = Array.from({ length: COUNT }, (_, i) =>
      JSON.stringify({ id: i + 1, event: 'test', ts: Date.now() }),
    ).join('\n') + '\n';

    const file = await tmpFile('large.jsonl', lines);
    const start = performance.now();
    const result = await auditFile(file);
    const elapsed = performance.now() - start;

    assert.equal(result.valid, true);
    assert.equal(result.totalLines, COUNT);
    assert.equal(result.errorCount, 0);

    // Log performance (not a gate, just informational)
    console.log(`  large file: ${COUNT} records processed in ${elapsed.toFixed(0)} ms`);
  });

  test('processes 50 000 mixed records (10% bad) and counts correctly', async () => {
    const COUNT = 50_000;
    const BAD_EVERY = 10; // every 10th line is bad → 5 000 errors
    const lines = Array.from({ length: COUNT }, (_, i) => {
      if ((i + 1) % BAD_EVERY === 0) return 'BAD JSON';
      return JSON.stringify({ id: i + 1 });
    }).join('\n') + '\n';

    const file = await tmpFile('large-mixed.jsonl', lines);
    const result = await auditFile(file, { maxErrors: 50 });

    assert.equal(result.totalLines, COUNT);
    assert.equal(result.errorCount, COUNT / BAD_EVERY);
    assert.equal(result.errors.length, 50); // capped at maxErrors
    assert.equal(result.truncated, true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// requiredKeys on non-object records
// ═════════════════════════════════════════════════════════════════════════════

describe('requiredKeys on non-object records', () => {
  test('requiredKeys are not checked on a JSON array', async () => {
    // A bare array is not a plain object — missing-key rule doesn't apply.
    const stream = stringStream('[1,2,3]\n');
    const result = await auditStream(stream, { requiredKeys: ['id'] });
    // No MISSING_KEY error — arrays don't have .hasOwnProperty for key checks.
    const missingKeyErrors = result.errors.filter((e) => e.type === DiagnosticType.MISSING_KEY);
    assert.equal(missingKeyErrors.length, 0);
  });

  test('requiredKeys are not checked on a JSON string', async () => {
    const stream = stringStream('"hello"\n');
    const result = await auditStream(stream, { requiredKeys: ['id'] });
    assert.equal(result.errors.filter((e) => e.type === DiagnosticType.MISSING_KEY).length, 0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Whitespace-only lines (not counted as errors by default)
// ═════════════════════════════════════════════════════════════════════════════

describe('whitespace-only lines', () => {
  test('a line with only spaces is treated as blank', async () => {
    const stream = stringStream('{"id":1}\n   \n{"id":3}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
    assert.equal(result.blankLines, 1);
  });

  test('a line with only a tab is treated as blank', async () => {
    const stream = stringStream('{"id":1}\n\t\n{"id":3}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
    assert.equal(result.blankLines, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DiagnosticType export
// ═════════════════════════════════════════════════════════════════════════════

describe('DiagnosticType export', () => {
  test('DiagnosticType constants are exported from index.js', () => {
    assert.equal(DiagnosticType.INVALID_JSON, 'INVALID_JSON');
    assert.equal(DiagnosticType.BLANK_LINE, 'BLANK_LINE');
    assert.equal(DiagnosticType.NOT_AN_OBJECT, 'NOT_AN_OBJECT');
    assert.equal(DiagnosticType.NOT_AN_ARRAY, 'NOT_AN_ARRAY');
    assert.equal(DiagnosticType.MISSING_KEY, 'MISSING_KEY');
    assert.equal(DiagnosticType.LINE_TOO_LONG, 'LINE_TOO_LONG');
  });
});
