import os

filepath = 'backend/src/services/anticipatoryService.ts'
new_impl = r'''export async function scanForCodeIssues(
  userId: string,
  workspacePath: string,
): Promise<CodeScanResult> {
  logger.info({ userId, workspacePath }, "Starting code issue scan");

  const result: CodeScanResult = {
    vulnerabilities: [],
    outdatedDeps: [],
    codeSmells: [],
  };

  try {
    const pm = await detectPackageManager(workspacePath);
    if (!pm) {
      logger.warn({ userId, workspacePath }, "No supported package manager found (npm/pnpm/yarn)");
      result.codeSmells.push({
          file: 'package.json',
          type: 'setup',
          message: 'No lockfile found. Run npm/pnpm install to generate one for accurate scanning.'
      });
      return result;
    }

    logger.info({ userId, pm }, `Detected package manager: ${pm}`);

    let auditCmd = '';
    let outdatedCmd = '';

    if (pm === 'npm') {
        auditCmd = 'npm audit --json';
        outdatedCmd = 'npm outdated --json';
    } else if (pm === 'pnpm') {
        auditCmd = 'pnpm audit --json';
        outdatedCmd = 'pnpm outdated --json';
    } else if (pm === 'yarn') {
        auditCmd = 'yarn audit --json';
        outdatedCmd = 'yarn outdated --json';
    }

    // Run in parallel
    const [auditRes, outdatedRes] = await Promise.allSettled([
        runCommand(auditCmd, workspacePath),
        runCommand(outdatedCmd, workspacePath)
    ]);

    if (auditRes.status === 'fulfilled') {
        result.vulnerabilities = parseAuditOutput(auditRes.value);
    } else {
        logger.warn({ error: auditRes.reason }, "Audit command failed");
    }

    if (outdatedRes.status === 'fulfilled') {
        result.outdatedDeps = parseOutdatedOutput(outdatedRes.value);
    } else {
        logger.warn({ error: outdatedRes.reason }, "Outdated command failed");
    }

    // Generate insights from scan results
    if (result.vulnerabilities.length > 0) {
      const highSeverity = result.vulnerabilities.filter(v => ['high', 'critical'].includes(v.severity)).length;
      await createInsight({
        userId,
        category: "code_issue",
        severity: highSeverity > 0 ? "critical" : "warning",
        title: `${result.vulnerabilities.length} security vulnerabilities detected`,
        description:
          `Security scan found ${result.vulnerabilities.length} potential vulnerabilities (${highSeverity} high/critical).`,
        suggestedAction:
          `Run \`${pm} audit fix\` to resolve automatically fixable issues.`,
        metadata: { vulnerabilities: result.vulnerabilities.slice(0, 50) },
      });
    }

    if (result.outdatedDeps.length > 0) {
      const breaking = result.outdatedDeps.filter(d => d.breaking).length;
      if (breaking > 0 || result.outdatedDeps.length > 5) {
          await createInsight({
            userId,
            category: "code_issue",
            severity: breaking > 0 ? "warning" : "info",
            title: `${result.outdatedDeps.length} outdated dependencies`,
            description: `${result.outdatedDeps.length} dependencies can be updated (${breaking} breaking changes).`,
            suggestedAction: `Review and update dependencies with \`${pm} update\`.`,
            metadata: { outdatedDeps: result.outdatedDeps.slice(0, 50) },
          });
      }
    }

    logger.info(
      {
        userId,
        vulnerabilities: result.vulnerabilities.length,
        outdatedDeps: result.outdatedDeps.length,
      },
      "Code issue scan complete",
    );
  } catch (err) {
    logger.error({ userId, err }, "Code issue scan failed");
  }

  return result;
}'''

with open(filepath, 'r') as f:
    content = f.read()

start_marker = 'export async function scanForCodeIssues('
start_index = content.find(start_marker)

if start_index == -1:
    print("Could not find start marker")
    exit(1)

# Find end of function
open_braces = 0
found_start = False
end_index = -1

for i in range(start_index, len(content)):
    if content[i] == '{':
        open_braces += 1
        found_start = True
    elif content[i] == '}':
        open_braces -= 1

    if found_start and open_braces == 0:
        end_index = i + 1
        break

if end_index != -1:
    new_content = content[:start_index] + new_impl + content[end_index:]
    with open(filepath, 'w') as f:
        f.write(new_content)
    print("Successfully replaced scanForCodeIssues")
else:
    print("Could not find end of function")
