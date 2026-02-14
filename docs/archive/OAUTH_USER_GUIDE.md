# OAuth Integrations User Guide

## What are OAuth Integrations?

OAuth integrations allow you to securely connect your G-Rump account with third-party services like Slack, GitHub, Notion, and more. Once connected, G-Rump can interact with these services on your behalf to automate tasks and streamline your workflow.

## How to Connect an Integration

### Step 1: Open Integrations Hub

1. Click on **Settings** in the G-Rump app
2. Navigate to the **Integrations** tab
3. Browse available integrations

### Step 2: Choose a Service

Click on the service you want to connect. You'll see:
- Service name and logo
- Description of what G-Rump can do with this integration
- Authentication method (OAuth, API Key, or Bot Token)

### Step 3: Authorize the Connection

For OAuth services (Slack, GitHub, Notion, etc.):

1. Click **"Sign in with [Service]"**
2. You'll be redirected to the service's authorization page
3. Review the permissions G-Rump is requesting
4. Click **"Authorize"** or **"Allow"**
5. You'll be redirected back to G-Rump

The integration will now show as **"Connected"** with a green status badge.

## Available OAuth Integrations

### Communication & Collaboration

- **Slack** - Send messages, create channels, and automate team communication
- **Discord** - Manage servers and send messages to Discord channels

### Development Tools

- **GitHub** - Manage repositories, create issues, and automate CI/CD workflows
- **GitLab** - Repository management and merge request automation
- **Bitbucket** - Code repository management
- **Linear** - Issue tracking and project management
- **Jira** - Project management and task tracking

### Productivity

- **Notion** - Access and update your Notion workspace, databases, and pages
- **Google Calendar** - View and manage calendar events
- **Gmail** - Read and send emails programmatically

### Design & Media

- **Figma** - Access design files and components
- **Spotify** - Control music playback and manage playlists

### Social Media

- **Twitter/X** - Post tweets and interact with your timeline

## Managing Connected Integrations

### View Connection Status

In the Integrations Hub, connected services show:
- ✅ **Active** - Integration is working normally
- ⚠️ **Pending** - Authorization in progress
- ❌ **Error** - Connection issue (click to reconnect)
- ⏸️ **Disabled** - Integration is paused

### Disable an Integration

1. Find the connected integration in the Integrations Hub
2. Click the **"Disable"** button
3. The integration will stop working but credentials remain saved

### Re-enable an Integration

1. Find the disabled integration
2. Click the **"Enable"** button
3. The integration will resume working immediately

### Remove an Integration

1. Find the connected integration
2. Click the **trash icon** 🗑️
3. Confirm removal
4. All stored credentials will be permanently deleted

## Security & Privacy

### What Permissions Does G-Rump Request?

Each integration requests only the minimum permissions needed to function. For example:

- **Slack**: Send messages, read channel information
- **GitHub**: Read and write to repositories, manage issues
- **Notion**: Read and update pages and databases

You can review the exact permissions on the authorization screen.

### How Are My Credentials Stored?

- All OAuth tokens are encrypted using industry-standard AES-256 encryption
- Tokens are stored securely in G-Rump's database
- Only your G-Rump account can access your connected integrations
- Tokens are never shared with third parties

### Can I Revoke Access?

Yes! You can revoke G-Rump's access at any time:

1. **In G-Rump**: Click the trash icon to remove the integration
2. **In the service**: Visit the service's settings to revoke G-Rump's access
   - Slack: Settings → Apps → Manage Apps
   - GitHub: Settings → Applications → Authorized OAuth Apps
   - Notion: Settings → My connections
   - Google: myaccount.google.com → Security → Third-party apps

## Troubleshooting

### "OAuth provider not configured"

This means the G-Rump administrator hasn't set up this integration yet. Contact your G-Rump admin or support.

### "Authorization failed" or "State mismatch"

1. Clear your browser cookies
2. Try connecting again
3. Ensure you're using the latest version of G-Rump

### Integration Shows "Error" Status

1. Click the integration to view error details
2. Try clicking **"Reconnect"** to re-authorize
3. If the problem persists, remove and re-add the integration

### "Permission denied" Errors

The integration might need additional permissions:
1. Remove the integration
2. Re-connect and ensure you grant all requested permissions
3. Check the service's settings to verify G-Rump has the necessary access

## Use Cases

### Automate Slack Notifications

Connect Slack to receive notifications about:
- Code deployments
- Build status updates
- Task completions

### Sync with GitHub

Connect GitHub to:
- Automatically create issues from G-Rump tasks
- Trigger builds when you ship code
- Monitor repository activity

### Manage Notion Workspace

Connect Notion to:
- Sync project documentation
- Update task databases
- Create meeting notes automatically

### Control Spotify Playback

Connect Spotify to:
- Play focus music when starting work sessions
- Create playlists based on your mood
- Control playback with voice commands

## Best Practices

1. **Review Permissions** - Always review what permissions you're granting
2. **Limit Connections** - Only connect services you actively use
3. **Regular Audits** - Periodically review and remove unused integrations
4. **Secure Your Account** - Use strong passwords and enable 2FA on G-Rump
5. **Monitor Activity** - Check the audit log for integration activity

## Getting Help

If you need assistance:
- Check the [Troubleshooting](#troubleshooting) section above
- Visit the G-Rump documentation at https://docs.g-rump.com
- Contact support at support@g-rump.com
- Join our Discord community for help from other users

---

**Need to set up OAuth integrations as an admin?** See [OAuth Integrations Setup Guide](./OAUTH_INTEGRATIONS_SETUP.md)
