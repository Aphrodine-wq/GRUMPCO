I will implement the requested UI/UX improvements and SHIP button behavior, then verify everything with Puppeteer.

**Plan:**

1.  **Update `ChatInterface.svelte`**:
    *   **Import Transition**: Import `slide` from `svelte/transition` for smooth animations.
    *   **Rearrange Buttons**: Move the **SHIP** button to the very end of the list.
    *   **Implement "Merge" Behavior**:
        *   Wrap all other mode buttons (Design, Code, Plan, Spec, Execute, Argument) in a container that hides when `chatMode` is `'ship'`.
        *   Apply a `slide` transition to this container so they smoothly disappear/reappear.
    *   **Toggle Logic**: Update the SHIP button to toggle *off* SHIP mode (back to `normal`) if clicked again.
    *   **Professional Polish**: Tweak the styling of the mode selector for a cleaner look.

2.  **Verify with Puppeteer**:
    *   Use Puppeteer to navigate to the app.
    *   Click the SHIP button and verify the UI transformation (screenshot).
    *   Click it again to verify it restores the previous state.
    *   Check for any console errors during this process.