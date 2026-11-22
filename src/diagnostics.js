/**
 * diagnostics.js
 *
 * Defines diagnostic types and helpers for building structured error records.
 * Each diagnostic describes one problem found during JSONL auditing.
 */

/**
 * Enumeration of all diagnostic types produced by jsonl-audit-kit.
 *
 * @enum {string}
 */
export const DiagnosticType = {
  /** The line could not be parsed as valid JSON. */
  INVALID_JSON: 'INVALID_JSON',

  /** The line is entirely blank (whitespace-only). Only emitted when reportBlankLines is true. */
  BLANK_LINE: 'BLANK_LINE',

  /** The parsed JSON value is not a plain object (e.g. it is an array, string, or number). */
  NOT_AN_OBJECT: 'NOT_AN_OBJECT',

  /** The parsed JSON value is not an array. Only used when requireArray is true. */
  NOT_AN_ARRAY: 'NOT_AN_ARRAY',

  /** A required key is missing from the top-level object. */
  MISSING_KEY: 'MISSING_KEY',

  /** The line is too long (exceeds maxLineBytes). */
  LINE_TOO_LONG: 'LINE_TOO_LONG',
};

/**
 * Build a diagnostic object for an INVALID_JSON error.
 *
 * @param {number} line - 1-based line number.
 * @param {string} message - The JSON parse error message.
 * @returns {{ line: number, type: string, message: string }}
 */
export function invalidJson(line, message) {
  return {
    line,
    type: DiagnosticType.INVALID_JSON,
    message: `JSON parse error: ${message}`,
  };
}

/**
 * Build a diagnostic object for a BLANK_LINE.
 *
 * @param {number} line - 1-based line number.
 * @returns {{ line: number, type: string, message: string }}
 */
export function blankLine(line) {
  return {
    line,
    type: DiagnosticType.BLANK_LINE,
    message: 'Line is blank',
  };
}

/**
 * Build a diagnostic object for a NOT_AN_OBJECT error.
 *
 * @param {number} line - 1-based line number.
 * @param {string} actualType - The JavaScript type of the parsed value.
 * @returns {{ line: number, type: string, message: string }}
 */
export function notAnObject(line, actualType) {
  return {
    line,
    type: DiagnosticType.NOT_AN_OBJECT,
    message: `Expected a JSON object but got ${actualType}`,
  };
}

/**
 * Build a diagnostic object for a NOT_AN_ARRAY error.
 *
 * @param {number} line - 1-based line number.
 * @param {string} actualType - The JavaScript type of the parsed value.
 * @returns {{ line: number, type: string, message: string }}
 */
export function notAnArray(line, actualType) {
  return {
    line,
    type: DiagnosticType.NOT_AN_ARRAY,
    message: `Expected a JSON array but got ${actualType}`,
  };
}

/**
 * Build a diagnostic object for a MISSING_KEY error.
 *
 * @param {number} line - 1-based line number.
 * @param {string} key - The key that is absent from the record.
 * @returns {{ line: number, type: string, message: string, key: string }}
 */
export function missingKey(line, key) {
  return {
    line,
    type: DiagnosticType.MISSING_KEY,
    message: `Required key "${key}" is missing`,
    key,
  };
}

/**
 * Build a diagnostic object for a LINE_TOO_LONG error.
 *
 * @param {number} line - 1-based line number.
 * @param {number} length - Actual byte length of the line.
 * @param {number} max - Maximum allowed byte length.
 * @returns {{ line: number, type: string, message: string, length: number, max: number }}
 */
export function lineTooLong(line, length, max) {
  return {
    line,
    type: DiagnosticType.LINE_TOO_LONG,
    message: `Line is ${length} bytes, exceeds limit of ${max} bytes`,
    length,
    max,
  };
}
