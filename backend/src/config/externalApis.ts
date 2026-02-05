/**
 * External API Configuration
 *
 * Centralized configuration for third-party API endpoints.
 * This provides a single source of truth for external service URLs.
 */

// Google APIs
export const GOOGLE_OAUTH = {
  TOKEN_URL: "https://oauth2.googleapis.com/token",
  AUTH_URL: "https://accounts.google.com/o/oauth2/v2/auth",
  USERINFO_URL: "https://www.googleapis.com/oauth2/v2/userinfo",
} as const;

export const GOOGLE_APIS = {
  GMAIL_BASE: "https://www.googleapis.com/gmail/v1",
  CALENDAR_BASE: "https://www.googleapis.com/calendar/v3",
  DRIVE_BASE: "https://www.googleapis.com/drive/v3",
} as const;

// GitHub APIs
export const GITHUB_APIS = {
  API_BASE: "https://api.github.com",
  OAUTH_TOKEN_URL: "https://github.com/login/oauth/access_token",
  OAUTH_AUTH_URL: "https://github.com/login/oauth/authorize",
} as const;

// Notion APIs
export const NOTION_APIS = {
  API_BASE: "https://api.notion.com/v1",
  OAUTH_TOKEN_URL: "https://api.notion.com/v1/oauth/token",
} as const;

// Slack APIs
export const SLACK_APIS = {
  API_BASE: "https://slack.com/api",
  OAUTH_TOKEN_URL: "https://slack.com/api/oauth.v2.access",
} as const;
