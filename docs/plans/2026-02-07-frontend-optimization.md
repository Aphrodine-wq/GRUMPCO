# Frontend Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce initial bundle size from 123KB to ~80-90KB gzipped by lazy-loading heavy libraries, removing unused CSS, fixing vendor chunking, and resolving circular dependencies.

**Architecture:**
- Lazy-load Shiki (syntax highlighting, 1.6MB gzipped) and Mermaid (851KB gzipped) dynamically
- Break up 2.5MB vendor chunk into smaller, cacheable pieces
- Remove ~50+ unused CSS selectors across components
- Fix circular dependency: vendor-shiki → feature-heavy → vendor-svelte → vendor-shiki
- Use dynamic imports and improved Vite chunking strategy

**Tech Stack:** Vite, Svelte 5, Shiki (syntax highlighting), Mermaid (diagrams)

---

## Task 1: Update Vite Config - Fix Vendor Chunking

**Files:**
- Modify: `frontend/vite.config.js:105-148` (manualChunks logic)

**Step 1: Review current chunking strategy**

The current config has issues:
- Circular dependency with vendor-shiki
- PDF chunk is empty (0 bytes)
- Vendor chunk is 2.5MB (too large)

**Step 2: Update manualChunks to break vendor into smaller pieces**

Replace the manualChunks function (lines 105-148) with:

```javascript
manualChunks(id) {
  // Framework core - loaded on every page (must be small)
  if (id.includes('node_modules')) {
    // Svelte runtime - framework (tiny, essential)
    if (id.includes('/svelte/') || id.includes('/svelte$')) {
      return 'vendor-svelte'
    }

    // Auth/DB - critical for app
    if (id.includes('@supabase')) {
      return 'vendor-supabase'
    }

    // UI icons - needed on most pages
    if (id.includes('lucide-svelte')) {
      return 'vendor-icons'
    }

    // Heavy feature libraries - lazy loaded on demand
    // These should NOT be in the main bundle
    if (id.includes('mermaid')) {
      return 'vendor-mermaid' // Lazy loaded in BuilderScreen
    }
    if (id.includes('shiki')) {
      return 'vendor-shiki' // Lazy loaded in CodeDiffViewer
    }
    if (id.includes('jspdf')) {
      return 'vendor-pdf' // Lazy loaded for exports
    }

    // Markdown - used in multiple places, but can be lazy
    if (id.includes('marked') || id.includes('markdown')) {
      return 'vendor-markdown'
    }

    // Diff utility - used in CodeDiffViewer, lazy loaded
    if (id.includes('diff')) {
      return 'vendor-diff'
    }

    // Catch-all for other third-party libs
    // This should be much smaller now
    return 'vendor'
  }

  // Route-based chunking for heavy components
  // Only the feature components that have significant code
  if (id.includes('/components/')) {
    // These components are used on specific routes
    if (id.includes('AgentSwarmVisualizer')) {
      return 'component-agent-swarm'
    }
    if (id.includes('DesignToCodeScreen')) {
      return 'component-design-to-code'
    }
    if (id.includes('VoiceCodeScreen')) {
      return 'component-voice'
    }
  }
}
```

**Step 3: Verify the change**

Check that vendor-specific chunks are properly isolated:
- vendor-svelte: Framework only (~33KB gzipped)
- vendor-supabase: Auth/DB (~TBD)
- vendor-icons: Lucide icons (~TBD)
- vendor-mermaid: Lazy loaded (851KB, only on demand)
- vendor-shiki: Lazy loaded (1.6MB, only on demand)
- vendor: Other deps (much smaller now)

**Step 4: Commit**

```bash
git add frontend/vite.config.js
git commit -m "refactor: improve vendor chunk splitting strategy

- Isolate Svelte, Supabase, icons into separate cacheable chunks
- Lazy-load mermaid, shiki, diff as on-demand bundles
- Reduces initial vendor chunk from 2.5MB to ~500KB"
```

---

## Task 2: Update Vite Config - Lazy Load Heavy Dependencies in optimizeDeps

**Files:**
- Modify: `frontend/vite.config.js:175-199` (optimizeDeps)

**Step 1: Review current optimizeDeps**

Currently includes lazy-load libraries in exclude, but we need to be more aggressive.

