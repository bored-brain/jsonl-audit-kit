/**
 * TypeScript declarations for jsonl-audit-kit
 *
 * These declarations describe the public JavaScript API.
 * The implementation is in plain JavaScript (ESM).
 */

import type { Readable } from 'node:stream';

// ── Enumerations ──────────────────────────────────────────────────────────────

/**
 * String literals identifying the kind of problem found in a JSONL record.
 */
export declare const DiagnosticType: {
  readonly INVALID_JSON: 'INVALID_JSON';
  readonly BLANK_LINE: 'BLANK_LINE';
  readonly NOT_AN_OBJECT: 'NOT_AN_OBJECT';
  readonly NOT_AN_ARRAY: 'NOT_AN_ARRAY';
  readonly MISSING_KEY: 'MISSING_KEY';
  readonly LINE_TOO_LONG: 'LINE_TOO_LONG';
};

export type DiagnosticTypeName = typeof DiagnosticType[keyof typeof DiagnosticType];

// ── Diagnostic ────────────────────────────────────────────────────────────────

/**
 * A single diagnostic describing one problem in one line of a JSONL file.
 */
export interface Diagnostic {
  /** 1-based line number where the problem occurred. */
  line: number;

  /** Category of the problem. One of the DiagnosticType values. */
  type: DiagnosticTypeName;

  /** Human-readable description of the problem. */
  message: string;

  /**
   * Present on MISSING_KEY diagnostics: the name of the key that was absent.
   */
  key?: string;

  /**
   * Present on LINE_TOO_LONG diagnostics: actual byte length of the line.
   */
  length?: number;

  /**
   * Present on LINE_TOO_LONG diagnostics: the configured byte limit.
   */
  max?: number;
}

// ── Options ───────────────────────────────────────────────────────────────────

/**
 * Configuration options accepted by auditFile and auditStream.
 */
export interface AuditOptions {
  /**
   * When true, every record must be a JSON object ({...}).
   * Records that are arrays, strings, numbers, booleans, or null are flagged
   * with a NOT_AN_OBJECT diagnostic.
   *
   * Cannot be combined with requireArray.
   *
   * @default false
   */
  requireObject?: boolean;

  /**
   * When true, every record must be a JSON array ([...]).
   * Records that are objects, strings, numbers, booleans, or null are flagged
   * with a NOT_AN_ARRAY diagnostic.
   *
   * Cannot be combined with requireObject.
   *
   * @default false
   */
  requireArray?: boolean;

  /**
   * A list of key names that must be present at the top level of every
   * JSON object record. Only applied when the record is a JSON object.
   *
   * @default []
   */
  requiredKeys?: string[];

  /**
   * When true, blank (whitespace-only) lines are reported as errors.
   * When false (the default), blank lines are silently skipped.
   *
   * @default false
   */
  reportBlankLines?: boolean;

  /**
   * Maximum number of diagnostics to retain in the result.errors array.
   *
   * Scanning always continues to completion regardless of this limit.
   * The result.errorCount field reflects the total number of problems found.
   * result.truncated will be true when errorCount exceeds maxErrors.
   *
   * @default 100
   */
  maxErrors?: number;

  /**
   * When set, any line whose UTF-8 byte length exceeds this value is flagged
   * with a LINE_TOO_LONG diagnostic. The line is still parsed after the check.
   *
   * @default null  (no limit)
   */
  maxLineBytes?: number | null;
}

// ── Result ────────────────────────────────────────────────────────────────────

/**
 * The result returned by auditFile and auditStream.
 */
export interface AuditResult {
  /**
   * true if no errors were found; false if any validation problem was detected.
   */
  valid: boolean;

  /**
   * Total number of lines (including blank lines) in the input.
   */
  totalLines: number;

  /**
   * Number of blank (whitespace-only) lines encountered.
   */
  blankLines: number;

  /**
   * Total number of validation problems found.
   * May exceed errors.length when truncated is true.
   */
  errorCount: number;

  /**
   * Stored diagnostics. Contains at most maxErrors entries.
   * When truncated is true, additional errors exist beyond this list.
   */
  errors: Diagnostic[];

  /**
   * true when errorCount exceeds maxErrors and not all errors are stored.
   */
  truncated: boolean;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Audit a JSONL file at the given path.
 *
 * The file is read using Node.js streams and readline — it is never fully
 * loaded into memory, making this suitable for files of any size.
 *
 * @param filePath - Absolute or relative path to the JSONL file.
 * @param options  - Optional audit configuration.
 * @returns A promise that resolves to an AuditResult.
 *
 * @throws {TypeError}  When filePath is not a string, or options are invalid.
 * @throws {Error}      When the file cannot be opened (ENOENT, EACCES, EISDIR).
 */
export declare function auditFile(
  filePath: string,
  options?: AuditOptions,
): Promise<AuditResult>;

/**
 * Audit a JSONL readable stream.
 *
 * Use this when you already have a stream object — for example,
 * process.stdin, an HTTP response body, or a custom readable.
 *
 * @param stream  - A readable Node.js stream containing UTF-8 JSONL data.
 * @param options - Optional audit configuration.
 * @returns A promise that resolves to an AuditResult.
 *
 * @throws {TypeError}  When stream is not a readable, or options are invalid.
 */
export declare function auditStream(
  stream: Readable,
  options?: AuditOptions,
): Promise<AuditResult>;
