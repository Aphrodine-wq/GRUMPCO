/**
 * Path Policy Service – Guard rails for local repo / file operations.
 * Enforces blocklist (sensitive paths), allowlist (workspace + optional dirs),
 * and optional per-operation checks for read/write/delete.
 */

import path from "path";

export type PathOperation = "read" | "write" | "delete" | "list";

export interface PathPolicyOptions {
  workspaceRoot: string;
  allowedDirs?: string[];
  /** If true, only paths under workspaceRoot or allowedDirs are allowed. Default true. */
  allowlistOnly?: boolean;
}

export type ResolvePathResult =
  | { ok: true; resolved: string }
  | { ok: false; reason: string };

/** Paths/patterns that are always blocked (sensitive or dangerous). */
const BLOCKLIST_PATTERNS: Array<string | RegExp> = [
  /.env$/i,
  /\.env\./i,
  /\.env\.\w+$/i,
  /.git(\/|$)/i,
  /node_modules(\/|$)/i,
  /.+\/\.ssh(\/|$)/,
  /.+\/\.aws(\/|$)/,
  /.+\/\.config(\/|$)/,
  /\.npmrc$/i,
  /.+\/\.netrc$/i,
  /\.dockercfg$/i,
  /.+\/\.gnupg(\/|$)/,
  /.+\/\.password-store(\/|$)/,
  /\.env\.local$/i,
  /\.env\.production$/i,
  /\.env\.development$/i,
];

/**
 * Resolve and validate a requested path for a given operation.
 * Returns { ok: true, resolved } or { ok: false, reason }.
 */
export function resolvePath(
  requestedPath: string,
  operation: PathOperation,
  options: PathPolicyOptions,
): ResolvePathResult {
  const { workspaceRoot, allowedDirs = [], allowlistOnly = true } = options;
  const normalizedRoot = path.resolve(workspaceRoot);
  const normalized = path.normalize(requestedPath);
  const isAbsolute = path.isAbsolute(requestedPath);
  const resolved = isAbsolute
    ? path.resolve(requestedPath)
    : path.resolve(normalizedRoot, normalized);

  // Blocklist: sensitive paths
  const pathForBlock = resolved.replace(/\\/g, "/");
  for (const p of BLOCKLIST_PATTERNS) {
    if (typeof p === "string") {
      if (pathForBlock.includes(p) || pathForBlock.endsWith(p)) {
        return {
          ok: false,
          reason: `Access blocked: path matches blocklist (${p})`,
        };
      }
    } else {
      if (p.test(pathForBlock)) {
        return {
          ok: false,
          reason:
            "Access blocked: path matches sensitive blocklist (e.g. .env, .git, node_modules, .ssh)",
        };
      }
    }
  }

  // Allowlist: must be under workspace or explicitly allowed
  if (allowlistOnly) {
    const underWorkspace =
      resolved === normalizedRoot ||
      resolved.startsWith(normalizedRoot + path.sep);
    let allowed = underWorkspace;
    if (!allowed && allowedDirs.length > 0) {
      for (const dir of allowedDirs) {
        const d = path.resolve(dir);
        if (resolved === d || resolved.startsWith(d + path.sep)) {
          allowed = true;
          break;
        }
      }
    }
    if (!allowed) {
      return {
        ok: false,
        reason:
          "Path is outside workspace and not in allowed directories. Use a path under the workspace root or add the directory to allowed dirs in settings.",
      };
    }
  }

  // Traversal: no .. escaping
  if (normalized.includes("..")) {
    return { ok: false, reason: "Invalid path: cannot use .. in paths" };
  }

  return { ok: true, resolved };
}

/**
 * Check if a path is blocked by the blocklist (does not check allowlist).
 * Useful for UI to pre-warn.
 */
export function isPathBlocked(requestedPath: string): boolean {
  const pathForBlock = path.resolve(requestedPath).replace(/\\/g, "/");
  for (const p of BLOCKLIST_PATTERNS) {
    if (typeof p === "string") {
      if (pathForBlock.includes(p) || pathForBlock.endsWith(p)) return true;
    } else {
      if (p.test(pathForBlock)) return true;
    }
  }
  return false;
}
