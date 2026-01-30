/**
 * Jira/Atlassian Integration Service
 * Full CRUD for issues, projects, sprints, and more via Jira REST API
 */

import logger from '../middleware/logger.js';
import { getAccessToken, isTokenExpired, refreshOAuthTokens } from './integrationService.js';

// ========== Types ==========

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  simplified: boolean;
  avatarUrls: Record<string, string>;
  self: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  subtask: boolean;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl: string;
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls: Record<string, string>;
  active: boolean;
}

export interface JiraStatus {
  id: string;
  name: string;
  statusCategory: {
    key: string;
    colorName: string;
    name: string;
  };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  goal?: string;
  boardId: number;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string | { content: unknown[] } | null;
    issuetype: JiraIssueType;
    project: JiraProject;
    status: JiraStatus;
    priority?: JiraPriority;
    assignee?: JiraUser | null;
    reporter?: JiraUser;
    created: string;
    updated: string;
    duedate?: string | null;
    labels?: string[];
    components?: Array<{ id: string; name: string }>;
    fixVersions?: Array<{ id: string; name: string }>;
    customfield_10016?: number; // Story points (may vary by instance)
    parent?: { key: string; fields: { summary: string } };
    subtasks?: JiraIssue[];
    comment?: { comments: JiraComment[] };
    [key: string]: unknown;
  };
}

export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string | { content: unknown[] };
  created: string;
  updated: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  location?: {
    projectId: number;
    projectKey: string;
    projectName: string;
  };
}

export interface JiraTransition {
  id: string;
  name: string;
  to: JiraStatus;
}

export interface CreateIssueInput {
  projectKey: string;
  summary: string;
  issueType: string;
  description?: string;
  priority?: string;
  assigneeAccountId?: string;
  labels?: string[];
  parentKey?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateIssueInput {
  summary?: string;
  description?: string;
  priority?: string;
  assigneeAccountId?: string | null;
  labels?: string[];
  dueDate?: string | null;
  customFields?: Record<string, unknown>;
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

// ========== Helper Functions ==========

/**
 * Get a valid access token, refreshing if needed
 */
async function getValidToken(userId: string): Promise<string | null> {
  if (await isTokenExpired(userId, 'jira')) {
    const refreshed = await refreshOAuthTokens(userId, 'jira');
    if (!refreshed) {
      logger.warn({ userId }, 'Failed to refresh Jira token');
      return null;
    }
  }
  return getAccessToken(userId, 'jira');
}

/**
 * Get Atlassian cloud resource (site) ID for API calls
 */
async function getCloudId(userId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      logger.error({ status: res.status }, 'Failed to get Atlassian cloud resources');
      return null;
    }
    const resources = (await res.json()) as Array<{ id: string; name: string; url: string }>;
    if (resources.length === 0) {
      logger.warn({ userId }, 'No Atlassian cloud resources available');
      return null;
    }
    // Return first available resource (could be enhanced to support multiple)
    return resources[0].id;
  } catch (err) {
    logger.error({ error: (err as Error).message }, 'Error fetching Atlassian resources');
    return null;
  }
}

/**
 * Make authenticated Jira API request
 */
async function jiraFetch<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  const token = await getValidToken(userId);
  if (!token) {
    logger.error({ userId }, 'No valid Jira token');
    return null;
  }

  const cloudId = await getCloudId(userId, token);
  if (!cloudId) {
    return null;
  }

  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3`;
  const url = `${baseUrl}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ status: res.status, error: errorText, endpoint }, 'Jira API error');
      return null;
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    logger.error({ error: (err as Error).message, endpoint }, 'Jira fetch error');
    return null;
  }
}

/**
 * Make Jira Agile API request (for boards, sprints)
 */
async function jiraAgileFetch<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  const token = await getValidToken(userId);
  if (!token) {
    logger.error({ userId }, 'No valid Jira token');
    return null;
  }

  const cloudId = await getCloudId(userId, token);
  if (!cloudId) {
    return null;
  }

  const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}/rest/agile/1.0`;
  const url = `${baseUrl}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error({ status: res.status, error: errorText, endpoint }, 'Jira Agile API error');
      return null;
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (err) {
    logger.error({ error: (err as Error).message, endpoint }, 'Jira Agile fetch error');
    return null;
  }
}

