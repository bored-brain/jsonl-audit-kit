/**
 * usage.js — API usage examples for jsonl-audit-kit
 *
 * Run with: node examples/usage.js
 */

import { auditFile, auditStream, DiagnosticType } from '../src/index.js';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Example 1: Audit a valid file ─────────────────────────────────────────────

console.log('=== Example 1: Valid file ===');
{
  const result = await auditFile(join(__dirname, 'valid.jsonl'));
  console.log('valid:', result.valid);
  console.log('totalLines:', result.totalLines);
  console.log('errorCount:', result.errorCount);
  // → valid: true, totalLines: 5, errorCount: 0
}

// ── Example 2: Audit a file with errors ──────────────────────────────────────

console.log('\n=== Example 2: File with errors ===');
{
  const result = await auditFile(join(__dirname, 'invalid.jsonl'), {
    requireObject: true,
    requiredKeys: ['id', 'event'],
  });

  console.log('valid:', result.valid);
  console.log('totalLines:', result.totalLines);
  console.log('errorCount:', result.errorCount);
  for (const err of result.errors) {
    const key = err.key ? ` [key: ${err.key}]` : '';
    console.log(`  Line ${err.line}: [${err.type}] ${err.message}${key}`);
  }
}

// ── Example 3: Audit a stream ────────────────────────────────────────────────

console.log('\n=== Example 3: In-memory stream ===');
{
  const data = [
    '{"id":1,"event":"created"}',
    '{"id":2,"event":"updated"}',
    'this is not json',
    '{"id":4,"event":"deleted"}',
  ].join('\n') + '\n';

  const stream = Readable.from([data]);
  const result = await auditStream(stream, { requireObject: true });

  console.log('valid:', result.valid);
  console.log('errorCount:', result.errorCount);
  for (const err of result.errors) {
    console.log(`  Line ${err.line}: ${err.message}`);
  }
}

// ── Example 4: Bounded error collection ──────────────────────────────────────

console.log('\n=== Example 4: Bounded error collection ===');
{
  const lines = Array.from({ length: 20 }, (_, i) => `BAD LINE ${i}`).join('\n') + '\n';
  const stream = Readable.from([lines]);

  const result = await auditStream(stream, { maxErrors: 5 });

  console.log('totalLines:', result.totalLines);
  console.log('errorCount:', result.errorCount);       // 20
  console.log('stored errors:', result.errors.length); // 5 (capped)
  console.log('truncated:', result.truncated);          // true
}

// ── Example 5: Using DiagnosticType for filtering ────────────────────────────

console.log('\n=== Example 5: Filtering by diagnostic type ===');
{
  const data = '{"id":1}\n[1,2]\n{"id":3}\nBAD\n';
  const stream = Readable.from([data]);
  const result = await auditStream(stream, { requireObject: true });

  const parseErrors = result.errors.filter((e) => e.type === DiagnosticType.INVALID_JSON);
  const typeErrors  = result.errors.filter((e) => e.type === DiagnosticType.NOT_AN_OBJECT);

  console.log(`INVALID_JSON errors: ${parseErrors.length}`);
  console.log(`NOT_AN_OBJECT errors: ${typeErrors.length}`);
}

console.log('\nAll examples complete.');
