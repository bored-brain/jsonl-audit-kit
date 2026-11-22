/**
 * validate-options.js
 *
 * Validates and normalises user-supplied audit options.
 * Throws a TypeError with a human-readable message on bad input.
 */

/**
 * Default option values.
 */
export const DEFAULTS = {
  requireObject: false,
  requireArray: false,
  requiredKeys: [],
  reportBlankLines: false,
  maxErrors: 100,
  maxLineBytes: null,
};

/**
 * Validate and return a fully-resolved options object.
 *
 * @param {object} [userOptions] - Options supplied by the caller.
 * @returns {Required<import('../../types/index.js').AuditOptions>}
 * @throws {TypeError}
 */
export function validateOptions(userOptions = {}) {
  if (userOptions === null || typeof userOptions !== 'object' || Array.isArray(userOptions)) {
    throw new TypeError('options must be a plain object');
  }

  const opts = { ...DEFAULTS, ...userOptions };

  if (typeof opts.requireObject !== 'boolean') {
    throw new TypeError('options.requireObject must be a boolean');
  }
  if (typeof opts.requireArray !== 'boolean') {
    throw new TypeError('options.requireArray must be a boolean');
  }
  if (opts.requireObject && opts.requireArray) {
    throw new TypeError('options.requireObject and options.requireArray cannot both be true');
  }

  if (!Array.isArray(opts.requiredKeys)) {
    throw new TypeError('options.requiredKeys must be an array of strings');
  }
  for (const key of opts.requiredKeys) {
    if (typeof key !== 'string' || key.length === 0) {
      throw new TypeError('Each entry in options.requiredKeys must be a non-empty string');
    }
  }

  if (typeof opts.reportBlankLines !== 'boolean') {
    throw new TypeError('options.reportBlankLines must be a boolean');
  }

  if (!Number.isInteger(opts.maxErrors) || opts.maxErrors < 1) {
    throw new TypeError('options.maxErrors must be a positive integer');
  }

  if (opts.maxLineBytes !== null) {
    if (!Number.isInteger(opts.maxLineBytes) || opts.maxLineBytes < 1) {
      throw new TypeError('options.maxLineBytes must be a positive integer or null');
    }
  }

  return opts;
}
