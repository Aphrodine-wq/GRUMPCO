I will remove the unnecessary dashboard screen from the web app, confirm the main screen upgrades, and sync to Git.

**Plan:**

1.  **Remove Dashboard Route**:
    *   Modify `web/src/App.svelte` to remove the `Dashboard` route and `Dashboard` import.
    *   Change the root route (`/`) to redirect to or render `Workspace` instead of `Dashboard`, effectively making the Workspace (Chat/Main UI) the default view.
    *   Remove the "Dashboard" link from the navigation bar.

2.  **Verify Main Screen Upgrades**:
    *   I previously upgraded `ChatInterface.svelte` (frontend) with cleaner UI, shadows, and the new SHIP button behavior.
    *   I also upgraded `Workspace.svelte` (web) to be full-screen.
    *   I will double-check that these changes are effective and consistent.

3.  **Git Sync**:
    *   Stage all changes (including the route removal).
    *   Commit with a message like "Remove Dashboard, set Workspace as default, and sync UI upgrades".

This will ensure the web app opens directly to the useful "Workspace" (Chat) view, matching the desktop experience, and removes the placeholder dashboard you don't want.