// ========== Projects ==========

/**
 * Get all projects the user has access to
 */
export async function getProjects(userId: string): Promise<JiraProject[]> {
  const result = await jiraFetch<{ values: JiraProject[] }>(userId, '/project/search?expand=description');
  return result?.values ?? [];
}

/**
 * Get a specific project by key
 */
export async function getProject(userId: string, projectKey: string): Promise<JiraProject | null> {
  return jiraFetch<JiraProject>(userId, `/project/${projectKey}`);
}

// ========== Issues ==========

/**
 * Search issues using JQL
 */
export async function searchIssues(
  userId: string,
  jql: string,
  options: { startAt?: number; maxResults?: number; fields?: string[] } = {}
): Promise<JiraSearchResult | null> {
  const params = new URLSearchParams({
    jql,
    startAt: String(options.startAt ?? 0),
    maxResults: String(options.maxResults ?? 50),
  });
  if (options.fields) {
    params.set('fields', options.fields.join(','));
  }
  return jiraFetch<JiraSearchResult>(userId, `/search?${params.toString()}`);
}

/**
 * Get a specific issue by key
 */
export async function getIssue(userId: string, issueKey: string): Promise<JiraIssue | null> {
  return jiraFetch<JiraIssue>(userId, `/issue/${issueKey}?expand=renderedFields,names,changelog`);
}

/**
 * Create a new issue
 */
export async function createIssue(userId: string, input: CreateIssueInput): Promise<JiraIssue | null> {
  const fields: Record<string, unknown> = {
    project: { key: input.projectKey },
    summary: input.summary,
    issuetype: { name: input.issueType },
  };

  if (input.description) {
    // Atlassian Document Format (ADF) for API v3
    fields.description = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: input.description }],
        },
      ],
    };
  }

  if (input.priority) {
    fields.priority = { name: input.priority };
  }

  if (input.assigneeAccountId) {
    fields.assignee = { accountId: input.assigneeAccountId };
  }

  if (input.labels) {
    fields.labels = input.labels;
  }

  if (input.parentKey) {
    fields.parent = { key: input.parentKey };
  }

  // Merge custom fields
  if (input.customFields) {
    Object.assign(fields, input.customFields);
  }

  const result = await jiraFetch<{ id: string; key: string; self: string }>(userId, '/issue', {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });

  if (result) {
    logger.info({ issueKey: result.key }, 'Jira issue created');
    // Fetch full issue details
    return getIssue(userId, result.key);
  }

  return null;
}

/**
 * Update an existing issue
 */
export async function updateIssue(
  userId: string,
  issueKey: string,
  input: UpdateIssueInput
): Promise<boolean> {
  const fields: Record<string, unknown> = {};

  if (input.summary !== undefined) {
    fields.summary = input.summary;
  }

  if (input.description !== undefined) {
    fields.description = input.description
      ? {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: input.description }],
            },
          ],
        }
      : null;
  }

  if (input.priority !== undefined) {
    fields.priority = { name: input.priority };
  }

  if (input.assigneeAccountId !== undefined) {
    fields.assignee = input.assigneeAccountId ? { accountId: input.assigneeAccountId } : null;
  }

  if (input.labels !== undefined) {
    fields.labels = input.labels;
  }

  if (input.dueDate !== undefined) {
    fields.duedate = input.dueDate;
  }

  // Merge custom fields
  if (input.customFields) {
    Object.assign(fields, input.customFields);
  }

  const result = await jiraFetch<object>(userId, `/issue/${issueKey}`, {
    method: 'PUT',
    body: JSON.stringify({ fields }),
  });

  if (result !== null) {
    logger.info({ issueKey }, 'Jira issue updated');
    return true;
  }

  return false;
}

/**
 * Delete an issue
 */
export async function deleteIssue(userId: string, issueKey: string): Promise<boolean> {
  const result = await jiraFetch<object>(userId, `/issue/${issueKey}`, {
    method: 'DELETE',
  });

  if (result !== null) {
    logger.info({ issueKey }, 'Jira issue deleted');
    return true;
  }

  return false;
}

/**
 * Get available transitions for an issue
 */
