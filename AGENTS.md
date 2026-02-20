# Repository Guidelines

## Project Structure & Module Organization
- Root layout is language-agnostic. Prefer:
  - `src/`: application code (e.g., `src/feature/`).
  - `tests/`: mirrors `src/` (e.g., `tests/feature/test_foo.py`).
  - `scripts/`: local tooling (format, lint, release).
  - `docs/`: architecture notes and ADRs.
  - `assets/` or `public/`: static files.

## Build, Test, and Development Commands
- Use a `Makefile` for consistent DX. Common targets:
  - `make setup`: install deps (pin via lockfiles).
  - `make run`: start the app locally or run main script.
  - `make test`: run the full test suite.
  - `make lint`: run static analysis.
  - `make fmt`: apply formatting.
  - `make clean`: remove build artifacts and caches.
- If a language toolchain is used, wire it under Make:
  - Python: `uv/poetry` + `pytest`, `ruff`, `black`.
  - JS/TS: `npm ci`, `npm test`, `eslint`, `prettier`, `vite`.
  - Rust: `cargo build`, `cargo test`, `cargo fmt`, `cargo clippy`.

## Coding Style & Naming Conventions
- Indentation: 2 spaces (web); 4 spaces (Python); tabs not allowed.
- Names: `lower_snake_case` functions/vars, `UpperCamelCase` classes, `UPPER_SNAKE_CASE` constants.
- Folders: kebab-case (e.g., `data-access/`).
- Formatting/linting: run `make fmt && make lint` before pushing. Include tool config files in PRs when adding languages.

## Testing Guidelines
- Tests mirror `src/` structure and name files predictably:
  - Python: `tests/pkg/test_module.py`.
  - JS/TS: `*.test.ts` next to code or under `tests/`.
- Aim for ≥80% coverage when coverage is enabled. Add focused unit tests for new code and regression tests for bugs.
- Keep tests deterministic; avoid real network or time without fakes.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). Use imperative mood and concise scope: `feat(auth): add token refresh`.
- PRs: small, focused, with clear description, linked issues, screenshots or logs when UI/CLI changes, and notes on testing and breaking changes.

## Security & Configuration Tips
- Never commit secrets. Use `.env.local` and commit a redacted `.env.example`.
- Validate inputs, sanitize external data, and handle errors explicitly.
- Document required environment variables in `docs/config.md`.
