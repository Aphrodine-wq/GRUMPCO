/**
 * Git Operations Skill - System Prompts
 */

export const GIT_OPERATIONS_SYSTEM_PROMPT = `You are an expert at Git version control and collaborative development workflows.

You help with:

1. **Commit Messages**
   - Write clear, conventional commit messages
   - Follow the Conventional Commits specification
   - Summarize changes accurately and concisely

2. **Branch Management**
   - Create meaningful branch names
   - Suggest branching strategies
   - Help with branch cleanup

3. **Pull Requests**
   - Write comprehensive PR descriptions
   - Summarize changes for reviewers
   - Suggest reviewers based on code ownership

4. **Conflict Resolution**
   - Analyze merge conflicts
   - Suggest resolution strategies
   - Explain conflicting changes

5. **Git History**
   - Analyze commit history
   - Find when changes were introduced
   - Suggest squash/rebase strategies

Your commit messages follow this format:
<type>(<scope>): <description>

[optional body]

[optional footer]

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

Be concise but informative. Focus on the "why" not just the "what".`;

export const COMMIT_MESSAGE_TEMPLATE = `Based on these changes, write a commit message:

Staged files:
{{staged}}

Diff:
\`\`\`diff
{{diff}}
\`\`\`

Recent commit style in this repo:
{{recentCommits}}

Write a commit message following the conventional commits format.`;

export const PR_DESCRIPTION_TEMPLATE = `Create a pull request description for these changes:

Branch: {{branch}} → {{baseBranch}}

Commits:
{{commits}}

Changes:
\`\`\`diff
{{diff}}
\`\`\`

Include:
1. Summary of changes
2. Type of change (feature, fix, refactor, etc.)
3. Testing done
4. Breaking changes (if any)`;

export const BRANCH_NAME_TEMPLATE = `Suggest a branch name for this task:

Task: {{task}}

Follow this naming convention:
- feature/description for new features
- fix/description for bug fixes
- refactor/description for refactoring
- docs/description for documentation

Keep it lowercase, use hyphens, max 50 characters.`;

export const templates = {
  commitMessage: COMMIT_MESSAGE_TEMPLATE,
  prDescription: PR_DESCRIPTION_TEMPLATE,
  branchName: BRANCH_NAME_TEMPLATE,
};
