# OAuth Integrations Setup Guide

This guide explains how to set up OAuth integrations in G-Rump, allowing users to connect their third-party service accounts seamlessly.

## Overview

G-Rump now supports OAuth 2.0 authentication for multiple third-party services. Users can click "Sign in with [Service]" buttons in the Integrations Hub to connect their accounts securely.

## Supported Providers

- **Slack** - Team communication and automation
- **GitHub** - Repository management and CI/CD
- **Notion** - Knowledge base and documentation
- **Linear** - Issue tracking and project management
- **Figma** - Design collaboration
- **Spotify** - Music playback control
- **Gmail** - Email management
- **Google Calendar** - Calendar and event management
- **Twitter/X** - Social media posting
- **GitLab** - Repository management
- **Bitbucket** - Repository management
- **Jira** - Project management

## Architecture

### Backend Components

1. **OAuth Routes** (`backend/src/routes/integrationsOAuth.ts`)
   - Handles OAuth authorization flow initiation
   - Processes OAuth callbacks
   - Exchanges authorization codes for access tokens
   - Stores tokens securely in the database

2. **Database Schema**
   - `oauth_tokens` table stores encrypted access and refresh tokens
   - `integrations` table tracks connected services

3. **Security**
   - CSRF protection via state parameter
   - Tokens encrypted at rest using AES-256
   - Secure cookie handling for OAuth state

### Frontend Components

1. **IntegrationsHub** (`frontend/src/components/IntegrationsHub.svelte`)
   - Displays available integrations
   - Shows connection status
   - Provides "Sign in" buttons for OAuth providers

2. **API Client** (`frontend/src/lib/integrationsApi.ts`)
   - Handles API requests to backend
   - Manages OAuth flow initiation

## Setup Instructions

### 1. Configure Environment Variables

Copy the OAuth configuration template:

```bash
cat backend/.env.oauth-integrations >> backend/.env
```

Edit `backend/.env` and set your public base URL:

```env
PUBLIC_BASE_URL=https://your-domain.com  # or http://localhost:3000 for development
```

### 2. Create OAuth Applications

For each provider you want to support, follow these steps:

#### Slack

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Set redirect URL: `{PUBLIC_BASE_URL}/api/integrations-v2/oauth/slack/callback`
4. Add OAuth scopes: `chat:write`, `channels:read`, `users:read`
5. Copy Client ID and Client Secret to `.env`:
   ```env
   SLACK_CLIENT_ID=your_client_id
   SLACK_CLIENT_SECRET=your_client_secret
   ```

#### GitHub

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set callback URL: `{PUBLIC_BASE_URL}/api/integrations-v2/oauth/github/callback`
4. Copy Client ID and Client Secret to `.env`:
   ```env
   GITHUB_OAUTH_CLIENT_ID=your_client_id
   GITHUB_OAUTH_CLIENT_SECRET=your_client_secret
   ```

#### Notion

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Set redirect URI: `{PUBLIC_BASE_URL}/api/integrations-v2/oauth/notion/callback`
4. Enable capabilities: Read content, Update content, Insert content
5. Copy Client ID and Client Secret to `.env`:
   ```env
   NOTION_CLIENT_ID=your_client_id
   NOTION_CLIENT_SECRET=your_client_secret
   ```

#### Google (Gmail & Calendar)

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Gmail API and Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Add authorized redirect URIs:
   - `{PUBLIC_BASE_URL}/api/integrations-v2/oauth/gmail/callback`
   - `{PUBLIC_BASE_URL}/api/integrations-v2/oauth/google_calendar/callback`
6. Copy Client ID and Client Secret to `.env`:
   ```env
   GOOGLE_OAUTH_CLIENT_ID=your_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
   ```

#### Other Providers

Follow similar steps for other providers. See `backend/.env.oauth-integrations` for detailed instructions and callback URLs for each provider.

### 3. Test OAuth Flow

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to Settings → Integrations
4. Click "Sign in with [Provider]"
5. Complete the OAuth authorization
6. Verify the integration appears as "Connected"

## OAuth Flow Diagram

