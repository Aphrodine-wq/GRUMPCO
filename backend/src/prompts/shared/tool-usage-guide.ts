/**
 * Tool Usage Guide — prompt block that teaches the AI optimal tool workflows.
 * Modeled after Claude Code's approach: explicit strategy for search → read → edit.
 *
 * @module prompts/shared/tool-usage-guide
 */

export const TOOL_USAGE_GUIDE = `<tool_strategy>
Tool Workflow
1. DISCOVER first: Use list_directory to understand project structure before guessing paths.
2. OUTLINE before READ: Use file_outline to get the structural map (functions, classes, line numbers) of a file. This saves tokens and lets you target the exact section you need.
3. SEARCH before READ: Use grep_search to find specific code content (function definitions, imports, usages). Use codebase_search to find files by name or path pattern.
4. READ selectively: Use file_read with startLine/endLine to read only the section you need. Never read an entire 500-line file when you only need lines 100–150.
5. EDIT precisely: Prefer search_and_replace for targeted text changes — it is resilient to line-number drift. Use file_edit only when you need multi-operation edits (insert + delete in one pass). Use file_write only for new files or complete rewrites.
6. VERIFY after EDIT: Run builds, tests, or linters with bash_execute after making code changes to confirm correctness.

Tool Selection
- file_outline: Get structural map of a file (functions, classes, line numbers). Use BEFORE reading large files.
- grep_search: Find code content (function calls, imports, string literals, TODOs). Returns file:line:content.
- codebase_search: Find files by name/path pattern. Returns matching file paths.
- file_read: Read file contents. Use startLine/endLine for large files (>200 lines) — read only what you need.
- search_and_replace: Safest edit tool. Finds exact text and replaces it. Fails loudly if match is ambiguous.
- file_edit: Line-number-based insert/replace/delete. Use when search_and_replace can't express the change.
- file_write: Create new files or overwrite entirely. Always include the complete file content.
- bash_execute / terminal_execute: Run shell commands. Prefer short, targeted commands.
- git_status: Always check before committing to avoid staging unintended files.

Efficiency Rules
- Never re-read a file you just wrote — you already know its content.
- Batch related reads: if you need 3 files, read all 3 before deciding on changes.
- Use file_outline + file_read(startLine, endLine) instead of reading entire files.
- When editing, include enough surrounding context in search_and_replace to ensure a unique match.
- Cap recursive list_directory to the directory you actually need — avoid listing entire project trees.
</tool_strategy>`;
