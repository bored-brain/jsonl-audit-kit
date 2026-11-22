/**
 * cli.test.js
 *
 * Tests for the jsonl-audit CLI.
 *
 * We spawn the CLI as a child process using node:child_process so the tests
 * cover the full end-to-end behaviour including exit codes, stdout/stderr, and
 * stdin piping.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, '../bin/jsonl-audit.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpDir;

async function tmpFile(name, content) {
  const p = join(tmpDir, name);
  await writeFile(p, content, 'utf8');
  return p;
}

/**
 * Run the CLI with the given arguments and optional stdin string.
 * Returns { exitCode, stdout, stderr }.
 */
function runCli(args = [], stdinData = null) {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [CLI, ...args], {
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    if (stdinData !== null) {
      proc.stdin.write(stdinData);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      resolve({ exitCode: code, stdout, stderr });
    });
  });
}

before(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'jsonl-audit-cli-test-'));
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// --help and --version
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI meta flags', () => {
  test('--help prints usage and exits 0', async () => {
    const { exitCode, stdout } = await runCli(['--help']);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('USAGE'));
    assert.ok(stdout.includes('OPTIONS'));
    assert.ok(stdout.includes('EXIT CODES'));
  });

  test('-h is an alias for --help', async () => {
    const { exitCode, stdout } = await runCli(['-h']);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('USAGE'));
  });

  test('--version prints version and exits 0', async () => {
    const { exitCode, stdout } = await runCli(['--version']);
    assert.equal(exitCode, 0);
    assert.match(stdout, /jsonl-audit-kit v\d+\.\d+\.\d+/);
  });

  test('-v is an alias for --version', async () => {
    const { exitCode, stdout } = await runCli(['-v']);
    assert.equal(exitCode, 0);
    assert.match(stdout, /\d+\.\d+\.\d+/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// File input
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI file input', () => {
  test('valid file exits 0', async () => {
    const file = await tmpFile('valid.jsonl', '{"id":1}\n{"id":2}\n');
    const { exitCode, stdout } = await runCli([file]);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes('valid'));
  });

  test('invalid file exits 1', async () => {
    const file = await tmpFile('invalid.jsonl', '{"id":1}\nBAD\n');
    const { exitCode, stderr } = await runCli([file]);
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('INVALID'));
  });

  test('missing file exits 2', async () => {
    const { exitCode, stderr } = await runCli([join(tmpDir, 'ghost.jsonl')]);
    assert.equal(exitCode, 2);
    assert.ok(stderr.includes('Error'));
  });

  test('no arguments exits 2', async () => {
    const { exitCode } = await runCli([]);
    assert.equal(exitCode, 2);
  });

  test('unknown flag exits 2', async () => {
    const { exitCode, stderr } = await runCli(['--fake-flag']);
    assert.equal(exitCode, 2);
    assert.ok(stderr.includes('Unknown option'));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// --json output
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI --json output', () => {
  test('outputs valid JSON for a valid file', async () => {
    const file = await tmpFile('json-valid.jsonl', '{"id":1}\n{"id":2}\n');
    const { exitCode, stdout } = await runCli([file, '--json']);
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.totalLines, 2);
    assert.equal(parsed.errorCount, 0);
  });

  test('outputs valid JSON for an invalid file', async () => {
    const file = await tmpFile('json-invalid.jsonl', '{"id":1}\nBAD\n');
    const { exitCode, stdout } = await runCli([file, '--json']);
    assert.equal(exitCode, 1);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.valid, false);
    assert.equal(parsed.errorCount, 1);
    assert.equal(parsed.errors[0].line, 2);
    assert.equal(parsed.errors[0].type, 'INVALID_JSON');
  });

  test('JSON output includes source field', async () => {
    const file = await tmpFile('json-source.jsonl', '{"id":1}\n');
    const { stdout } = await runCli([file, '--json']);
    const parsed = JSON.parse(stdout);
    assert.ok('source' in parsed);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// --require-object
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI --require-object', () => {
  test('flags array records and exits 1', async () => {
    const file = await tmpFile('arr.jsonl', '[1,2,3]\n');
    const { exitCode, stderr } = await runCli([file, '--require-object']);
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('NOT_AN_OBJECT'));
  });

  test('valid objects pass and exits 0', async () => {
    const file = await tmpFile('obj.jsonl', '{"id":1}\n{"id":2}\n');
    const { exitCode } = await runCli([file, '--require-object']);
    assert.equal(exitCode, 0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// --required
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI --required', () => {
  test('flags missing keys and exits 1', async () => {
    const file = await tmpFile('miss.jsonl', '{"id":1}\n{"event":"x"}\n');
    const { exitCode, stderr } = await runCli([file, '--required', 'id,event']);
    assert.equal(exitCode, 1);
    assert.ok(stderr.includes('MISSING_KEY'));
  });

  test('all keys present exits 0', async () => {
    const file = await tmpFile('allkeys.jsonl', '{"id":1,"event":"ok"}\n');
    const { exitCode } = await runCli([file, '--required', 'id,event']);
    assert.equal(exitCode, 0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// --max-errors
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI --max-errors', () => {
  test('limits stored errors in JSON output', async () => {
    const lines = Array.from({ length: 10 }, () => 'BAD').join('\n') + '\n';
    const file = await tmpFile('max-err.jsonl', lines);
    const { stdout } = await runCli([file, '--json', '--max-errors', '3']);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.errors.length, 3);
    assert.equal(parsed.errorCount, 10);
    assert.equal(parsed.truncated, true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// stdin
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI stdin', () => {
  test('valid stdin exits 0', async () => {
    const { exitCode } = await runCli(['-'], '{"id":1}\n{"id":2}\n');
    assert.equal(exitCode, 0);
  });

  test('invalid stdin exits 1', async () => {
    const { exitCode } = await runCli(['-'], '{"id":1}\nBAD\n');
    assert.equal(exitCode, 1);
  });

  test('empty stdin exits 0 (no records means no errors)', async () => {
    const { exitCode } = await runCli(['-'], '');
    assert.equal(exitCode, 0);
  });

  test('--json works with stdin', async () => {
    const { exitCode, stdout } = await runCli(['-', '--json'], '{"id":1}\n');
    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.source, '<stdin>');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// exit codes
// ═════════════════════════════════════════════════════════════════════════════

describe('CLI exit codes', () => {
  test('exit 0 for valid input', async () => {
    const file = await tmpFile('exit0.jsonl', '{"ok":true}\n');
    const { exitCode } = await runCli([file]);
    assert.equal(exitCode, 0);
  });

  test('exit 1 for invalid records', async () => {
    const file = await tmpFile('exit1.jsonl', 'BAD\n');
    const { exitCode } = await runCli([file]);
    assert.equal(exitCode, 1);
  });

  test('exit 2 for missing file', async () => {
    const { exitCode } = await runCli(['/tmp/this-file-does-not-exist-jsonl-audit.jsonl']);
    assert.equal(exitCode, 2);
  });
});