**Step 2: Move heavy deps to exclude (don't pre-bundle)**

Replace optimizeDeps section (lines 175-199):

```javascript
optimizeDeps: {
  // Pre-bundle only truly critical dependencies
  include: [
    'svelte',
    'svelte/animate',
    'svelte/easing',
    'svelte/internal',
    'svelte/motion',
    'svelte/store',
    'svelte/transition',
    '@supabase/supabase-js',
    'lucide-svelte',
    'svelte-spa-router',
  ],
  // Exclude heavy libraries - they'll be loaded on demand
  exclude: [
    'jspdf',
    'shiki',
    'diff',
    'mermaid',
    'marked',
  ],
  // Use cache to avoid re-optimizing every dev startup
  force: false,
},
```

**Step 3: Test dev server startup**

Run: `npm run dev`
Expected: Dev server starts in ~5-10 seconds (faster than before)

**Step 4: Commit**

```bash
git add frontend/vite.config.js
git commit -m "refactor: exclude heavy deps from pre-bundling

- Shiki, Mermaid, jsPDF, Marked excluded from optimizeDeps
- Improves dev server startup time
- Libraries loaded dynamically when needed"
```

---

## Task 3: Verify Shiki is Lazy Loaded Correctly

**Files:**
- Verify: `frontend/src/utils/highlighter.ts` (already has lazy loading)
- Verify: `frontend/src/components/CodeDiffViewer.svelte` (uses highlighter)

**Step 1: Check that highlighter.ts uses dynamic import**

The file should use `await import('shiki')` not static import.

Run: `grep -n "import('shiki')" frontend/src/utils/highlighter.ts`
Expected: Find line with `const { createHighlighter } = await import('shiki')`

**Step 2: Check CodeDiffViewer calls initHighlighter on mount**

Run: `grep -n "initHighlighter\|onMount" frontend/src/components/CodeDiffViewer.svelte | head -5`
Expected: See initHighlighter being called on mount

**Step 3: Verify no static imports of shiki in component tree**

Run: `grep -r "^import.*from.*shiki\|^import.*shiki" frontend/src --include="*.svelte" --include="*.ts" --include="*.js"`
Expected: No results (all shiki imports should be dynamic)

**Step 4: Commit (no code changes, just verification)**

```bash
git add -A
git commit -m "docs: verify shiki lazy loading implementation

- Shiki already uses dynamic import in highlighter.ts
- CodeDiffViewer calls initHighlighter on mount
- No static shiki imports in codebase"
```

---

## Task 4: Verify Mermaid is Lazy Loaded Correctly

**Files:**
- Verify: `frontend/src/lib/mermaid.ts` (should have lazy loading)
- Verify: `frontend/src/components/BuilderScreen.svelte` (uses mermaid)

**Step 1: Check mermaid.ts uses dynamic import**

Run: `grep -n "await import('mermaid')" frontend/src/lib/mermaid.ts`
Expected: Find line with dynamic import

**Step 2: Check BuilderScreen initializes mermaid on mount**

Run: `grep -n "initializeMermaid\|onMount" frontend/src/components/BuilderScreen.svelte | head -5`
Expected: See initializeMermaid being called

**Step 3: Verify no static imports of mermaid**

Run: `grep -r "^import.*from.*mermaid" frontend/src --include="*.svelte" --include="*.ts" --include="*.js" | grep -v test | grep -v "//.*mermaid"`
Expected: No results (mermaid should be dynamically imported)

**Step 4: Commit**

```bash
git add -A
git commit -m "docs: verify mermaid lazy loading implementation

- Mermaid uses dynamic import in mermaid.ts
- BuilderScreen initializes on mount
- No static mermaid imports in production code"
```

---

## Task 5: Remove Unused CSS Selectors - Part 1 (GAgentStatusPanel)

**Files:**
- Modify: `frontend/src/components/gAgent/GAgentStatusPanel.svelte:283-397` (unused CSS)

**Step 1: Identify unused CSS rules**

From build output, these selectors are unused:
- `.gagent-status-panel.site-style .panel-meta`
- `.gagent-status-panel.site-style .stat-card`
- `.gagent-status-panel.site-style .stat-label`
- `.gagent-status-panel.site-style .stat-value`
- `.gagent-status-panel.site-style .stat-value-blue`
- `.gagent-status-panel.site-style .stat-value-green`
- `.gagent-status-panel.site-style .stat-sublabel`
- `.gagent-status-panel.site-style .cap-tag`

**Step 2: Read the file to see context**

Run: `Read frontend/src/components/gAgent/GAgentStatusPanel.svelte` lines 283-397

**Step 3: Check if `.site-style` class is actually used**

Run: `grep -n "site-style" frontend/src/components/gAgent/GAgentStatusPanel.svelte`
If no matches found, these are dead CSS rules.

**Step 4: Remove unused CSS block**

Remove lines 285-397 if the `.site-style` variant isn't used.

**Step 5: Commit**

```bash
git add frontend/src/components/gAgent/GAgentStatusPanel.svelte
git commit -m "refactor: remove unused .site-style CSS variant

- Removes 8 unused CSS selectors (~1KB)"
```

---

## Task 6: Remove Unused CSS Selectors - Part 2 (AskDocsScreen)

**Files:**
- Modify: `frontend/src/components/AskDocsScreen.svelte` (multiple unused selectors)

**Step 1: List unused selectors from build output**

- `.query-card` (line 604)
- `.ask-btn` (line 671)
- `.result-card` (line 771)
- `.result-card.error` (line 775)
- `.type-chips` (line 885)

**Step 2: Determine if these are actually used in the component**

Run: `grep -n "query-card\|ask-btn\|result-card\|type-chips" frontend/src/components/AskDocsScreen.svelte`

If the selectors exist but aren't applied to any elements, remove them.

**Step 3: Remove unused CSS rules**

Delete the CSS rules for selectors not applied to any HTML elements.

**Step 4: Test component still works**

Run: `npm run dev` and navigate to AskDocsScreen in browser
Expected: Component renders correctly with no visual changes

**Step 5: Commit**

```bash
git add frontend/src/components/AskDocsScreen.svelte
git commit -m "refactor: remove unused CSS selectors in AskDocsScreen

- Removes 5 unused selectors (~2KB gzipped)"
```

---

## Task 7: Remove Unused CSS Selectors - Part 3 (DesignToCodeScreen)

**Files:**
- Modify: `frontend/src/components/DesignToCodeScreen.svelte` (11 unused selectors)

**Step 1: List unused selectors**

- `.generate-btn-sticky`
- `.step-card`
- `.step-hint-inline`
- `.figma-btn`
- `.generate-wrap`
- `.drop-zone.has-image`
- `.clear-btn`
- `.generate-heading`
- `.generate-row`
- `.generate-btn`
- `.generate-btn.loading`
- `.result-card.error`
- `.region-result`

**Step 2: Verify these aren't used**

Run: `grep -E "generate-btn-sticky|step-card|step-hint-inline|figma-btn" frontend/src/components/DesignToCodeScreen.svelte | grep -v "^\s*\." | grep -v "^\s*\/\/"`

If only CSS definitions found, they're unused.

**Step 3: Remove unused CSS**

Delete the CSS rules.

**Step 4: Test component**

Navigate to DesignToCodeScreen in browser
Expected: Component works without visual changes

**Step 5: Commit**

```bash
git add frontend/src/components/DesignToCodeScreen.svelte
git commit -m "refactor: remove 13 unused CSS selectors in DesignToCodeScreen

- Removes dead CSS rules (~4KB gzipped)"
```

---

## Task 8: Remove Unused CSS Selectors - Part 4 (Other Components)

**Files:**
- Modify: Multiple files with 1-2 unused selectors each:
  - `AgentSwarmVisualizer.svelte`
  - `DockerPanel.svelte`
  - `DockerSetupWizard.svelte`
  - `VoiceCodeScreen.svelte`
  - `IntegrationsHub.svelte`
  - `onboarding-v2/slides/*.svelte`
  - `chat/ArtifactViewer.svelte`

**Step 1: Create a script to find and list all unused selectors**

Create a temporary file listing all unused selectors from build output.

**Step 2: Process each file**

For each component, remove CSS rules that aren't applied to any HTML element.

**Step 3: Test components**

Run: `npm run dev` and spot-check a few components
Expected: All components render normally

**Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "refactor: remove 20+ unused CSS selectors across components

- Cleans up dead CSS rules
- Reduces CSS bundle by ~3KB gzipped"
```

---

## Task 9: Run Production Build and Verify Bundle Size Reduction

**Files:**
- None (verification only)

**Step 1: Clean previous build**

Run: `rm -rf frontend/dist frontend/build`

**Step 2: Run production build**

Run: `cd frontend && npm run build`

Expected output should show:
- Main chunk smaller (~100-110KB gzipped vs 123KB)
- No circular dependency warnings
- Empty vendor-pdf chunk still exists but that's okay (will be lazy loaded)

**Step 3: Analyze bundle with stats.html**

The build produces `dist/stats.html` with visualization.

Run: `npm run build 2>&1 | grep -E "vendor|index|feature|\.js"` to see final sizes

Expected:
- vendor-shiki: 9.1MB (same, but lazy loaded)
- vendor-mermaid: 851KB (same, but lazy loaded)
- vendor: Much smaller than 2.5MB (because heavy deps moved)
- index.js: ~400KB uncompressed, ~100KB gzipped (vs 441KB/123KB before)

**Step 4: Commit**

```bash
git add -A
git commit -m "perf: bundle optimization complete

- Vendor chunk refactored: heavy deps lazy-loaded
- Unused CSS removed: ~8KB gzipped savings
- Initial JS bundle: ~123KB -> ~100-110KB gzipped (15-20% reduction)
- Shiki, Mermaid loaded on demand only
- Improved cache effectiveness with better chunking"
```

---

## Task 10: Optional - Fix ARIA/A11y Warnings (If Desired)

**Files:**
- `ConfirmModal.svelte`
- `ArtifactViewer.svelte`
- `DesignToCodeScreen.svelte`

**Note:** These are quality-of-life improvements, not performance. Only do if you have time.

Common issues:
- Non-interactive `<div>` with click handlers should be `<button>`
- Click handlers need `onkeydown` handlers
- Unused svelte:component in runes mode

**Skip for now and do later if desired.**

---

## Summary of Changes

| Task | Files | Bundle Impact | Time |
|------|-------|---------------|------|
| 1-2 | vite.config.js | Vendor chunks split better | 5 min |
| 3-4 | highlighter.ts, mermaid.ts | Verify lazy loading | 5 min |
| 5-8 | Multiple .svelte | Remove ~8KB CSS | 20 min |
| 9 | Build & verify | Measure gains | 10 min |

**Expected Results:**
- Initial JS: 123KB → ~100-110KB gzipped (15-20% reduction)
- CSS: Cleaner, less dead code
- Dev performance: Faster startup (heavy deps not pre-bundled)
- Production: Better caching with improved chunking

---
