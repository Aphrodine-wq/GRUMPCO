# G-Rump Brand Improvement Action Plan

## Immediate Actions (Complete This Week)

### 1. Fix Critical Naming Inconsistencies

**Files to update**:
- `README.md` - Ensure "G-Rump" (not "Grump")
- `docs/OVERVIEW.md` - Standardize all product references
- `docs/CAPABILITIES.md` - Fix "Grump" references
- `marketing-site/index.html` - Update logo alt text

**Search commands**:
```bash
# Find inconsistent naming
grep -r "Grump " --include="*.md" --include="*.html" . | grep -v "G-Rump"

# Find lowercase grump at start of sentence
grep -r "^grump\|\. grump" --include="*.md" . | grep -v "grump-cli\|grump-"
```

### 2. Standardize SHIP Workflow Definition

**Update these files to use: Design → Spec → Plan → Code**

1. `docs/OVERVIEW.md` (lines 29-34)
2. `docs/CAPABILITIES.md` (lines 171-178)
3. `docs-site/index.md` (line 25)
4. `README.md` (check architecture diagram)
5. `marketing-site/index.html` (line 445)

**Template for SHIP explanation**:
```markdown
## SHIP Workflow

**Design** → **Spec** → **Plan** → **Code**

1. **Design** - Describe your idea, get architecture diagram
2. **Spec** - Generate detailed PRD with requirements
3. **Plan** - Break down into implementation tasks  
4. **Code** - Generate production-ready codebase

SHIP enforces structure so you don't end up with unmaintainable code.
```

### 3. Unify Tagline

**Choose ONE tagline and update all files**:

**Recommended**: "Architecture-first development, without the headache."

**Files to update**:
- `README.md` line 5
- `docs/OVERVIEW.md` line 1
- `marketing-site/index.html` line 6 (title) and line 230 (hero subtitle)
- `docs-site/index.md` line 7

### 4. Marketing Site Fixes

**In `marketing-site/index.html`**:

1. **Line 6**: Shorten title to under 60 characters
   ```html
   <title>G-Rump | Architecture-First Development Platform</title>
   ```

2. **Line 7**: Rewrite description for humans
   ```html
   <meta name="description" content="G-Rump structures your development workflow from design to deployment. Generate architecture diagrams, PRDs, and production-ready code." />
   ```

3. **Line 742**: Update copyright year
   ```html
   <p>&copy; 2026 G-Rump. AI-Powered Development Assistant.</p>
   ```

4. **Logo inconsistency**: Use same icon in favicon and hero
   - Option A: Update favicon to use grumpy face
   - Option B: Update hero to use purple circle logo

---

## Short-term Actions (Complete This Month)

### 5. Rewrite README Introduction

**Current (lines 1-17)**:
Too technical, no personality, feature-dump style.

**Proposed**:
```markdown
<p align="center">
  <img src="docs/assets/grump-logo.svg" width="120" alt="G-Rump logo" />
</p>

# G-Rump

> Architecture-first development, without the headache.

G-Rump is an Architecture-as-Code platform that structures your entire workflow. 
Unlike AI tools that jump straight to messy code, we enforce a spec-first approach.

**The SHIP Workflow:**
Design → Spec → Plan → Code

Because writing code without a plan is just asking for technical debt.

## Why G-Rump?

- **Architecture-First** - Generate C4 diagrams and PRDs before touching code
- **Structured Process** - SHIP workflow prevents chaos  
- **Multi-Agent Power** - Specialist agents for frontend, backend, DevOps
- **Performance Built-In** - 18x faster builds with SWC, 60-70% cost savings

## Quick Start

[Keep existing quick start section]
```

### 6. Audit Frontend Microcopy

**Files to review for personality**:
- `frontend/src/components/ChatEmptyState.svelte`
- `frontend/src/components/SetupScreen.svelte`
- `frontend/src/components/SettingsScreen.svelte`

**Update examples**:

**Loading states**:
```svelte
<!-- Current -->
<div>Loading...</div>

<!-- Proposed -->
<div>☹️ Hmph. Processing your request...</div>
```

**Success states**:
```svelte
<!-- Current -->
<div>Success!</div>

<!-- Proposed -->
<div>Huh. That actually worked. ✓</div>
```

### 7. Create SHIP.md Documentation

**New file**: `docs/SHIP.md`

Purpose: Single source of truth for SHIP workflow.

**Outline**:
1. What is SHIP?
2. The Four Phases (Design, Spec, Plan, Code)
3. When to use SHIP vs other modes
4. Example walkthrough
5. API reference for SHIP endpoints

### 8. Update Legal Documents

**In `docs/legal/TERMS_OF_SERVICE.md` and `PRIVACY_POLICY.md`**:

1. Add actual dates instead of "[Date]"
2. Ensure "G-Rump" (not "Grump") throughout
3. Add brand contact: support@g-rump.com

---

## Medium-term Actions (Complete This Quarter)

### 9. Simplify Architecture Diagrams

**Problem**: Current diagrams in README and docs are overwhelming.

**Solution**:
1. Create simplified high-level diagram (3-5 boxes max)
2. Keep detailed diagram but show it second
3. Add animated/interactive version for marketing

### 10. Develop Brand Mascot

**Deliverables**:
1. Simple grumpy character illustration (SVG)
2. 5 expressions: thinking, working, success, error, waiting
3. Use in empty states and loading screens
4. Create sticker pack for GitHub/marketing

### 11. Competitive Comparison Page

**New file**: `marketing-site/vs.html`

**Sections**:
- G-Rump vs Cursor (architecture-first vs chat-first)
- G-Rump vs v0 (complete workflow vs UI prototypes)
- G-Rump vs Claude Code (structured vs exploratory)

### 12. Launch "Grumpy Developer" Content Series

**Content ideas**:
- Blog: "Things that make G-Rump grumpy" (anti-patterns)
- Twitter/X: Grumpy takes on dev trends
- Memes: Relatable developer frustrations
- Newsletter: "The Grumpy Report" (monthly updates)

---

## Success Metrics

Track progress monthly:

| Metric | Baseline | Month 1 | Month 3 |
|--------|----------|---------|---------|
| Brand consistency score | 45% | 70% | 90% |
| Naming inconsistencies | 23 | 5 | 0 |
| Docs with brand voice | 1 (CLI) | 10 | All |
| User comprehension test | Unknown | 50% | 75% |
| Support ticket sentiment | Neutral | Mixed | Positive |

---

## Quick Wins (Do Today)

1. **Fix footer copyright year** (2 minutes)
2. **Update README title** (5 minutes)
3. **Standardize SHIP in one doc** (10 minutes)
4. **Add grumpy loading message** (15 minutes)
5. **Fix 3 naming inconsistencies** (20 minutes)

**Total time**: ~1 hour for immediate credibility improvements.

---

## Resources

- **Full Audit**: `docs/BRAND_AUDIT.md`
- **Brand Guidelines**: `docs/BRAND_GUIDELINES.md`
- **This Action Plan**: `docs/BRAND_ACTION_PLAN.md`

---

## Questions or Blockers?

Open an issue with label `brand-consistency` or discuss in #brand channel.

**Remember**: The CLI's grumpy personality is our brand differentiator. Extend it everywhere.

---

*Created: January 2026*  
*Review: Monthly*
