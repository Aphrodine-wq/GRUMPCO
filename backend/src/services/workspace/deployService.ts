/**
 * Vercel/Netlify Deploy Integration Service
 * One-click deploys, deployment status monitoring, environment management
 */

import logger from "../../middleware/logger.js";
import {
  getAccessToken,
  isTokenExpired,
  refreshOAuthTokens,
} from "../integrations/integrationService.js";

// ========== Types ==========

export type DeployProvider = "vercel" | "netlify";

export interface DeployProject {
  id: string;
  name: string;
  provider: DeployProvider;
  url?: string;
  framework?: string;
  createdAt: string;
  updatedAt: string;
  repo?: {
    provider: "github" | "gitlab" | "bitbucket";
    owner: string;
    name: string;
    branch?: string;
  };
}

export interface Deployment {
  id: string;
  projectId: string;
  provider: DeployProvider;
  url: string;
  state: "queued" | "building" | "ready" | "error" | "cancelled";
  createdAt: string;
  readyAt?: string;
  source?: {
    type: "git" | "cli" | "api";
    branch?: string;
    commit?: string;
    message?: string;
  };
  error?: {
    code: string;
    message: string;
  };
  meta?: Record<string, unknown>;
}

export interface EnvVariable {
  id?: string;
  key: string;
  value: string;
  target: ("production" | "preview" | "development")[];
  type?: "plain" | "secret" | "encrypted";
}

export interface Domain {
  id: string;
  name: string;
  verified: boolean;
  createdAt: string;
}

export interface DeployHook {
  id: string;
  name: string;
  url: string;
  branch?: string;
  createdAt: string;
}

export interface CreateProjectInput {
  name: string;
  framework?: string;
  gitRepository?: {
    provider: "github" | "gitlab" | "bitbucket";
    repo: string; // format: "owner/repo"
    branch?: string;
  };
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  rootDirectory?: string;
  envVariables?: EnvVariable[];
}

export interface DeployOptions {
  branch?: string;
  clear?: boolean;
  production?: boolean;
}

// ========== Helper Functions ==========

async function getValidVercelToken(userId: string): Promise<string | null> {
  if (await isTokenExpired(userId, "vercel")) {
    const refreshed = await refreshOAuthTokens(userId, "vercel");
    if (!refreshed) {
      logger.warn({ userId }, "Failed to refresh Vercel token");
      return null;
    }
  }
  return getAccessToken(userId, "vercel");
}

async function getValidNetlifyToken(userId: string): Promise<string | null> {
  if (await isTokenExpired(userId, "netlify")) {
    const refreshed = await refreshOAuthTokens(userId, "netlify");
    if (!refreshed) {
      logger.warn({ userId }, "Failed to refresh Netlify token");
      return null;
    }
  }
  return getAccessToken(userId, "netlify");
}

async function vercelFetch<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> {
  const token = await getValidVercelToken(userId);
  if (!token) {
    logger.error({ userId }, "No valid Vercel token");
    return null;
  }

  const url = `https://api.vercel.com${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(
        { status: res.status, error: errorText, endpoint },
        "Vercel API error",
      );
      return null;
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    logger.error(
      { error: (err as Error).message, endpoint },
      "Vercel fetch error",
    );
    return null;
  }
}

async function netlifyFetch<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> {
  const token = await getValidNetlifyToken(userId);
  if (!token) {
    logger.error({ userId }, "No valid Netlify token");
    return null;
  }

  const url = `https://api.netlify.com/api/v1${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(
        { status: res.status, error: errorText, endpoint },
        "Netlify API error",
      );
      return null;
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    logger.error(
      { error: (err as Error).message, endpoint },
      "Netlify fetch error",
    );
    return null;
  }
}

// ========== Vercel Functions ==========

