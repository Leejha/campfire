<!-- generated from AGENTS.ko.md · ko-hash: b06b3995894ff79a3c2c140f6c50200435cad6d8ce24c814336132e7b4c32c29 · DO NOT EDIT — edit AGENTS.ko.md and ask Codex to regenerate -->

# Codex adapter for the Claude source of truth

Before starting any task, read `.claude/CLAUDE.md` completely and follow it as this repository's instructions. Before taking an action, read `.claude/settings.json` completely and treat every entry in `permissions.deny` as a binding deny policy.

`.claude` is the single source of truth for Claude-related documents. Entries under `.agents/skills` that point into `.claude` are shared links. Do not use those links to edit, duplicate, move, or delete Claude source files.

This file is generated from the Korean source `AGENTS.ko.md`. To change these rules, edit `AGENTS.ko.md`, regenerate the English `AGENTS.md`, and update the generated file header's `ko-hash` with the Korean source's SHA-256. Do not edit the generated English file directly.

## Multi-agent workflow

For complex work, the current primary-agent model (`gpt-6-astra` or `gpt-5.6-sol`) owns requirements analysis, planning, coordination, result integration, and final review.

Delegate bounded execution tasks to `gpt-5.6-luna` subagents, including code changes, command execution, tests, verification, and independent codebase exploration. Give each subagent a concrete task, explicit file ownership or responsibility, and completion criteria. The primary agent waits for delegated work to finish, reviews the results and changes, and then reports completion.

The primary agent handles simple answers and small read-only inspections that do not require independent execution.
