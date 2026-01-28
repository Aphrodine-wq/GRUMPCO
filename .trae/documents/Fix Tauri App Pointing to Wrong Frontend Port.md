I found the issue. The Tauri application is currently configured to point to the **marketing website** (port 5178) instead of the **main Chat Interface application** (port 5173).

Here is the plan to fix it:

1.  **Update Configuration**: Change the `devUrl` in `frontend/src-tauri/tauri.conf.json` from `http://localhost:5178` to `http://localhost:5173`.
2.  **Restart Tauri**: Restart the Tauri development process so it loads the correct application.
3.  **Verify Web Access**: Ensure the Chat Interface is accessible at `http://localhost:5173` in your browser.

This will switch the view from the "Workspace/Dashboard" page you are seeing to the actual Chat Interface you expect.