export async function getVercelProjects(
  userId: string,
): Promise<DeployProject[]> {
  interface VercelProject {
    id: string;
    name: string;
    framework?: string;
    createdAt: number;
    updatedAt: number;
    link?: {
      type: string;
      org: string;
      repo: string;
      productionBranch?: string;
    };
  }

  const result = await vercelFetch<{ projects: VercelProject[] }>(
    userId,
    "/v9/projects",
  );
  if (!result) return [];

  return result.projects.map((p) => ({
    id: p.id,
    name: p.name,
    provider: "vercel" as const,
    framework: p.framework,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString(),
    repo: p.link
      ? {
          provider: p.link.type as "github" | "gitlab" | "bitbucket",
          owner: p.link.org,
          name: p.link.repo,
          branch: p.link.productionBranch,
        }
      : undefined,
  }));
}

export async function getVercelProject(
  userId: string,
  projectId: string,
): Promise<DeployProject | null> {
  interface VercelProject {
    id: string;
    name: string;
    framework?: string;
    createdAt: number;
    updatedAt: number;
    link?: {
      type: string;
      org: string;
      repo: string;
      productionBranch?: string;
    };
  }

  const result = await vercelFetch<VercelProject>(
    userId,
    `/v9/projects/${projectId}`,
  );
  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    provider: "vercel",
    framework: result.framework,
    createdAt: new Date(result.createdAt).toISOString(),
    updatedAt: new Date(result.updatedAt).toISOString(),
    repo: result.link
      ? {
          provider: result.link.type as "github" | "gitlab" | "bitbucket",
          owner: result.link.org,
          name: result.link.repo,
          branch: result.link.productionBranch,
        }
      : undefined,
  };
}

