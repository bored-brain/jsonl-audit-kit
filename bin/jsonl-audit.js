#!/usr/bin/env node
/**
 * jsonl-audit.js — Command-line interface for jsonl-audit-kit
 *
 * Usage:
 *   jsonl-audit <file>              Audit a JSONL file
 *   jsonl-audit -                   Read from stdin
 *   cat data.jsonl | jsonl-audit -  Pipe data in
 *
 * Options:
 *   --require-object        Require each record to be a JSON object
 *   --require-array         Require each record to be a JSON array
 *   --required <keys>       Comma-separated list of required top-level keys
 *   --report-blank-lines    Treat blank lines as errors
 *   --max-errors <n>        Maximum number of errors to store (default: 100)
 *   --max-line-bytes <n>    Reject lines longer than this many bytes
 *   --json                  Output results as a JSON object
 *   --version               Print version and exit
 *   --help                  Show usage and exit
 *
 * Exit codes:
 *   0  File is valid (all records passed)
 *   1  File is invalid (one or more records failed)
 *   2  Operational error (file not found, bad arguments, etc.)
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditFile, auditStream } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load package.json for --version ─────────────────────────────────────────
let pkg;
try {
  const pkgPath = resolve(__dirname, '../package.json');
  pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
} catch {
  pkg = { version: '0.0.0' };
}

// ── Argument parsing ─────────────────────────────────────────────────────────

const EXIT_VALID = 0;
const EXIT_INVALID = 1;
const EXIT_ERROR = 2;

function showHelp() {
  process.stdout.write(`
jsonl-audit — Audit JSONL (JSON Lines) files for invalid records

USAGE
  jsonl-audit <file>                     Audit a file
  jsonl-audit -                          Read from stdin
  cat data.jsonl | jsonl-audit -         Pipe data in

OPTIONS
  --require-object          Require each record to be a JSON object ({...})
  --require-array           Require each record to be a JSON array ([...])
  --required <k1,k2,...>    Comma-separated required top-level key names
  --report-blank-lines      Treat blank lines as validation errors
  --max-errors <n>          Max stored errors (default: 100). Scanning always
                            continues to completion; excess errors are counted
                            but not stored.
  --max-line-bytes <n>      Flag lines longer than n bytes
  --json                    Output results as JSON (machine-readable)
  --version                 Print version and exit
  --help                    Show this help and exit

EXIT CODES
  0  All records are valid
  1  One or more records are invalid
  2  Operational error (file not found, permission denied, bad arguments)

EXAMPLES
  jsonl-audit events.jsonl
  jsonl-audit events.jsonl --require-object --required id,event
  jsonl-audit events.jsonl --max-errors 10 --json
  cat events.jsonl | jsonl-audit -
`.trimStart());
}

/**
 * Parse argv into a structured object.
 * Returns { target, options, jsonOutput, error }
 */
function parseArgs(argv) {
  const args = argv.slice(2);
  let target = null;
  let jsonOutput = false;
  const opts = {};
  let error = null;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(EXIT_VALID);
    }

    if (arg === '--version' || arg === '-v') {
      process.stdout.write(`jsonl-audit-kit v${pkg.version}\n`);
      process.exit(EXIT_VALID);
    }

    if (arg === '--json') {
      jsonOutput = true;
      i++;
      continue;
    }

    if (arg === '--require-object') {
      opts.requireObject = true;
      i++;
      continue;
    }

    if (arg === '--require-array') {
      opts.requireArray = true;
      i++;
      continue;
    }

    if (arg === '--report-blank-lines') {
      opts.reportBlankLines = true;
      i++;
      continue;
    }

    if (arg === '--required') {
      const val = args[i + 1];
      if (!val || val.startsWith('--')) {
        error = '--required requires a comma-separated list of key names';
        break;
      }
      opts.requiredKeys = val.split(',').map((k) => k.trim()).filter(Boolean);
      i += 2;
      continue;
    }

    if (arg === '--max-errors') {
      const val = parseInt(args[i + 1], 10);
      if (!Number.isInteger(val) || val < 1) {
        error = '--max-errors requires a positive integer';
        break;
      }
      opts.maxErrors = val;
      i += 2;
      continue;
    }

    if (arg === '--max-line-bytes') {
      const val = parseInt(args[i + 1], 10);
      if (!Number.isInteger(val) || val < 1) {
        error = '--max-line-bytes requires a positive integer';
        break;
      }
      opts.maxLineBytes = val;
      i += 2;
      continue;
    }

    if (arg.startsWith('--')) {
      error = `Unknown option: ${arg}`;
      break;
    }

    // Positional: target file or '-' for stdin
    if (target !== null) {
      error = 'Too many positional arguments — expected one file path or "-"';
      break;
    }
    target = arg;
    i++;
  }

  return { target, options: opts, jsonOutput, error };
}

// ── Output helpers ────────────────────────────────────────────────────────────

function humanOutput(result, source) {
  const label = source === '-' ? '<stdin>' : source;

  if (result.valid) {
    process.stdout.write(
      `✓ ${label}: valid — ${result.totalLines} line(s) checked, 0 errors\n`,
    );
    return;
  }

  process.stderr.write(
    `✗ ${label}: INVALID — ${result.errorCount} error(s) in ${result.totalLines} line(s)\n`,
  );

  if (result.truncated) {
    process.stderr.write(
      `  (showing first ${result.errors.length} of ${result.errorCount} errors)\n`,
    );
  }

  for (const diag of result.errors) {
    const keyInfo = diag.key ? ` [key: ${diag.key}]` : '';
    process.stderr.write(
      `  Line ${diag.line}: [${diag.type}] ${diag.message}${keyInfo}\n`,
    );
  }
}

function jsonOutputFn(result, source) {
  const output = {
    source: source === '-' ? '<stdin>' : source,
    ...result,
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { target, options, jsonOutput, error } = parseArgs(process.argv);

  if (error) {
    process.stderr.write(`Error: ${error}\n\nRun with --help for usage.\n`);
    process.exit(EXIT_ERROR);
  }

  if (target === null) {
    showHelp();
    process.exit(EXIT_ERROR);
  }

  let result;
  try {
    if (target === '-') {
      // Read from stdin
      result = await auditStream(process.stdin, options);
    } else {
      result = await auditFile(target, options);
    }
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(EXIT_ERROR);
  }

  if (jsonOutput) {
    jsonOutputFn(result, target);
  } else {
    humanOutput(result, target);
  }

  process.exit(result.valid ? EXIT_VALID : EXIT_INVALID);
}

main();
