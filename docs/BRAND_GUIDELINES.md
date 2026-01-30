# G-Rump Brand Guidelines

## Quick Reference for Contributors

---

## Brand Name

**Correct**: G-Rump  
**Incorrect**: Grump, grump, G-rump, g-rump, GRump

Always use the hyphen, always capitalize G-R.

---

## Voice & Tone

### Our Voice: "The Grumpy Expert"

- **Direct & No-Nonsense** - Gets to the point
- **Expert but Accessible** - Technical depth without arrogance
- **Subtly Playful** - Dry wit, not forced humor
- **Quality-Obsessed** - Cares about doing things right
- **Slightly Cynical** - "Seen it all" developer wisdom

### Tone by Context

| Context | Tone | Example |
|---------|------|---------|
| Documentation | Direct expert | "Here's exactly how SHIP works..." |
| Error messages | Grumpy but helpful | "Ugh, that broke. Here's the fix..." |
| Success states | Grudgingly impressed | "Hmph. That actually worked." |
| Marketing | Confident challenger | "Stop writing boilerplate. Start with architecture." |
| CLI | Playfully grumpy | "☹️ Processing... (don't rush me)" |

---

## Key Terminology

### Product Names

| Term | Usage |
|------|-------|
| G-Rump | The platform/product (always hyphenated) |
| G-Rump Desktop | The Electron application |
| G-Rump Backend | The API service |
| grump-cli | The npm package name |
| grump | The CLI command |

### Feature Names

| Term | Definition | Usage |
|------|------------|-------|
| **SHIP Workflow** | Design → Spec → Plan → Code | All caps when referring to the workflow |
| **Architecture Mode** | Generate diagrams and PRDs | Not "Design Mode" |
| **Code Mode** | Generate code from specs | Not "Generate Code Mode" |
| **Intent Compiler** | Rust-based NL parser | Not "grump-intent" in user docs |
| **Architecture-as-Code** | Our core philosophy | Hyphenated, capitalized |

### Abbreviations

- **PRD**: Product Requirements Document (define on first use)
- **CLI**: Command Line Interface (fine to use)
- **API**: Application Programming Interface (fine to use)
- **SSE**: Server-Sent Events (define on first use)

---

## Value Proposition

### Primary Message

> **"Architecture-first development, without the headache."**

### Supporting Pillars

1. **Architecture-First** - Design before you build (Terraform for apps)
2. **SHIP Workflow** - Structured process: Design → Spec → Plan → Code
3. **Multi-Agent Power** - Specialist agents for every layer
4. **Performance Built-In** - 18x faster builds, optimized costs

### Tagline Usage

**Primary** (most contexts):
> "Architecture-first development, without the headache."

**Technical** (for developer audiences):
> "Architecture-as-Code for modern development teams"

**Enterprise** (for business audiences):
> "From idea to production-ready code—structured, fast, secure"

---

## Visual Identity

### Colors

```
Primary:    Grump Purple #7C3AED
Secondary:  Code Blue    #3B82F6
Accent:     Success Green #10B981
Warning:    Caution Amber #F59E0B
Error:      Grump Red    #EF4444
Background: Soft Gray    #F9FAFB
Dark:       Code Black   #1F2937
```

### Logo Usage

- Use SVG logo from `docs/assets/grump-logo.svg`
- Maintain clear space around logo (minimum 20px)
- Don't distort, rotate, or add effects to logo
- Use monochrome version for single-color contexts

### Typography

- **Headlines**: Inter Bold (700) or Inter Black (900)
- **Body text**: Inter Regular (400), Medium (500)
- **Code**: JetBrains Mono
- **UI elements**: Inter Medium (500)

---

## Writing Guidelines

### Headlines

- Lead with value, not features
- Use active voice
- Keep under 60 characters when possible

**Good**: "Generate architecture before code"  
**Bad**: "G-Rump Architecture Mode Features"

### Technical Writing

- Write for the user, not about the product
- Use "you" and "your"
- Lead with the benefit, then explain how

**Good**: "Create a complete architecture diagram in seconds by describing your app."  
**Bad**: "G-Rump uses AI to generate Mermaid diagrams from natural language input."

### Error Messages

- State what happened
- Explain why (if helpful)
- Provide the fix
- Add grumpy personality (when appropriate)

**Template**: `[Grumpy remark]. [What happened]. [How to fix it].`

**Example**: "Ugh, connection failed. The backend isn't responding. Check that it's running on port 3000."

### Success Messages

- Acknowledge completion
- Add grudging approval
- Guide next steps

**Example**: "Hmph. Code generated. And yes, we actually tested it. [Download] [View Architecture]"

---

## Common Mistakes to Avoid

### Naming

❌ "Grump is a development platform..."  
✅ "G-Rump is a development platform..."

❌ "Use ship mode to generate code"  
✅ "Use SHIP workflow to generate code"

❌ "Open Design Mode to create diagrams"  
✅ "Open Architecture Mode to create diagrams"

### Messaging

❌ "G-Rump is 18x faster!" (feature, not benefit)  
✅ "G-Rump structures your workflow so you ship quality code faster"

❌ "AI-powered development assistant" (generic)  
✅ "Architecture-first development platform" (differentiated)

### SHIP Workflow

❌ "Scope → Hypothesis → Implementation → Production"  
✅ "Design → Spec → Plan → Code"

---

## Examples by Context

### README Introduction

```markdown
# G-Rump

> Architecture-first development, without the headache.

G-Rump is an Architecture-as-Code platform that structures your entire development workflow. Unlike AI tools that jump straight to code, we enforce a spec-first approach:

**Design** → **Spec** → **Plan** → **Code**

Because writing code without a plan is just asking for technical debt.
```

### Marketing Site Hero

```
G-Rump
Architecture-first development, without the headache.

Stop writing boilerplate. Start with architecture.
Generate production-ready code through our structured SHIP workflow.

[Get Started] [See Examples]
```

### Loading State

```
☹️ Hmph. Processing your request...

(Analyzing intent... 45%)
```

### Error State

```
☹️ Ugh. Something went wrong.

Error: Failed to connect to backend
The API isn't responding. Is it running on port 3000?

[Retry] [Check Documentation]
```

### Success State

```
✓ SHIP Workflow Complete

Hmph. Four phases, zero shortcuts. That's how you ship.

Architecture diagram generated
PRD created and approved  
Implementation plan defined
Production code ready

[Download Code] [View on GitHub] [Start New Project]
```

---

## Review Checklist

Before publishing any content, verify:

- [ ] Brand name is "G-Rump" (hyphenated, capital G-R)
- [ ] SHIP workflow is defined as Design → Spec → Plan → Code
- [ ] Voice matches context (see Tone table above)
- [ ] Value proposition leads with Architecture-as-Code
- [ ] Terminology matches standards (see Key Terminology)
- [ ] No feature-dumps without benefit explanations
- [ ] Microcopy has appropriate personality
- [ ] Logo/colors match visual identity

---

## Questions?

Refer to the full [Brand Audit & Messaging Strategy](./BRAND_AUDIT.md) for detailed analysis and recommendations.

For quick questions:
- **Voice**: Think "grumpy developer friend who cares about quality"
- **Terminology**: When in doubt, use the simplest, clearest term
- **Value**: Always lead with Architecture-as-Code, not performance specs

---

*Last updated: January 2026*  
*Next review: Monthly*