export async function createVercelProject(
  userId: string,
  input: CreateProjectInput,
): Promise<DeployProject | null> {
  const body: Record<string, unknown> = {
    name: input.name,
    framework: input.framework,
  };

  if (input.gitRepository) {
    body.gitRepository = {
      type: input.gitRepository.provider,
      repo: input.gitRepository.repo,
    };
  }

  if (input.buildCommand) body.buildCommand = input.buildCommand;
  if (input.outputDirectory) body.outputDirectory = input.outputDirectory;
  if (input.installCommand) body.installCommand = input.installCommand;
  if (input.rootDirectory) body.rootDirectory = input.rootDirectory;

  const result = await vercelFetch<{ id: string; name: string }>(
    userId,
    "/v10/projects",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (result) {
    logger.info(
      { projectId: result.id, name: result.name },
      "Vercel project created",
    );
    return getVercelProject(userId, result.id);
  }

  return null;
}

export async function getVercelDeployments(
  userId: string,
  projectId: string,
  limit: number = 20,
): Promise<Deployment[]> {
  interface VercelDeployment {
    uid: string;
    name: string;
    url: string;
    state: string;
    created: number;
    ready?: number;
    source?: string;
    meta?: { gitBranch?: string; gitCommit?: string; gitMessage?: string };
  }

  const result = await vercelFetch<{ deployments: VercelDeployment[] }>(
    userId,
    `/v6/deployments?projectId=${projectId}&limit=${limit}`,
  );
  if (!result) return [];

  return result.deployments.map((d) => ({
    id: d.uid,
    projectId,
    provider: "vercel" as const,
    url: `https://${d.url}`,
    state: d.state as Deployment["state"],
    createdAt: new Date(d.created).toISOString(),
    readyAt: d.ready ? new Date(d.ready).toISOString() : undefined,
    source: d.meta
      ? {
          type: (d.source as "git" | "cli" | "api") ?? "api",
          branch: d.meta.gitBranch,
          commit: d.meta.gitCommit,
          message: d.meta.gitMessage,
        }
      : undefined,
  }));
}

export async function triggerVercelDeploy(
  userId: string,
  projectId: string,
  options: DeployOptions = {},
): Promise<Deployment | null> {
  // Use deploy hooks or create deployment via API
  const body: Record<string, unknown> = {
    name: projectId,
    target: options.production ? "production" : "preview",
  };

  if (options.branch) {
    body.gitSource = { ref: options.branch };
  }

  const result = await vercelFetch<{
    id: string;
    url: string;
    state: string;
    createdAt: number;
  }>(userId, "/v13/deployments", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (result) {
    logger.info({ deploymentId: result.id }, "Vercel deployment triggered");
    return {
      id: result.id,
      projectId,
      provider: "vercel",
      url: `https://${result.url}`,
      state: result.state as Deployment["state"],
      createdAt: new Date(result.createdAt).toISOString(),
    };
  }

  return null;
}

export async function cancelVercelDeployment(
  userId: string,
  deploymentId: string,
): Promise<boolean> {
  const result = await vercelFetch<object>(
    userId,
    `/v12/deployments/${deploymentId}/cancel`,
    {
      method: "PATCH",
    },
  );
  return result !== null;
}

export async function getVercelEnvVars(
  userId: string,
  projectId: string,
): Promise<EnvVariable[]> {
  interface VercelEnv {
    id: string;
    key: string;
    value: string;
    target: string[];
    type: string;
  }

  const result = await vercelFetch<{ envs: VercelEnv[] }>(
    userId,
    `/v9/projects/${projectId}/env`,
  );
  if (!result) return [];

  return result.envs.map((e) => ({
    id: e.id,
    key: e.key,
    value: e.value,
    target: e.target as EnvVariable["target"],
    type: e.type as EnvVariable["type"],
  }));
}

export async function setVercelEnvVar(
  userId: string,
  projectId: string,
  envVar: EnvVariable,
): Promise<boolean> {
  const result = await vercelFetch<object>(
    userId,
    `/v10/projects/${projectId}/env`,
    {
      method: "POST",
      body: JSON.stringify({
        key: envVar.key,
        value: envVar.value,
        target: envVar.target,
        type: envVar.type ?? "encrypted",
      }),
    },
  );

  if (result) {
    logger.info({ projectId, key: envVar.key }, "Vercel env var set");
    return true;
  }

  return false;
}

export async function deleteVercelEnvVar(
  userId: string,
  projectId: string,
  envId: string,
): Promise<boolean> {
  const result = await vercelFetch<object>(
    userId,
    `/v9/projects/${projectId}/env/${envId}`,
    {
      method: "DELETE",
    },
  );
  return result !== null;
}

export async function getVercelDomains(
  userId: string,
  projectId: string,
): Promise<Domain[]> {
  interface VercelDomain {
    name: string;
    verified: boolean;
    createdAt: number;
  }

  const result = await vercelFetch<{ domains: VercelDomain[] }>(
    userId,
    `/v9/projects/${projectId}/domains`,
  );
  if (!result) return [];

  return result.domains.map((d) => ({
    id: d.name,
    name: d.name,
    verified: d.verified,
    createdAt: new Date(d.createdAt).toISOString(),
  }));
}

export async function addVercelDomain(
  userId: string,
  projectId: string,
  domain: string,
): Promise<Domain | null> {
  const result = await vercelFetch<{
    name: string;
    verified: boolean;
    createdAt: number;
  }>(userId, `/v10/projects/${projectId}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });

  if (result) {
    logger.info({ projectId, domain }, "Vercel domain added");
    return {
      id: result.name,
      name: result.name,
      verified: result.verified,
      createdAt: new Date(result.createdAt).toISOString(),
    };
  }

  return null;
}

// ========== Netlify Functions ==========

export async function getNetlifySites(
  userId: string,
): Promise<DeployProject[]> {
  interface NetlifySite {
    id: string;
    name: string;
    url: string;
    created_at: string;
    updated_at: string;
    build_settings?: {
      repo_url?: string;
      repo_branch?: string;
    };
  }

  const result = await netlifyFetch<NetlifySite[]>(userId, "/sites");
  if (!result) return [];

  return result.map((s) => {
    let repo: DeployProject["repo"];
    if (s.build_settings?.repo_url) {
      // Parse GitHub URL
      const match = s.build_settings.repo_url.match(
        /github\.com[/:]([^/]+)\/([^/.]+)/,
      );
      if (match) {
        repo = {
          provider: "github",
          owner: match[1],
          name: match[2],
          branch: s.build_settings.repo_branch,
        };
      }
    }

    return {
      id: s.id,
      name: s.name,
      provider: "netlify" as const,
      url: s.url,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      repo,
    };
  });
}

export async function getNetlifySite(
  userId: string,
  siteId: string,
): Promise<DeployProject | null> {
  interface NetlifySite {
    id: string;
    name: string;
    url: string;
    created_at: string;
    updated_at: string;
    build_settings?: {
      repo_url?: string;
      repo_branch?: string;
    };
  }

  const result = await netlifyFetch<NetlifySite>(userId, `/sites/${siteId}`);
  if (!result) return null;

  let repo: DeployProject["repo"];
  if (result.build_settings?.repo_url) {
    const match = result.build_settings.repo_url.match(
      /github\.com[/:]([^/]+)\/([^/.]+)/,
    );
    if (match) {
      repo = {
        provider: "github",
        owner: match[1],
        name: match[2],
        branch: result.build_settings.repo_branch,
      };
    }
  }

  return {
    id: result.id,
    name: result.name,
    provider: "netlify",
    url: result.url,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
    repo,
  };
}

export async function createNetlifySite(
  userId: string,
  input: CreateProjectInput,
): Promise<DeployProject | null> {
  const body: Record<string, unknown> = {
    name: input.name,
  };

  if (input.gitRepository) {
    body.repo = {
      provider: input.gitRepository.provider,
      repo: input.gitRepository.repo,
      private: true,
      branch: input.gitRepository.branch ?? "main",
      cmd: input.buildCommand,
      dir: input.outputDirectory,
    };
  }

  const result = await netlifyFetch<{ id: string; name: string }>(
    userId,
    "/sites",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  if (result) {
    logger.info(
      { siteId: result.id, name: result.name },
      "Netlify site created",
    );
    return getNetlifySite(userId, result.id);
  }

  return null;
}

export async function getNetlifyDeploys(
  userId: string,
  siteId: string,
  limit: number = 20,
): Promise<Deployment[]> {
  interface NetlifyDeploy {
    id: string;
    site_id: string;
    url: string;
    state: string;
    created_at: string;
    published_at?: string;
    branch?: string;
    commit_ref?: string;
    title?: string;
    error_message?: string;
  }

  const result = await netlifyFetch<NetlifyDeploy[]>(
    userId,
    `/sites/${siteId}/deploys?per_page=${limit}`,
  );
  if (!result) return [];

  return result.map((d) => ({
    id: d.id,
    projectId: d.site_id,
    provider: "netlify" as const,
    url: d.url,
    state: mapNetlifyState(d.state),
    createdAt: d.created_at,
    readyAt: d.published_at,
    source: {
      type: "git" as const,
      branch: d.branch,
      commit: d.commit_ref,
      message: d.title,
    },
    error: d.error_message
      ? { code: "BUILD_ERROR", message: d.error_message }
      : undefined,
  }));
}

function mapNetlifyState(state: string): Deployment["state"] {
  switch (state) {
    case "ready":
    case "prepared":
      return "ready";
    case "building":
    case "processing":
    case "uploading":
    case "enqueued":
      return "building";
    case "error":
      return "error";
    default:
      return "queued";
  }
}

export async function triggerNetlifyDeploy(
  userId: string,
  siteId: string,
  options: DeployOptions = {},
): Promise<Deployment | null> {
  const body: Record<string, unknown> = {};
  if (options.clear) {
    body.clear_cache = true;
  }

  const result = await netlifyFetch<{
    id: string;
    site_id: string;
    url: string;
    state: string;
    created_at: string;
  }>(userId, `/sites/${siteId}/builds`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (result) {
    logger.info({ deployId: result.id, siteId }, "Netlify build triggered");
    return {
      id: result.id,
      projectId: result.site_id,
      provider: "netlify",
      url: result.url,
      state: mapNetlifyState(result.state),
      createdAt: result.created_at,
    };
  }

  return null;
}

export async function cancelNetlifyDeploy(
  userId: string,
  deployId: string,
): Promise<boolean> {
  const result = await netlifyFetch<object>(
    userId,
    `/deploys/${deployId}/cancel`,
    {
      method: "POST",
    },
  );
  return result !== null;
}

export async function getNetlifyEnvVars(
  userId: string,
  siteId: string,
): Promise<EnvVariable[]> {
  interface NetlifyEnvVar {
    key: string;
    values: Array<{
      id: string;
      value: string;
      context: string;
    }>;
  }

  // Get account ID first
  const accounts = await netlifyFetch<Array<{ id: string }>>(
    userId,
    "/accounts",
  );
  if (!accounts || accounts.length === 0) return [];

  const accountId = accounts[0].id;
  const result = await netlifyFetch<NetlifyEnvVar[]>(
    userId,
    `/accounts/${accountId}/env?site_id=${siteId}`,
  );
  if (!result) return [];

  return result.flatMap((e) =>
    e.values.map((v) => ({
      id: v.id,
      key: e.key,
      value: v.value,
      target: [mapNetlifyContext(v.context)],
    })),
  );
}

function mapNetlifyContext(
  context: string,
): "production" | "preview" | "development" {
  switch (context) {
    case "production":
      return "production";
    case "deploy-preview":
    case "branch-deploy":
      return "preview";
    case "dev":
      return "development";
    default:
      return "production";
  }
}

export async function setNetlifyEnvVar(
  userId: string,
  siteId: string,
  envVar: EnvVariable,
): Promise<boolean> {
  const accounts = await netlifyFetch<Array<{ id: string }>>(
    userId,
    "/accounts",
  );
  if (!accounts || accounts.length === 0) return false;

  const accountId = accounts[0].id;
  const contexts = envVar.target.map((t) => {
    switch (t) {
      case "production":
        return "production";
      case "preview":
        return "deploy-preview";
      case "development":
        return "dev";
      default:
        return "all";
    }
  });

  const result = await netlifyFetch<object>(
    userId,
    `/accounts/${accountId}/env?site_id=${siteId}`,
    {
      method: "POST",
      body: JSON.stringify([
        {
          key: envVar.key,
          values: contexts.map((c) => ({
            value: envVar.value,
            context: c,
          })),
        },
      ]),
    },
  );

  if (result) {
    logger.info({ siteId, key: envVar.key }, "Netlify env var set");
    return true;
  }

  return false;
}

export async function getNetlifyDeployHooks(
  userId: string,
  siteId: string,
): Promise<DeployHook[]> {
  interface NetlifyHook {
    id: string;
    title: string;
    url: string;
    branch?: string;
    created_at: string;
  }

  const result = await netlifyFetch<NetlifyHook[]>(
    userId,
    `/sites/${siteId}/build_hooks`,
  );
  if (!result) return [];

  return result.map((h) => ({
    id: h.id,
    name: h.title,
    url: h.url,
    branch: h.branch,
    createdAt: h.created_at,
  }));
}

export async function createNetlifyDeployHook(
  userId: string,
  siteId: string,
  name: string,
  branch?: string,
): Promise<DeployHook | null> {
  const result = await netlifyFetch<{
    id: string;
    title: string;
    url: string;
    branch?: string;
    created_at: string;
  }>(userId, `/sites/${siteId}/build_hooks`, {
    method: "POST",
    body: JSON.stringify({ title: name, branch }),
  });

  if (result) {
    logger.info({ siteId, hookId: result.id }, "Netlify deploy hook created");
    return {
      id: result.id,
      name: result.title,
      url: result.url,
      branch: result.branch,
      createdAt: result.created_at,
    };
  }

  return null;
}

// ========== Vercel Presets (One-Click Deploy) ==========

export type VercelPresetStack =
  | "react"
  | "vue"
  | "svelte"
  | "nextjs"
  | "vite"
  | "express";

/**
 * Get opinionated CreateProjectInput for common stacks (one-click deploy preset).
 * Use when project is generated and user clicks "Deploy to Vercel".
 */
export function getVercelPresetForStack(
  stack: VercelPresetStack,
  projectName: string,
  gitRepo?: { owner: string; repo: string; branch?: string },
): CreateProjectInput {
  const common = {
    name: projectName,
    gitRepository: gitRepo
      ? {
          provider: "github" as const,
          repo: `${gitRepo.owner}/${gitRepo.repo}`,
          branch: gitRepo.branch ?? "main",
        }
      : undefined,
  };

  switch (stack) {
    case "react":
    case "vite":
      return {
        ...common,
        framework: "create-react-app",
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
      };
    case "vue":
      return {
        ...common,
        framework: "vue",
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
      };
    case "svelte":
      return {
        ...common,
        framework: "sveltekit",
        buildCommand: "npm run build",
        outputDirectory: "build",
        installCommand: "npm install",
      };
    case "nextjs":
      return {
        ...common,
        framework: "nextjs",
        buildCommand: "npm run build",
        installCommand: "npm install",
      };
    case "express":
      return {
        ...common,
        framework: "other",
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
        rootDirectory: ".",
      };
    default:
      return {
        ...common,
        framework: "other",
        buildCommand: "npm run build",
        outputDirectory: "dist",
        installCommand: "npm install",
      };
  }
}

// ========== Unified Functions ==========

/**
 * Get all projects across both Vercel and Netlify
 */
export async function getAllProjects(userId: string): Promise<DeployProject[]> {
  const [vercelProjects, netlifyProjects] = await Promise.all([
    getVercelProjects(userId).catch(() => []),
    getNetlifySites(userId).catch(() => []),
  ]);

  return [...vercelProjects, ...netlifyProjects];
}

/**
 * Get project by ID (auto-detect provider)
 */
export async function getProject(
  userId: string,
  projectId: string,
  provider: DeployProvider,
): Promise<DeployProject | null> {
  if (provider === "vercel") {
    return getVercelProject(userId, projectId);
  } else {
    return getNetlifySite(userId, projectId);
  }
}

/**
 * Trigger deploy for any provider
 */
export async function triggerDeploy(
  userId: string,
  projectId: string,
  provider: DeployProvider,
  options: DeployOptions = {},
): Promise<Deployment | null> {
  if (provider === "vercel") {
    return triggerVercelDeploy(userId, projectId, options);
  } else {
    return triggerNetlifyDeploy(userId, projectId, options);
  }
}

/**
 * Get deployments for any provider
 */
export async function getDeployments(
  userId: string,
  projectId: string,
  provider: DeployProvider,
  limit: number = 20,
): Promise<Deployment[]> {
  if (provider === "vercel") {
    return getVercelDeployments(userId, projectId, limit);
  } else {
    return getNetlifyDeploys(userId, projectId, limit);
  }
}

/**
 * Get latest deployment status
 */
export async function getLatestDeployment(
  userId: string,
  projectId: string,
  provider: DeployProvider,
): Promise<Deployment | null> {
  const deployments = await getDeployments(userId, projectId, provider, 1);
  return deployments[0] ?? null;
}

/**
 * Check if project has pending deployment
 */
export async function hasPendingDeployment(
  userId: string,
  projectId: string,
  provider: DeployProvider,
): Promise<boolean> {
  const latest = await getLatestDeployment(userId, projectId, provider);
  return (
    latest !== null &&
    (latest.state === "queued" || latest.state === "building")
  );
}
