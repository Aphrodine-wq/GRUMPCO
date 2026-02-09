/**
 * Tool Filtering
 *
 * Filters tools based on conversation context to reduce input token count.
 * Core tools are always included; others only when the conversation mentions
 * relevant keywords.
 *
 * @module toolFiltering
 */

/** Core tools that are always included in every request */
const CORE_TOOL_NAMES = new Set([
    "bash_execute",
    "file_read",
    "file_write",
    "file_edit",
    "list_directory",
    "codebase_search",
]);

/**
 * Optional tools only sent when conversation context suggests need.
 * Maps keyword → tool names.
 */
const FAST_KEYWORD_CHECKS: Record<string, string[]> = {
    "database": ["generate_db_schema", "generate_migrations"],
    "screenshot": [
        "screenshot_url", "browser_run_script", "browser_navigate",
        "browser_click", "browser_type", "browser_get_content", "browser_screenshot",
    ],
    "git": ["git_status", "git_diff", "git_log", "git_commit", "git_branch", "git_push"],
    "npm": ["terminal_execute"],
};

/**
 * Filter tools based on conversation context to reduce token count.
 * Core tools are always included; others only when conversation mentions relevant keywords.
 * OPTIMIZED: Fast string check instead of regex for most cases.
 */
export function filterToolsByContext(
    allTools: Array<{ name: string;[key: string]: unknown }>,
    messages: Array<{ role: string; content: string | unknown }>,
): Array<{ name: string;[key: string]: unknown }> {
    // Build lowercase conversation text for keyword matching (only last 3 messages for speed)
    const textParts = messages.slice(-3).map(m => typeof m.content === "string" ? m.content : "");
    const conversationText = textParts.join(" ").toLowerCase();

    // Determine which contextual tools to include
    const includedNames = new Set(CORE_TOOL_NAMES);

    for (const [keyword, toolNames] of Object.entries(FAST_KEYWORD_CHECKS)) {
        if (conversationText.includes(keyword)) {
            for (const name of toolNames) includedNames.add(name);
        }
    }

    // Always include user-defined tools, MCP tools, and skill tools
    return allTools.filter(t =>
        includedNames.has(t.name) ||
        t.name.startsWith("skill_") ||
        t.name.startsWith("mcp_") ||
        t.name.startsWith("user_")
    );
}
