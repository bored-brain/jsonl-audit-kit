# Contributing to jsonl-audit-kit

Thank you for considering a contribution!

---

## Getting started

```bash
git clone https://github.com/<your-username>/jsonl-audit-kit.git
cd jsonl-audit-kit
npm install   # only devDependencies — there are no runtime dependencies
```

## Running the tests

```bash
npm test
```

The test suite uses Node.js's built-in test runner (`node:test`) and
requires no additional installation.

## Running the examples

```bash
node examples/usage.js
```

## Code style

- Plain JavaScript (ESM) only — do not add TypeScript source.
- One concern per module: keep `validator.js`, `diagnostics.js`, and
  `utils/validate-options.js` focused on their single responsibility.
- All public functions must have JSDoc comments.

## Adding a feature

1. Open an issue describing the feature before implementing it.
2. Write a test first (in `test/`) that describes the desired behaviour.
3. Implement the feature.
4. Run the full test suite and ensure all tests pass.
5. Update `docs/api.md` and the relevant section of `README.md`.
6. Add an entry to `CHANGELOG.md` under `[Unreleased]`.
7. Open a pull request.

## Reporting a bug

Please open a GitHub issue with:

- Node.js version (`node --version`)
- npm version (`npm --version`)
- A minimal reproduction (a small JSONL file and the command you ran)
- The actual output
- The expected output

## Commit message convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `test:` test only
- `refactor:` code change without feature or fix
- `chore:` tooling, CI

## License

By contributing you agree that your contributions will be licensed under
the MIT License.
