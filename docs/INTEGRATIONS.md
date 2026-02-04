# G-Rump Integrations

G-Rump supports integrations with messaging platforms, version control, and productivity tools.

## Messaging (Telegram, Discord, Twilio)

See [MESSAGING_SETUP.md](MESSAGING_SETUP.md) for Telegram, Discord, and Twilio (SMS/WhatsApp) configuration.

## Slack (Planned)

Slack integration allows users to chat with G-Rump from Slack. To enable:

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Configure OAuth scopes: `chat:write`, `channels:history`, `im:history`, `commands`
3. Set environment variables:
   - `SLACK_CLIENT_ID`
   - `SLACK_CLIENT_SECRET`
   - `SLACK_SIGNING_SECRET`
   - `SLACK_BOT_TOKEN`
4. Set the Events API request URL to `https://your-domain/api/messaging/slack`

## GitHub (Planned)

Beyond OAuth for pushing code, GitHub integration will support:

- Repo events (PR created, issue commented)
- Webhooks to trigger SHIP or chat from PR descriptions
- Configure: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`

## Notion (Planned)

Notion integration will support:

- OAuth for read/write access
- Sync PRD/specs to Notion pages
- Pull context from Notion for AI
- Configure: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`

## MCP (Model Context Protocol)

G-Rump consumes tools from external MCP servers. See [MCP_SETUP.md](MCP_SETUP.md).
