I will fix the configuration and code issues causing the linter errors. The root cause of the "Cannot find name '$state'" errors is that `svelte-check` version 3.x (currently installed) does not support Svelte 5 Runes; I will upgrade it to v4. I will also fix the type mismatch in the store and remove unused code.

### **Plan**
1.  **Upgrade Tooling:**
    *   Update `frontend/package.json` to use `"svelte-check": "^4.1.1"` (supports Svelte 5).
    *   Run `npm install` to apply the upgrade.

2.  **Fix Type Errors (`mermaidToCodeStore.ts`):**
    *   Add explicit type casting or annotations to state updates where TypeScript fails to infer the specific union type for `status`.

3.  **Clean Up `ChatInterface.svelte`:**
    *   Remove unused imports (`RefinementActions`, `CodeGenPanel`, etc.) and unused variables (`lastError`, `isTyping`, etc.) reported by the linter.

4.  **Fix Deprecations (Svelte 5 Migration):**
    *   Update `on:click` to `onclick` in `DiagramRenderer.svelte` and `ArchitecturePreview.svelte` to match Svelte 5 syntax and resolve linter warnings.