export async function getTransitions(userId: string, issueKey: string): Promise<JiraTransition[]> {
  const result = await jiraFetch<{ transitions: JiraTransition[] }>(
    userId,
    `/issue/${issueKey}/transitions`
  );
  return result?.transitions ?? [];
}

/**
 * Transition an issue to a new status
 */
export async function transitionIssue(
  userId: string,
  issueKey: string,
  transitionId: string
): Promise<boolean> {
  const result = await jiraFetch<object>(userId, `/issue/${issueKey}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: transitionId } }),
  });

  if (result !== null) {
    logger.info({ issueKey, transitionId }, 'Jira issue transitioned');
    return true;
  }

  return false;
}

/**
 * Add a comment to an issue
 */
export async function addComment(
  userId: string,
  issueKey: string,
  body: string
): Promise<JiraComment | null> {
  return jiraFetch<JiraComment>(userId, `/issue/${issueKey}/comment`, {
    method: 'POST',
    body: JSON.stringify({
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: body }],
          },
        ],
      },
    }),
  });
}

/**
 * Assign an issue to a user
 */
export async function assignIssue(
  userId: string,
  issueKey: string,
  assigneeAccountId: string | null
): Promise<boolean> {
  const result = await jiraFetch<object>(userId, `/issue/${issueKey}/assignee`, {
    method: 'PUT',
    body: JSON.stringify({ accountId: assigneeAccountId }),
  });

  if (result !== null) {
    logger.info({ issueKey, assigneeAccountId }, 'Jira issue assigned');
    return true;
  }

  return false;
}

// ========== Issue Types ==========

/**
 * Get issue types for a project
 */
export async function getIssueTypes(userId: string, projectKey: string): Promise<JiraIssueType[]> {
  const project = await jiraFetch<{ issueTypes: JiraIssueType[] }>(
    userId,
    `/project/${projectKey}?expand=issueTypes`
  );
  return project?.issueTypes ?? [];
}

// ========== Users ==========

/**
 * Search for users assignable to a project
 */
export async function searchUsers(
  userId: string,
  projectKey: string,
  query: string
): Promise<JiraUser[]> {
  const params = new URLSearchParams({
    project: projectKey,
    query,
    maxResults: '20',
  });
  const result = await jiraFetch<JiraUser[]>(userId, `/user/assignable/search?${params.toString()}`);
  return result ?? [];
}

/**
 * Get current user
 */
export async function getCurrentUser(userId: string): Promise<JiraUser | null> {
  return jiraFetch<JiraUser>(userId, '/myself');
}

// ========== Boards (Agile) ==========

/**
 * Get all boards
 */
export async function getBoards(userId: string): Promise<JiraBoard[]> {
  const result = await jiraAgileFetch<{ values: JiraBoard[] }>(userId, '/board');
  return result?.values ?? [];
}

/**
 * Get a specific board
 */
export async function getBoard(userId: string, boardId: number): Promise<JiraBoard | null> {
  return jiraAgileFetch<JiraBoard>(userId, `/board/${boardId}`);
}

// ========== Sprints (Agile) ==========

/**
 * Get sprints for a board
 */
export async function getSprints(
  userId: string,
  boardId: number,
  state?: 'active' | 'closed' | 'future'
): Promise<JiraSprint[]> {
  const params = new URLSearchParams();
  if (state) {
    params.set('state', state);
  }
  const result = await jiraAgileFetch<{ values: JiraSprint[] }>(
    userId,
    `/board/${boardId}/sprint?${params.toString()}`
  );
  return result?.values ?? [];
}

/**
 * Get active sprint for a board
 */
export async function getActiveSprint(userId: string, boardId: number): Promise<JiraSprint | null> {
  const sprints = await getSprints(userId, boardId, 'active');
  return sprints[0] ?? null;
}

/**
 * Get issues in a sprint
 */
export async function getSprintIssues(
  userId: string,
  sprintId: number,
  options: { startAt?: number; maxResults?: number } = {}
): Promise<JiraSearchResult | null> {
  const params = new URLSearchParams({
    startAt: String(options.startAt ?? 0),
    maxResults: String(options.maxResults ?? 50),
  });
  return jiraAgileFetch<JiraSearchResult>(
    userId,
    `/sprint/${sprintId}/issue?${params.toString()}`
  );
}

/**
 * Move issues to a sprint
 */
export async function moveIssuesToSprint(
  userId: string,
  sprintId: number,
  issueKeys: string[]
): Promise<boolean> {
  const result = await jiraAgileFetch<object>(userId, `/sprint/${sprintId}/issue`, {
    method: 'POST',
    body: JSON.stringify({ issues: issueKeys }),
  });

  if (result !== null) {
    logger.info({ sprintId, issueCount: issueKeys.length }, 'Issues moved to sprint');
    return true;
  }

  return false;
}

// ========== Backlog ==========

/**
 * Get backlog issues for a board
 */
export async function getBacklogIssues(
  userId: string,
  boardId: number,
  options: { startAt?: number; maxResults?: number } = {}
): Promise<JiraSearchResult | null> {
  const params = new URLSearchParams({
    startAt: String(options.startAt ?? 0),
    maxResults: String(options.maxResults ?? 50),
  });
  return jiraAgileFetch<JiraSearchResult>(
    userId,
    `/board/${boardId}/backlog?${params.toString()}`
  );
}

/**
 * Move issues to backlog
 */
export async function moveIssuesToBacklog(userId: string, issueKeys: string[]): Promise<boolean> {
  const result = await jiraAgileFetch<object>(userId, '/backlog/issue', {
    method: 'POST',
    body: JSON.stringify({ issues: issueKeys }),
  });

  if (result !== null) {
    logger.info({ issueCount: issueKeys.length }, 'Issues moved to backlog');
    return true;
  }

  return false;
}

// ========== Priorities ==========

/**
 * Get all priorities
 */
export async function getPriorities(userId: string): Promise<JiraPriority[]> {
  const result = await jiraFetch<JiraPriority[]>(userId, '/priority');
  return result ?? [];
}

// ========== Quick Actions ==========

/**
 * Bulk create issues (e.g., from a PRD)
 */
export async function bulkCreateIssues(
  userId: string,
  inputs: CreateIssueInput[]
): Promise<Array<JiraIssue | null>> {
  const results: Array<JiraIssue | null> = [];
  for (const input of inputs) {
    const issue = await createIssue(userId, input);
    results.push(issue);
  }
  return results;
}

/**
 * Get my open issues across all projects
 */
export async function getMyOpenIssues(userId: string): Promise<JiraIssue[]> {
  const result = await searchIssues(userId, 'assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC');
  return result?.issues ?? [];
}

/**
 * Get issues updated in the last N days
 */
export async function getRecentlyUpdatedIssues(userId: string, days: number = 7): Promise<JiraIssue[]> {
  const result = await searchIssues(userId, `updated >= -${days}d ORDER BY updated DESC`);
  return result?.issues ?? [];
}

/**
 * Create a bug issue
 */
export async function createBug(
  userId: string,
  projectKey: string,
  summary: string,
  description?: string,
  priority?: string
): Promise<JiraIssue | null> {
  return createIssue(userId, {
    projectKey,
    summary,
    issueType: 'Bug',
    description,
    priority: priority ?? 'Medium',
  });
}

/**
 * Create a story
 */
export async function createStory(
  userId: string,
  projectKey: string,
  summary: string,
  description?: string,
  storyPoints?: number
): Promise<JiraIssue | null> {
  return createIssue(userId, {
    projectKey,
    summary,
    issueType: 'Story',
    description,
    customFields: storyPoints ? { customfield_10016: storyPoints } : undefined,
  });
}

/**
 * Create a task
 */
export async function createTask(
  userId: string,
  projectKey: string,
  summary: string,
  description?: string,
  assigneeAccountId?: string
): Promise<JiraIssue | null> {
  return createIssue(userId, {
    projectKey,
    summary,
    issueType: 'Task',
    description,
    assigneeAccountId,
  });
}

/**
 * Create a subtask under a parent issue
 */
export async function createSubtask(
  userId: string,
  parentKey: string,
  summary: string,
  description?: string
): Promise<JiraIssue | null> {
  const parentIssue = await getIssue(userId, parentKey);
  if (!parentIssue) {
    logger.error({ parentKey }, 'Parent issue not found');
    return null;
  }

  return createIssue(userId, {
    projectKey: parentIssue.fields.project.key,
    summary,
    issueType: 'Sub-task',
    description,
    parentKey,
  });
}
