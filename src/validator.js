/**
 * validator.js
 *
 * Core JSONL auditing engine.
 *
 * Reads a readable stream line-by-line using node:readline.
 * Each non-empty line is independently parsed as JSON.
 * Validation rules are applied to each parsed record.
 * Diagnostics are collected up to the configured maximum.
 *
 * Memory behaviour:
 *   - readline buffers one line at a time (bounded by the longest single line).
 *   - Diagnostics are bounded by opts.maxErrors stored entries.
 *   - Total error count is tracked separately from stored diagnostics.
 */

import { createInterface } from 'node:readline';
import {
  invalidJson,
  blankLine,
  notAnObject,
  notAnArray,
  missingKey,
  lineTooLong,
} from './diagnostics.js';

/**
 * Determine the JavaScript type name suitable for a diagnostic message.
 *
 * @param {unknown} value
 * @returns {string}
 */
function typeName(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Process a single non-blank line.
 *
 * Returns an array of zero or more diagnostics for that line.
 *
 * @param {string} rawLine - The raw text of the line (no trailing newline).
 * @param {number} lineNumber - 1-based line number.
 * @param {object} opts - Fully-resolved audit options.
 * @returns {Array<object>}
 */
export function validateLine(rawLine, lineNumber, opts) {
  const diagnostics = [];

  // ── Size check ───────────────────────────────────────────────────────────
  if (opts.maxLineBytes !== null) {
    const byteLen = Buffer.byteLength(rawLine, 'utf8');
    if (byteLen > opts.maxLineBytes) {
      diagnostics.push(lineTooLong(lineNumber, byteLen, opts.maxLineBytes));
      // We still attempt to parse the line; both errors may be reported.
    }
  }

  // ── JSON parse ────────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = JSON.parse(rawLine);
  } catch (err) {
    diagnostics.push(invalidJson(lineNumber, err.message));
    return diagnostics; // Cannot apply structural rules to un-parseable JSON.
  }

  // ── Structural rules ──────────────────────────────────────────────────────
  if (opts.requireObject) {
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      diagnostics.push(notAnObject(lineNumber, typeName(parsed)));
      return diagnostics; // Required-key checks are only meaningful for objects.
    }
  }

  if (opts.requireArray) {
    if (!Array.isArray(parsed)) {
      diagnostics.push(notAnArray(lineNumber, typeName(parsed)));
      return diagnostics;
    }
  }

  // ── Required-key checks ───────────────────────────────────────────────────
  if (opts.requiredKeys.length > 0) {
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const key of opts.requiredKeys) {
        if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
          diagnostics.push(missingKey(lineNumber, key));
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Audit a readable stream containing JSONL data.
 *
 * @param {import('node:stream').Readable} stream - Input stream.
 * @param {object} opts - Fully-resolved audit options (from validateOptions).
 * @returns {Promise<import('../types/index.d.ts').AuditResult>}
 */
export async function auditStream(stream, opts) {
  const rl = createInterface({
    input: stream,
    crlfDelay: Infinity, // Handle both \n and \r\n line endings.
  });

  let totalLines = 0;
  let blankLines = 0;
  let errorCount = 0;
  const errors = [];

  for await (const rawLine of rl) {
    totalLines += 1;

    // ── Blank-line handling ───────────────────────────────────────────────
    if (rawLine.trim() === '') {
      blankLines += 1;
      if (opts.reportBlankLines) {
        errorCount += 1;
        if (errors.length < opts.maxErrors) {
          errors.push(blankLine(totalLines));
        }
      }
      continue;
    }

    // ── Validate the line ─────────────────────────────────────────────────
    const lineDiagnostics = validateLine(rawLine, totalLines, opts);

    for (const diagnostic of lineDiagnostics) {
      errorCount += 1;
      if (errors.length < opts.maxErrors) {
        errors.push(diagnostic);
      }
    }
  }

  const truncated = errors.length < errorCount;

  return {
    valid: errorCount === 0,
    totalLines,
    blankLines,
    errorCount,
    errors,
    truncated,
  };
}
