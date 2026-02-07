# UI Updates (Recent)

Summary of recent UI/UX changes in the G-Rump frontend.

## Dark mode

- Main area backgrounds use theme variables (`--color-bg-app`, `--color-bg-subtle`, `--color-bg-secondary`, `--color-bg-card`, `--color-bg-inset`).
- **ScreenLayout**: Back button, title, and subtitle use theme-aware colors.
- **RefactoredChatInterface**: Status sidebar, memory sidebar, and live output panel use theme vars so dark mode renders correctly.

## G-Agent in chat

- **Use G-Agent button**: In the chat header, clicking "Use G-Agent" turns the current session into a G-Agent session and keeps you in chat. Status and Memory panels appear in the header; no navigation to a separate screen.
- When already in a G-Agent session, the same button shows "G-Agent" and opens the full G-Agent screen (goal queue, settings) from the sidebar.
- The "Use G-Agent" state is styled as a primary call-to-action when not yet in G-Agent mode.

## G-Agent screen (simplified)

- **Goal Queue** and **Agent Memory** remain the main content; **Quick actions** now include **Chat**, **SHIP**, and **Projects** (link to Projects view).
- **Capabilities & security** (tool categories and external API allowlist) are no longer edited on the G-Agent screen; a single card links to **Settings → Security**.
- **Integrations** CTA text mentions **Twilio** (and GitHub, Slack, Figma) so users know messaging/voice integrations are available.
- When Docker is not detected, a short one-line hint with "Set up Docker" link is shown instead of a large duplicate block.

## Settings & appearance

- **AI Providers** (Settings → AI Providers): Card layout with larger icons, clearer hierarchy, theme-aware styling, and a "What's new" style for the add-more-providers section.
- **Memory tab**: Real memory settings (persistence, large-context toggle, link to Memory manager).
- **Security tab**: Allowed API domains card using `gAgentExternalAllowlist`.
- **Billing**: Coming Soon replaced with links to billing portal and Buy Credits.
- **Docker**: Minimal view with "Open Docker Desktop" and Docker Setup Wizard.
- **Theme, density, font size**: Applied via `themes.css` and `App.svelte`; Frowny accent follows accent color; compact density reduces padding.

## Chat & navigation

- **Command palette**: White background, purple text/accents (Ctrl+K).
- **Connection banner**: Skinny strip with status dot (green/orange) and Retry when disconnected.
- **Sidebar**: Primary nav items slightly smaller.
- **Model selector**: Card-style button with current model and "Change"; tooltip points to Model Benchmark.
- **New Chat**: Default session name is "New Chat".

## Onboarding

- **Next steps slide**: "What's new" section highlights G-Agent in chat, Model Benchmark, Credits & billing, and dark mode/themes.
- Quick tips updated to mention "Use G-Agent" in chat and Model Benchmark from sidebar or Ctrl+K.

## Theming tokens

- `themes.css` defines `--color-bg-secondary` for both light and dark themes so any component using `var(--color-bg-secondary)` gets the correct background.

## Performance

- **Settings tabs**: TabbedSettingsScreen renders only the active tab (`{#if activeTab === 'general'} ... {:else if activeTab === 'ai'} ...`), so heavy tabs (Integrations, MCP, etc.) are not mounted until selected.
- **Backend**: Cold routes are lazy-loaded via the registry; `/api/skills` is mounted eagerly so the Skills screen never gets 404.
- **Frontend**: Prefer `$derived` for computed values to avoid unnecessary re-renders; long message lists could be virtualized in a future pass if needed.

---

For deployment and environment setup, see [RENDER_BACKEND_ENV.md](./RENDER_BACKEND_ENV.md) and [GETTING_STARTED.md](./GETTING_STARTED.md).
