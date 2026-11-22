/**
 * validator.test.js
 *
 * Tests for the core auditing engine:
 *   - auditFile() with real files
 *   - auditStream() with in-memory streams
 *   - validateLine() unit tests
 *   - validateOptions() unit tests
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, mkdir, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { auditFile, auditStream } from '../src/index.js';
import { validateLine } from '../src/validator.js';
import { validateOptions } from '../src/utils/validate-options.js';
import { DiagnosticType } from '../src/diagnostics.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpDir;

/** Create a temporary file with the given content and return its path. */
async function tmpFile(name, content) {
  const p = join(tmpDir, name);
  await writeFile(p, content, 'utf8');
  return p;
}

/** Build a Readable stream from a string. */
function stringStream(str) {
  return Readable.from([str]);
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

before(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'jsonl-audit-test-'));
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// validateOptions()
// ═════════════════════════════════════════════════════════════════════════════

describe('validateOptions', () => {
  test('returns defaults when called with no arguments', () => {
    const opts = validateOptions();
    assert.equal(opts.requireObject, false);
    assert.equal(opts.requireArray, false);
    assert.deepEqual(opts.requiredKeys, []);
    assert.equal(opts.reportBlankLines, false);
    assert.equal(opts.maxErrors, 100);
    assert.equal(opts.maxLineBytes, null);
  });

  test('merges user options with defaults', () => {
    const opts = validateOptions({ requireObject: true, maxErrors: 5 });
    assert.equal(opts.requireObject, true);
    assert.equal(opts.maxErrors, 5);
    assert.equal(opts.reportBlankLines, false); // default preserved
  });

  test('throws when requireObject and requireArray are both true', () => {
    assert.throws(
      () => validateOptions({ requireObject: true, requireArray: true }),
      { name: 'TypeError' },
    );
  });

  test('throws when requiredKeys contains a non-string', () => {
    assert.throws(
      () => validateOptions({ requiredKeys: ['id', 42] }),
      { name: 'TypeError' },
    );
  });

  test('throws when maxErrors is zero', () => {
    assert.throws(
      () => validateOptions({ maxErrors: 0 }),
      { name: 'TypeError' },
    );
  });

  test('throws when maxErrors is not an integer', () => {
    assert.throws(
      () => validateOptions({ maxErrors: 1.5 }),
      { name: 'TypeError' },
    );
  });

  test('throws when options is not a plain object', () => {
    assert.throws(() => validateOptions(null), { name: 'TypeError' });
    assert.throws(() => validateOptions([]), { name: 'TypeError' });
  });

  test('accepts valid maxLineBytes', () => {
    const opts = validateOptions({ maxLineBytes: 512 });
    assert.equal(opts.maxLineBytes, 512);
  });

  test('throws when maxLineBytes is zero', () => {
    assert.throws(
      () => validateOptions({ maxLineBytes: 0 }),
      { name: 'TypeError' },
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// validateLine()
// ═════════════════════════════════════════════════════════════════════════════

describe('validateLine', () => {
  const baseOpts = validateOptions();

  test('returns no diagnostics for a valid JSON object', () => {
    const result = validateLine('{"id":1,"event":"created"}', 1, baseOpts);
    assert.deepEqual(result, []);
  });

  test('returns INVALID_JSON for malformed JSON', () => {
    const result = validateLine('{"id":2,"event":', 1, baseOpts);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, DiagnosticType.INVALID_JSON);
    assert.equal(result[0].line, 1);
  });

  test('returns INVALID_JSON for an empty string', () => {
    // Empty string is not valid JSON.
    const result = validateLine('', 1, baseOpts);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, DiagnosticType.INVALID_JSON);
  });

  test('returns NOT_AN_OBJECT when requireObject and value is array', () => {
    const opts = validateOptions({ requireObject: true });
    const result = validateLine('[1,2,3]', 5, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, DiagnosticType.NOT_AN_OBJECT);
    assert.equal(result[0].line, 5);
  });

  test('returns NOT_AN_OBJECT when requireObject and value is null', () => {
    const opts = validateOptions({ requireObject: true });
    const result = validateLine('null', 3, opts);
    assert.equal(result[0].type, DiagnosticType.NOT_AN_OBJECT);
  });

  test('returns NOT_AN_OBJECT when requireObject and value is a string', () => {
    const opts = validateOptions({ requireObject: true });
    const result = validateLine('"hello"', 2, opts);
    assert.equal(result[0].type, DiagnosticType.NOT_AN_OBJECT);
  });

  test('returns NOT_AN_ARRAY when requireArray and value is an object', () => {
    const opts = validateOptions({ requireArray: true });
    const result = validateLine('{"x":1}', 1, opts);
    assert.equal(result[0].type, DiagnosticType.NOT_AN_ARRAY);
  });

  test('returns no diagnostics when requireArray and value is an array', () => {
    const opts = validateOptions({ requireArray: true });
    const result = validateLine('[1,2,3]', 1, opts);
    assert.deepEqual(result, []);
  });

  test('returns MISSING_KEY for absent required keys', () => {
    const opts = validateOptions({ requiredKeys: ['id', 'event'] });
    const result = validateLine('{"id":1}', 10, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, DiagnosticType.MISSING_KEY);
    assert.equal(result[0].key, 'event');
    assert.equal(result[0].line, 10);
  });

  test('returns two MISSING_KEY diagnostics when both keys absent', () => {
    const opts = validateOptions({ requiredKeys: ['id', 'event'] });
    const result = validateLine('{"name":"Alice"}', 7, opts);
    assert.equal(result.length, 2);
    assert.ok(result.every((d) => d.type === DiagnosticType.MISSING_KEY));
  });

  test('returns no diagnostics when all required keys present', () => {
    const opts = validateOptions({ requiredKeys: ['id', 'event'] });
    const result = validateLine('{"id":1,"event":"ok"}', 1, opts);
    assert.deepEqual(result, []);
  });

  test('returns LINE_TOO_LONG when line exceeds maxLineBytes', () => {
    const opts = validateOptions({ maxLineBytes: 10 });
    const result = validateLine('{"id":1,"event":"created"}', 1, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, DiagnosticType.LINE_TOO_LONG);
  });

  test('returns LINE_TOO_LONG and INVALID_JSON when line is long and broken', () => {
    const opts = validateOptions({ maxLineBytes: 5 });
    const result = validateLine('{"id":2,"event":', 1, opts);
    assert.equal(result.length, 2);
    const types = result.map((d) => d.type);
    assert.ok(types.includes(DiagnosticType.LINE_TOO_LONG));
    assert.ok(types.includes(DiagnosticType.INVALID_JSON));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// auditFile() — normal behaviour
// ═════════════════════════════════════════════════════════════════════════════

describe('auditFile — normal behaviour', () => {
  test('valid JSONL file returns valid: true', async () => {
    const file = await tmpFile('valid.jsonl', '{"id":1}\n{"id":2}\n{"id":3}\n');
    const result = await auditFile(file);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 3);
    assert.equal(result.errorCount, 0);
    assert.deepEqual(result.errors, []);
    assert.equal(result.truncated, false);
  });

  test('single valid record', async () => {
    const file = await tmpFile('single.jsonl', '{"id":1}');
    const result = await auditFile(file);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 1);
  });

  test('empty file returns valid: true with zero lines', async () => {
    const file = await tmpFile('empty.jsonl', '');
    const result = await auditFile(file);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 0);
    assert.equal(result.errorCount, 0);
  });

  test('file without trailing newline is handled correctly', async () => {
    const file = await tmpFile('no-newline.jsonl', '{"id":1}\n{"id":2}');
    const result = await auditFile(file);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 2);
  });

  test('blank lines are skipped by default', async () => {
    const file = await tmpFile('blanks.jsonl', '{"id":1}\n\n{"id":2}\n\n');
    const result = await auditFile(file);
    assert.equal(result.valid, true);
    assert.equal(result.blankLines, 2);
    assert.equal(result.errorCount, 0);
  });

  test('blank lines reported as errors when reportBlankLines is true', async () => {
    const file = await tmpFile('blanks-err.jsonl', '{"id":1}\n\n{"id":2}\n');
    const result = await auditFile(file, { reportBlankLines: true });
    assert.equal(result.valid, false);
    assert.equal(result.errorCount, 1);
    assert.equal(result.errors[0].type, DiagnosticType.BLANK_LINE);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// auditFile() — invalid data
// ═════════════════════════════════════════════════════════════════════════════

describe('auditFile — invalid data', () => {
  test('malformed JSON is flagged with INVALID_JSON', async () => {
    const file = await tmpFile('broken.jsonl', '{"id":1}\n{"id":2,"event":\n{"id":3}\n');
    const result = await auditFile(file);
    assert.equal(result.valid, false);
    assert.equal(result.errorCount, 1);
    assert.equal(result.errors[0].type, DiagnosticType.INVALID_JSON);
    assert.equal(result.errors[0].line, 2);
  });

  test('multiple errors are all counted', async () => {
    const file = await tmpFile('multi-err.jsonl', 'bad1\nbad2\nbad3\n');
    const result = await auditFile(file);
    assert.equal(result.errorCount, 3);
  });

  test('processing continues after an invalid record', async () => {
    const content = '{"id":1}\nBAD JSON\n{"id":3}\n';
    const file = await tmpFile('cont.jsonl', content);
    const result = await auditFile(file);
    assert.equal(result.totalLines, 3);
    assert.equal(result.errorCount, 1);
    assert.equal(result.errors[0].line, 2);
  });

  test('mixed valid and invalid lines with requireObject', async () => {
    const file = await tmpFile('mixed.jsonl', '{"id":1}\n[1,2]\n{"id":3}\n');
    const result = await auditFile(file, { requireObject: true });
    assert.equal(result.valid, false);
    assert.equal(result.errorCount, 1);
    assert.equal(result.errors[0].type, DiagnosticType.NOT_AN_OBJECT);
    assert.equal(result.errors[0].line, 2);
  });

  test('missing required key is flagged', async () => {
    // Line 1: has both id and event — valid
    // Line 2: missing id — 1 error (MISSING_KEY for 'id')
    // Line 3: has both — valid
    const file = await tmpFile('missing-key.jsonl', '{"id":1,"event":"a"}\n{"event":"x"}\n{"id":3,"event":"y"}\n');
    const result = await auditFile(file, { requiredKeys: ['id', 'event'] });
    assert.equal(result.valid, false);
    assert.equal(result.errorCount, 1);
    assert.equal(result.errors[0].type, DiagnosticType.MISSING_KEY);
    assert.equal(result.errors[0].key, 'id');
    assert.equal(result.errors[0].line, 2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// auditFile() — file handling errors
// ═════════════════════════════════════════════════════════════════════════════

describe('auditFile — file handling errors', () => {
  test('throws when file does not exist', async () => {
    await assert.rejects(
      () => auditFile(join(tmpDir, 'nonexistent.jsonl')),
      (err) => {
        assert.ok(err.message.includes('Cannot access file'));
        return true;
      },
    );
  });

  test('throws when path is a directory', async () => {
    const dir = join(tmpDir, 'subdir');
    await mkdir(dir);
    await assert.rejects(
      () => auditFile(dir),
      (err) => {
        assert.ok(err.code === 'EISDIR');
        return true;
      },
    );
  });

  test('throws TypeError when filePath is not a string', async () => {
    await assert.rejects(() => auditFile(42), { name: 'TypeError' });
  });

  test('throws TypeError when filePath is an empty string', async () => {
    await assert.rejects(() => auditFile(''), { name: 'TypeError' });
  });

  test('throws TypeError when stream argument is not a stream', async () => {
    await assert.rejects(() => auditStream('not-a-stream'), { name: 'TypeError' });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// auditFile() — bounded diagnostics
// ═════════════════════════════════════════════════════════════════════════════

describe('auditFile — bounded diagnostics', () => {
  test('stores at most maxErrors diagnostics', async () => {
    // 10 bad lines, maxErrors = 3
    const lines = Array.from({ length: 10 }, () => 'bad json').join('\n') + '\n';
    const file = await tmpFile('bounded.jsonl', lines);
    const result = await auditFile(file, { maxErrors: 3 });
    assert.equal(result.errors.length, 3);
    assert.equal(result.errorCount, 10);
    assert.equal(result.truncated, true);
  });

  test('truncated is false when errors fit within maxErrors', async () => {
    const file = await tmpFile('few-err.jsonl', 'bad\n{"id":2}\n');
    const result = await auditFile(file, { maxErrors: 5 });
    assert.equal(result.errors.length, 1);
    assert.equal(result.errorCount, 1);
    assert.equal(result.truncated, false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// auditStream()
// ═════════════════════════════════════════════════════════════════════════════

describe('auditStream', () => {
  test('valid stream returns valid: true', async () => {
    const stream = stringStream('{"id":1}\n{"id":2}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 2);
  });

  test('empty stream returns valid: true with zero lines', async () => {
    const stream = stringStream('');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 0);
  });

  test('stream with invalid JSON returns valid: false', async () => {
    const stream = stringStream('{"id":1}\nBAD\n{"id":3}\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, false);
    assert.equal(result.errorCount, 1);
    assert.equal(result.errors[0].line, 2);
  });

  test('applies options to stream input', async () => {
    const stream = stringStream('{"name":"Alice"}\n{"id":2}\n');
    const result = await auditStream(stream, { requiredKeys: ['id'] });
    assert.equal(result.valid, false);
    assert.equal(result.errorCount, 1);
    assert.equal(result.errors[0].line, 1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Line numbering
// ═════════════════════════════════════════════════════════════════════════════

describe('line numbering', () => {
  test('error on the first line is reported as line 1', async () => {
    const stream = stringStream('BAD\n{"id":2}\n');
    const result = await auditStream(stream);
    assert.equal(result.errors[0].line, 1);
  });

  test('error on the fifth line is reported as line 5', async () => {
    const stream = stringStream('{"a":1}\n{"b":2}\n{"c":3}\n{"d":4}\nBAD\n');
    const result = await auditStream(stream);
    assert.equal(result.errors[0].line, 5);
  });

  test('blank lines advance the line counter', async () => {
    // Line 1: valid, Line 2: blank, Line 3: bad
    const stream = stringStream('{"id":1}\n\nBAD\n');
    const result = await auditStream(stream);
    assert.equal(result.errors[0].line, 3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// CRLF line endings
// ═════════════════════════════════════════════════════════════════════════════

describe('CRLF line endings', () => {
  test('handles \\r\\n line endings', async () => {
    const stream = stringStream('{"id":1}\r\n{"id":2}\r\n');
    const result = await auditStream(stream);
    assert.equal(result.valid, true);
    assert.equal(result.totalLines, 2);
  });
});
