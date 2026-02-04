# Integrations Setup Guide

This guide explains how to set up each integration in G-Rump: where to get credentials, which environment variables to set, and how to connect them in the app. For a full list of env vars, see [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

---

## Enabling OAuth ("Sign in with X")

Integrations that support OAuth show a **"Sign in with {Provider}"** button in the Integrations Hub (on the card and in the connect modal). To enable these buttons:

1. **Create an OAuth app** in each provider’s developer console (see each integration below for links).
2. **Set environment variables** in `backend/.env`:
   - `{PROVIDER}_CLIENT_ID` – required for every OAuth integration.
   - `{PROVIDER}_CLIENT_SECRET` – required for most (backend uses it to exchange the code for tokens).
   - Use the provider id in UPPERCASE with underscores, e.g. `DISCORD_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`.
3. **Configure the redirect (callback) URL** in the provider’s OAuth app to:
   - `{PUBLIC_BASE_URL}/api/integrations-v2/{provider}/oauth/callback`
   - Example: `http://localhost:3000/api/integrations-v2/github/oauth/callback`
   - Also set `PUBLIC_BASE_URL` (and optionally `FRONTEND_URL`) in `.env` so the backend can build the correct callback URL.

**OAuth-capable integrations and their env vars:**

| Provider | Env vars | Callback path |
|----------|----------|----------------|
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | `.../integrations-v2/discord/oauth/callback` |
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | `.../integrations-v2/slack/oauth/callback` |
| Gmail | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` | `.../integrations-v2/gmail/oauth/callback` |
| Google Calendar | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | `.../integrations-v2/google_calendar/oauth/callback` |
| Notion | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` | `.../integrations-v2/notion/oauth/callback` |
| Twitter | `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | `.../integrations-v2/twitter/oauth/callback` |
| Jira | `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` | `.../integrations-v2/jira/oauth/callback` |
| Atlassian | `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET` | `.../integrations-v2/atlassian/oauth/callback` |
| Vercel | `VERCEL_CLIENT_ID`, `VERCEL_CLIENT_SECRET` | `.../integrations-v2/vercel/oauth/callback` |
| Netlify | `NETLIFY_CLIENT_ID`, `NETLIFY_CLIENT_SECRET` | `.../integrations-v2/netlify/oauth/callback` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | `.../integrations-v2/github/oauth/callback` |
| GitLab | `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET` | `.../integrations-v2/gitlab/oauth/callback` |
| Bitbucket | `BITBUCKET_CLIENT_ID`, `BITBUCKET_CLIENT_SECRET` | `.../integrations-v2/bitbucket/oauth/callback` |
| Linear | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | `.../integrations-v2/linear/oauth/callback` |
| GCP | `GCP_CLIENT_ID`, `GCP_CLIENT_SECRET` | `.../integrations-v2/gcp/oauth/callback` |
| Azure | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | `.../integrations-v2/azure/oauth/callback` |

Figma uses its own OAuth flow and callback; see [Figma](#figma) and [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

---

## Development Tools

### GitHub

**What it's for:** Manage repositories, issues, and pull requests; OAuth login.

**Where to get credentials:** [github.com/settings/tokens](https://github.com/settings/tokens) (personal/app token) or GitHub App settings for App ID and private key.

**Backend:** Set in `backend/.env`:

- `GITHUB_TOKEN` – Personal or app token
- `GITHUB_WEBHOOK_SECRET` – For PR/issue webhooks (optional)
- `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY` – For GitHub App (optional)

**In the app:** Integrations Hub → Development Tools → GitHub → Connect. Use Settings or OAuth flow as prompted.

---

### GitLab

**What it's for:** Manage repositories, CI/CD, and issues.

**Where to get credentials:** [gitlab.com](https://gitlab.com) → User Settings → Access Tokens or OAuth Application.

**Backend:** Configure OAuth or API token in backend env (see API_AND_EXTERNAL_SETUP.md if listed).

**In the app:** Integrations Hub → Development Tools → GitLab → Connect.

---

### Bitbucket

**What it's for:** Manage repositories and pull requests.

**Where to get credentials:** [Bitbucket](https://bitbucket.org) → Personal settings → App passwords or OAuth.

**Backend:** Set OAuth client ID/secret or app password in backend env as needed.

**In the app:** Integrations Hub → Development Tools → Bitbucket → Connect.

---

### Jira

**What it's for:** Manage issues, sprints, and projects.

**Where to get credentials:** [Atlassian Developer](https://developer.atlassian.com) – create an OAuth 2.0 app or API token.

**Backend:** Jira base URL, email, and API token or OAuth credentials in backend env.

**In the app:** Integrations Hub → Development Tools → Jira → Connect.

---

### Linear

**What it's for:** Manage issues and projects in Linear.

**Where to get credentials:** [Linear](https://linear.app) → Settings → API → Personal API key or OAuth.

**Backend:** API key or OAuth client ID/secret in backend env.

**In the app:** Integrations Hub → Development Tools → Linear → Connect.

---

### Atlassian

**What it's for:** Atlassian products (Jira, Confluence, etc.).

**Where to get credentials:** [Atlassian Developer](https://developer.atlassian.com).

**Backend:** OAuth or API credentials as required by the backend.

**In the app:** Integrations Hub → Development Tools → Atlassian → Connect.

---

## Communication

### Slack

**What it's for:** Send messages, manage channels, and automate Slack workflows.

**Where to get credentials:** [api.slack.com](https://api.slack.com) – create an app, get OAuth client ID/secret, bot token, and signing secret.

**Backend:** See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md) – `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`.

**In the app:** Integrations Hub → Communication → Slack → Connect. Complete OAuth in browser if prompted.

**Troubleshooting:** Ensure redirect URI matches your `PUBLIC_BASE_URL` + callback path. Check signing secret for Events API.

---

### Discord

**What it's for:** Send messages, manage servers, and interact with Discord communities; OAuth login.

**Where to get credentials:** [Discord Developer Portal](https://discord.com/developers/applications) – create an application, get client ID and secret; create a bot and enable Message Content intent for bot token.

**Backend:** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Communication → Discord → Connect. Use OAuth or bot token as configured.

**Troubleshooting:** Set redirect URI in Discord app to match `PUBLIC_BASE_URL` (e.g. `http://localhost:3000/api/auth/discord/callback`).

---

### Telegram

**What it's for:** Bot messaging and notifications.

**Where to get credentials:** [@BotFather](https://t.me/BotFather) – create a bot and get the token.

**Backend:** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. Set webhook URL as documented in [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Voice & Messaging (or Communication) → Telegram → Connect with bot token.

---

## Deploy & Cloud

### Vercel

**What it's for:** Deploy frontends and serverless functions.

**Where to get credentials:** [vercel.com](https://vercel.com) → Account Settings → Tokens.

**Backend:** Vercel API token in backend env if the app deploys via API.

**In the app:** Integrations Hub → Deploy & Cloud → Vercel → Connect with token.

---

### Netlify

**What it's for:** Deploy and host sites.

**Where to get credentials:** [Netlify](https://www.netlify.com) → User settings → Applications → Personal access tokens.

**Backend:** Netlify API token or OAuth in backend env if used.

**In the app:** Integrations Hub → Deploy & Cloud → Netlify → Connect.

---

### AWS / GCP / Azure

**What it's for:** Cloud deployment, Bedrock (AWS), or other cloud services.

**Where to get credentials:** Respective cloud consoles – IAM access keys (AWS), service account keys (GCP), or app registration (Azure).

**Backend:** e.g. `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` for AWS; see [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md) for AI/Bedrock.

**In the app:** Integrations Hub → Deploy & Cloud → AWS / GCP / Azure → Connect with credentials as required.

---

## Backend as a Service

### Supabase

**What it's for:** Database, auth (Google/GitHub/Discord OAuth), and realtime.

**Where to get credentials:** [supabase.com](https://supabase.com) dashboard – project URL, anon key, service role key.

**Backend:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `PUBLIC_BASE_URL`, `FRONTEND_URL`. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md). Enable providers in Supabase Dashboard → Authentication → Providers.

**In the app:** Used for auth and data; configure in Settings or onboarding. Redirect URIs must match your backend callback URLs.

---

### Firebase

**What it's for:** Database, auth, and cloud functions.

**Where to get credentials:** [Firebase Console](https://console.firebase.google.com) – project settings, service account key, and client config.

**Backend:** Firebase admin SDK credentials or API keys in backend env.

**In the app:** Integrations Hub → Backend as a Service → Firebase → Connect.

---

## Productivity & Design

### Figma

**What it's for:** Design-to-Code and architecture; import designs from Figma.

**Where to get credentials:** [figma.com/developers/apps](https://www.figma.com/developers/apps) – create an OAuth app, get client ID and secret.

**Backend:** See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md) – `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, `FIGMA_REDIRECT_URI` (e.g. `http://localhost:3000/api/figma/callback`).

**In the app:** Integrations Hub → Productivity & Design → Figma → Connect. Use Design-to-Code screen to choose a Figma file after connecting.

**Troubleshooting:** Redirect URI must match exactly. Use HTTPS in production.

---

### Notion

**What it's for:** Access and update Notion databases and pages.

**Where to get credentials:** [notion.so/my-integrations](https://www.notion.so/my-integrations) – create an integration, get OAuth client ID and secret.

**Backend:** `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Productivity & Design → Notion → Connect. Complete OAuth flow.

---

### Gmail

**What it's for:** Read, send, and manage emails.

**Where to get credentials:** [Google Cloud Console](https://console.cloud.google.com) – create OAuth 2.0 credentials, enable Gmail API.

**Backend:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Same credentials can be used for Google Calendar. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Productivity & Design → Gmail → Connect. Sign in with Google when prompted.

---

### Google Calendar

**What it's for:** View and manage calendar events.

**Where to get credentials:** Same as Gmail – Google Cloud Console, enable Calendar API, use same OAuth client.

**Backend:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

**In the app:** Integrations Hub → Productivity & Design → Google Calendar → Connect.

---

### Twitter/X

**What it's for:** Post tweets and interact with Twitter/X.

**Where to get credentials:** [Twitter Developer Portal](https://developer.twitter.com) – create a project and app, get OAuth 2.0 client ID and secret.

**Backend:** `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Productivity & Design → Twitter/X → Connect.

---

### Obsidian

**What it's for:** Read and write notes, search your knowledge base (local vault).

**Where to get credentials:** No cloud credentials; local vault path.

**Backend:** `OBSIDIAN_VAULT_PATH` – path to your Obsidian vault folder. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Productivity & Design → Obsidian → Connect. Provide vault path if prompted.

---

## Voice & Messaging

### ElevenLabs

**What it's for:** Voice synthesis (TTS).

**Where to get credentials:** [elevenlabs.io](https://elevenlabs.io) – API key and optional voice ID.

**Backend:** `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Voice & Messaging → ElevenLabs → Connect with API key.

---

### Twilio

**What it's for:** SMS, voice, and WhatsApp.

**Where to get credentials:** [twilio.com](https://www.twilio.com) – account SID, auth token, phone numbers.

**Backend:** See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md) – `MESSAGING_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_REPLY_TO_NUMBER`, `TWILIO_WEBHOOK_SECRET`, `TWILIO_WHATSAPP_NUMBER` (optional).

**In the app:** Integrations Hub → Voice & Messaging → Twilio → Connect. Configure webhook URL in Twilio console to point to your backend.

**Troubleshooting:** Webhook URL must be publicly reachable (use ngrok in dev). Verify webhook secret matches.

---

### SendGrid

**What it's for:** Transactional email.

**Where to get credentials:** [sendgrid.com](https://sendgrid.com) – API key.

**Backend:** SendGrid API key in backend env (variable name as used in the app).

**In the app:** Integrations Hub → Voice & Messaging → SendGrid → Connect with API key.

---

## Other

### Home Assistant

**What it's for:** Home automation and device control.

**Where to get credentials:** Home Assistant instance – create a Long-Lived Access Token in your profile.

**Backend:** `HOME_ASSISTANT_URL`, `HOME_ASSISTANT_TOKEN`. See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).

**In the app:** Integrations Hub → Other → Home Assistant → Connect with URL and token.

---

### Stripe

**What it's for:** Billing and payments.

**Where to get credentials:** [dashboard.stripe.com](https://dashboard.stripe.com) – secret key and webhook secret.

**Backend:** See [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md) – `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

**In the app:** Used for billing; configure in Settings or backend. Set webhook endpoint in Stripe dashboard to your backend URL.

**Troubleshooting:** Use Stripe CLI to forward webhooks in development. Verify webhook signing secret.

---

### Custom

**What it's for:** User-defined integrations (API key or custom config).

**In the app:** Integrations Hub → Other → Custom – follow in-app instructions to add a custom provider or API key.

---

## Quick reference

| Category            | Integrations                                                                 |
|---------------------|-------------------------------------------------------------------------------|
| Development Tools  | GitHub, GitLab, Bitbucket, Jira, Linear, Atlassian                          |
| Communication      | Slack, Discord, Telegram                                                     |
| Deploy & Cloud      | Vercel, Netlify, AWS, GCP, Azure                                             |
| BaaS                | Supabase, Firebase                                                           |
| Productivity & Design | Notion, Figma, Gmail, Google Calendar, Twitter/X, Obsidian                |
| Voice & Messaging  | ElevenLabs, Twilio, SendGrid                                                 |
| Other               | Home Assistant, Stripe, Custom                                               |

For the full list of environment variables, see [API_AND_EXTERNAL_SETUP.md](API_AND_EXTERNAL_SETUP.md).
