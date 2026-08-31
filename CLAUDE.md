# CLAUDE.md

## Repo Boundaries

Never edit files outside of this repository (`model-card/`). If a bug or issue is traced to code in another repo, write up a bug report instead of making changes there.

## Ask Before Major Code Changes

- **ALWAYS ask before implementing major changes to the codebase**
- Explain the plan first, get approval, THEN code
- This includes: new features, refactoring, adding files
- Research and exploration is fine — writing code requires permission
- **When discussing possibilities/constraints, DO NOT write code unless explicitly asked**

## Version Files

- Version bumps in this repo are OK when making meaningful changes
- Current version: **1.17.2**

## Code Style

- **Prefer keyword arguments over positional arguments**, especially across file/module boundaries
- **Imports go at the top of the file** — never import in the middle unless there's a circular dependency reason
- **Python 3.11+ type hints are OK** — use `str | Path` not `Union[str, Path]`

## Architecture

This repo is a **rendering library** for model card JSON. It does NOT:
- Orchestrate training or track model generation progress
- Manage status transitions (done/generating/failed)
- Call the FeatrixSphere backend API (that's `generate_model_card.py`, a standalone script)

Three output targets:
- `python/` — pip package `featrix-modelcard`
- `javascript/` — standalone JS for `<script>` tag usage
- `react/` — npm package `@featrix/modelcard`

## Model Card Status Values

Status is set by the backend (taco-fixes repo), NOT by this library. We only render/display it:
- `done` / `ready` — training complete (green)
- `training` — still training (yellow)
- `failed` — training failed (red)
- `unknown` — fallback (gray)

## Publishing

- **Python**: `cd python && bash publish.sh` — publishes `featrix-modelcard` to PyPI
- **React**: `cd react && bash publish.sh` — publishes `@featrix/modelcard` to npm
- **JavaScript**: `cd javascript && bash publish.sh` — standalone JS

## Running Python

- Use anaconda python: `source /Users/admin/anaconda3/bin/activate`
- **Use `python` NOT `python3`** locally — system `python3` is old Xcode Python 3.9
- Do NOT change `python3` to `python` in shell scripts (they run fine on servers)

## Git

- Never commit `.claude/settings.json`
- Never commit `Untitled*.ipynb` scratch notebooks
