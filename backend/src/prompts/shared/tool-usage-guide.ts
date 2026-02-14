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
- grep_search: Find code content (function calls, imports, string literals, TODOs). Returns file:line:content. Faster than codebase_search for exact matches.
- codebase_search: Find files by name/path pattern (fuzzy). Use when you don't know the exact text.
- file_read: Read file contents. Use startLine/endLine for large files (>200 lines) — read only what you need.
- search_and_replace: Safest edit tool. Finds exact text and replaces it. Fails loudly if match is ambiguous.
- file_edit: Line-number-based insert/replace/delete. Use when search_and_replace can't express the change.
- file_write: Create new files or overwrite entirely. Always include the complete file content.
- bash_execute / terminal_execute: Run shell commands. Prefer short, targeted commands.
- git_status: Always check before committing to avoid staging unintended files.

Parallel Execution
- When you need to read multiple files, issue ALL file_read/file_outline calls in a SINGLE response — they execute in parallel, not sequentially. This dramatically reduces latency.
- Similarly, batch multiple grep_search calls together when searching for different patterns.
- Do NOT wait for one read to complete before issuing the next.

Error Recovery
- If a tool returns an error, READ the error message carefully, FIX the issue, and RETRY. Do not give up after one failure.
- Common fixes: wrong path → use list_directory to find correct path; ambiguous match → add more surrounding context to search_and_replace; syntax error after edit → re-read the affected section and fix.
- If bash_execute fails with a build/test error, read the error output, identify the failing line, read that file section, fix it, and re-run.

Diff Awareness
- After using file_edit or search_and_replace, you do NOT need to re-read the file — the tool result confirms success.
- After file_write, you already know the file content because you wrote it. Do not re-read.
- Only re-read a file when you need to check content you did NOT write or edit.

Project Scaffolding Pattern (for building new projects)
1. Config files first (package.json, tsconfig.json, etc.)
2. Type definitions / interfaces
3. Core services / business logic
4. API routes / controllers
5. UI components (if applicable)
6. Verify: run build + tests
</tool_strategy>`;
