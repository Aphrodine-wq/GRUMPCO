import os

filepath = 'backend/src/services/anticipatoryService.ts'
new_helpers = r'''
// ========== Helper Functions ==========

async function detectPackageManager(workspacePath: string): Promise<"npm" | "pnpm" | "yarn" | null> {
  try {
    const files = await fs.readdir(workspacePath);
    if (files.includes("pnpm-lock.yaml")) return "pnpm";
    if (files.includes("yarn.lock")) return "yarn";
    if (files.includes("package-lock.json")) return "npm";
    return null;
  } catch (error) {
    return null;
  }
}

async function runCommand(cmd: string, cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (error: any) {
    // npm/pnpm audit return non-zero exit code if vulns found
    if (error.stdout) return error.stdout;
    throw error;
  }
}

function parseAuditOutput(jsonOutput: string): CodeScanResult["vulnerabilities"] {
  const vulnerabilities: CodeScanResult["vulnerabilities"] = [];
  try {
    const data = JSON.parse(jsonOutput);

    // npm 7+ "vulnerabilities" object
    if (data.vulnerabilities && !data.advisories) {
      for (const [pkgName, vuln] of Object.entries(data.vulnerabilities) as [string, any][]) {
        if (Array.isArray(vuln.via)) {
          for (const via of vuln.via) {
            if (typeof via === "object") {
              vulnerabilities.push({
                severity: via.severity || vuln.severity || "low",
                file: `package.json > ${pkgName}`,
                message: via.title || "Vulnerability detected",
                cwe: Array.isArray(via.cwe) ? via.cwe.join(", ") : via.cwe,
              });
            }
          }
        }
      }
    }
    // npm 6 / pnpm "advisories" object
    else if (data.advisories) {
      for (const advisory of Object.values(data.advisories) as any[]) {
        const severity = advisory.severity || "low";
        const message = advisory.title || "Vulnerability detected";
        const cwe = Array.isArray(advisory.cwe) ? advisory.cwe.join(", ") : advisory.cwe;

        if (advisory.findings && Array.isArray(advisory.findings)) {
          for (const finding of advisory.findings) {
            const paths = finding.paths || [];
            for (const p of paths) {
              vulnerabilities.push({
                severity,
                file: `package.json > ${p}`,
                message,
                cwe,
              });
            }
            if (paths.length === 0) {
              vulnerabilities.push({
                severity,
                file: `package.json > ${advisory.module_name}`,
                message,
                cwe,
              });
            }
          }
        } else {
           vulnerabilities.push({
              severity,
              file: `package.json > ${advisory.module_name}`,
              message,
              cwe,
           });
        }
      }
    }
  } catch (e) {
    logger.error({ error: e }, "Failed to parse audit output");
  }
  return vulnerabilities;
}

function parseOutdatedOutput(jsonOutput: string): CodeScanResult["outdatedDeps"] {
  const outdated: CodeScanResult["outdatedDeps"] = [];
  try {
    const data = JSON.parse(jsonOutput);
    for (const [name, info] of Object.entries(data) as [string, any][]) {
      const current = info.current || info.wanted || "unknown";
      const latest = info.latest || "unknown";

      let breaking = false;
      if (current !== "unknown" && latest !== "unknown") {
          const currentMajor = parseInt(current.split('.')[0]);
          const latestMajor = parseInt(latest.split('.')[0]);
          if (!isNaN(currentMajor) && !isNaN(latestMajor) && latestMajor > currentMajor) {
              breaking = true;
          }
      }

      outdated.push({
        name,
        current,
        latest,
        breaking,
      });
    }
  } catch (e) {
    logger.error({ error: e }, "Failed to parse outdated output");
  }
  return outdated;
}

// ========== Code Issues Detection ==========
'''

with open(filepath, 'r') as f:
    content = f.read()

target = '// ========== Code Issues Detection =========='
if target in content:
    new_content = content.replace(target, new_helpers)
    with open(filepath, 'w') as f:
        f.write(new_content)
    print("Successfully updated file")
else:
    print("Target string not found")
