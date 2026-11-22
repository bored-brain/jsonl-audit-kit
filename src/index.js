/**
 * index.js — Public API for jsonl-audit-kit
 *
 * This module exposes the two main entry points that library consumers use:
 *
 *   auditFile(filePath, options?)   — audit a file on disk
 *   auditStream(stream, options?)   — audit any readable Node.js stream
 *
 * Both functions resolve to an AuditResult object.
 *
 * Example:
 *
 *   import { auditFile } from 'jsonl-audit-kit';
 *
 *   const result = await auditFile('./events.jsonl', {
 *     requireObject: true,
 *     requiredKeys: ['id', 'event'],
 *   });
 *
 *   if (!result.valid) {
 *     console.error(`Found ${result.errorCount} error(s)`);
 *     for (const err of result.errors) {
 *       console.error(`  Line ${err.line}: [${err.type}] ${err.message}`);
 *     }
 *     process.exit(1);
 *   }
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { validateOptions } from './utils/validate-options.js';
import { auditStream as _auditStream } from './validator.js';

export { DiagnosticType } from './diagnostics.js';

/**
 * Audit a JSONL file at the given path.
 *
 * The file is read using a streaming interface so it is never fully loaded
 * into memory. Only the longest single line needs to fit in the readline
 * buffer.
 *
 * @param {string} filePath - Absolute or relative path to the JSONL file.
 * @param {import('../types/index.d.ts').AuditOptions} [options] - Optional configuration.
 * @returns {Promise<import('../types/index.d.ts').AuditResult>}
 *
 * @throws {TypeError} When options are invalid.
 * @throws {Error} When the file cannot be opened (e.g. ENOENT, EISDIR, EACCES).
 */
export async function auditFile(filePath, options = {}) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new TypeError('filePath must be a non-empty string');
  }

  const opts = validateOptions(options);

  // Check existence and that it is a regular file before opening a stream.
  // This surfaces a clearer error than the stream open error.
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (err) {
    const error = new Error(`Cannot access file "${filePath}": ${err.message}`);
    error.code = err.code;
    throw error;
  }

  if (fileStat.isDirectory()) {
    const error = new Error(`"${filePath}" is a directory, not a file`);
    error.code = 'EISDIR';
    throw error;
  }

  const stream = createReadStream(filePath, { encoding: 'utf8' });

  return _auditStream(stream, opts);
}

/**
 * Audit a JSONL readable stream.
 *
 * Use this when you already have a stream (e.g. process.stdin, an HTTP
 * response body, or a custom source) rather than a file path.
 *
 * @param {import('node:stream').Readable} stream - A readable stream of UTF-8 JSONL data.
 * @param {import('../types/index.d.ts').AuditOptions} [options] - Optional configuration.
 * @returns {Promise<import('../types/index.d.ts').AuditResult>}
 *
 * @throws {TypeError} When the stream argument is not a readable stream.
 * @throws {TypeError} When options are invalid.
 */
export async function auditStream(stream, options = {}) {
  if (!stream || typeof stream.pipe !== 'function') {
    throw new TypeError('stream must be a readable Node.js stream');
  }

  const opts = validateOptions(options);
  return _auditStream(stream, opts);
}