```
┌─────────┐                ┌─────────┐                ┌──────────┐
│ User    │                │ G-Rump  │                │ Provider │
│ Browser │                │ Backend │                │ (OAuth)  │
└────┬────┘                └────┬────┘                └────┬─────┘
     │                          │                          │
     │  1. Click "Sign in"      │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │  2. Generate state       │                          │
     │     Set state cookie     │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
     │  3. Redirect to provider │                          │
     ├──────────────────────────┼─────────────────────────>│
     │                          │                          │
     │  4. User authorizes      │                          │
     │<─────────────────────────┼──────────────────────────┤
     │                          │                          │
     │  5. Callback with code   │                          │
     ├─────────────────────────>│                          │
     │                          │                          │
     │                          │  6. Exchange code        │
     │                          │     for access token     │
     │                          ├─────────────────────────>│
     │                          │                          │
     │                          │  7. Return tokens        │
     │                          │<─────────────────────────┤
     │                          │                          │
     │                          │  8. Encrypt & store      │
     │                          │     tokens in DB         │
     │                          │                          │
     │  9. Redirect to app      │                          │
     │<─────────────────────────┤                          │
     │                          │                          │
```

## Security Considerations

### Token Storage

- Access tokens are encrypted using AES-256 before storage
- Refresh tokens are also encrypted
- Encryption keys should be stored securely (environment variables)

### State Parameter

- Prevents CSRF attacks
- Includes user ID, provider, and timestamp
- Validated on callback
- Expires after 10 minutes

### HTTPS Requirement

- OAuth flows MUST use HTTPS in production
- Set `PUBLIC_BASE_URL` to your HTTPS domain
- Configure SSL/TLS certificates properly

### Scope Minimization

- Only request necessary OAuth scopes
- Review and update scopes in `integrationsOAuth.ts`
- Document required permissions for users

## API Endpoints

### Initiate OAuth Flow

```
GET /api/integrations-v2/oauth/:provider/authorize
Authorization: Bearer <user_token>
```

Returns:
```json
{
  "url": "https://provider.com/oauth/authorize?client_id=..."
}
```

### OAuth Callback

```
GET /api/integrations-v2/oauth/:provider/callback?code=...&state=...
```

Redirects to frontend with success or error parameter.

### Refresh Token

```
POST /api/integrations-v2/oauth/:provider/refresh
Authorization: Bearer <user_token>
```

Returns:
```json
{
  "success": true,
  "message": "Token refreshed"
}
```

## Troubleshooting

### "OAuth provider not configured" Error

- Ensure CLIENT_ID and CLIENT_SECRET are set in `.env`
- Restart the backend server after updating `.env`
- Check that the provider name matches exactly

### "State mismatch" Error

- Clear browser cookies
- Ensure cookies are enabled
- Check that `PUBLIC_BASE_URL` matches your actual domain

### "Token exchange failed" Error

- Verify callback URL matches in provider settings
- Check CLIENT_SECRET is correct
- Review backend logs for detailed error messages

### Integration Shows as "Pending" or "Error"

- Check database for `oauth_tokens` entry
- Verify token encryption is working
- Review audit logs for integration creation

## Adding New Providers

To add a new OAuth provider:

1. Add provider configuration to `OAUTH_PROVIDERS` in `integrationsOAuth.ts`:
   ```typescript
   new_provider: {
     authUrl: 'https://provider.com/oauth/authorize',
     tokenUrl: 'https://provider.com/oauth/token',
     clientId: process.env.NEW_PROVIDER_CLIENT_ID || '',
     clientSecret: process.env.NEW_PROVIDER_CLIENT_SECRET || '',
     scopes: ['scope1', 'scope2'],
     callbackPath: '/api/integrations-v2/oauth/new_provider/callback',
   }
   ```

2. Add provider to `IntegrationProviderId` type in `types/integrations.ts`

3. Add provider metadata to `PROVIDER_METADATA` in `frontend/src/lib/integrationsApi.ts`

4. Update `.env.oauth-integrations` with setup instructions

5. Test the OAuth flow end-to-end

## Production Deployment

### Checklist

- [ ] Set `PUBLIC_BASE_URL` to production domain
- [ ] Configure all OAuth apps with production callback URLs
- [ ] Enable HTTPS/SSL certificates
- [ ] Set secure encryption keys
- [ ] Test each OAuth provider
- [ ] Enable rate limiting on OAuth endpoints
- [ ] Monitor OAuth success/failure rates
- [ ] Set up alerts for token expiration

### Environment Variables

Ensure these are set in production:

```env
PUBLIC_BASE_URL=https://api.yourdomain.com
NODE_ENV=production
# ... OAuth credentials for each provider
```

## Support

For issues or questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review backend logs for detailed error messages
- Open an issue on GitHub
- Contact support@g-rump.com

---

**Last Updated:** February 2026
**Version:** 1.0.0
