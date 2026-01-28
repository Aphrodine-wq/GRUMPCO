# Architecture-as-Code

G-Rump is **Architecture-as-Code**: living documentation that can generate code. Like Terraform for infrastructure, but for application architecture. Your diagram and spec are the source of truth; code generation is optional.

## One-liner

**G-Rump is Terraform for application architecture: your diagram and spec are the source of truth; code generation is optional.**

Teams can use G-Rump’s architecture output (Mermaid diagram, intent, tech stack, task breakdown) without ever generating code. Spec-first developers, engineering leads, and regulated teams get a single place to define *what* will be built before touching a repo.

## What we’re not

G-Rump is **not** an AI code generator. It’s not “ship fast, iterate in chat.” It’s living documentation first: diagram → spec → plan. Generating code is a bonus step you can take when the spec is already right.

## The artifact comes first

Your real output is:

1. **Mermaid diagram** – System context, containers, components (C4-style). The lead artifact.
2. **Intent tree** – Features, actors, data flows, tech stack hints (derived from or feeding the diagram).
3. **Tech stack spec** – Frameworks, runtimes, databases (in the spec and intent).
4. **Task breakdown** – Plan phases and steps (what we will build).

Code generation is “we already have the spec; generating code is easy.” You can stop after architecture + spec + plan and use the artifacts for review, handoff, compliance, or onboarding—no codegen required.

## Terraform analogy

| Terraform (IaC)        | G-Rump (Architecture-as-Code)     |
|------------------------|-----------------------------------|
| Single source of truth | Diagram + spec as source of truth |
| Plan before apply      | Plan (task breakdown) before code |
| Apply                  | Optional: generate code (ZIP/push)|
| State file             | Architecture/spec (export, version as needed) |

You define the architecture in one place; you can diff it, share it, and only when ready, “apply” by generating code.

## Use without codegen

You can use G-Rump purely for architecture and spec:

- **Engineering leads** – Standardize what gets built. Junior PRs match the spec; fewer “what did we agree to?” meetings.
- **Regulated industries** – Audit trail: diagram + spec + plan. Export for reviewers; version artifacts as needed.
- **Burned-by-debt developers** – Never start coding without a diagram and spec. Something to point to when scope creeps.

Workflow: **Architecture → Spec → Plan** (stop here), or continue to **Code** when you want a generated codebase.

## Flows in the product

- **Chat-first** – Describe intent in Architecture mode; get diagram and summary in chat. Optionally move to phase bar for Spec → Plan → (optional) Code.
- **Phase bar** – Architecture → Spec → Code. Code is the final, optional step. You can stop after Spec (or after Plan when SHIP is used).
- **SHIP** – Design → Spec → Plan → Code in one run. Code is still optional in messaging: the value is the full spec and plan; codegen is the bonus.

## Where to start in the API

**Start here (architecture-first):**

1. `POST /api/intent/parse` – Parse natural language intent.
2. `POST /api/architecture/generate` or `.../generate-stream` – Get Mermaid diagram.
3. `POST /api/prd/generate` or `.../generate-stream` – Get spec (PRD).
4. Plan (via SHIP or `/api/plan`) – Task breakdown.

**Optional:** `POST /api/codegen/start` – Generate code from the spec. Use when you already have architecture + spec and want a ZIP or GitHub push.

See [CURSOR_GRUMP_API.md](CURSOR_GRUMP_API.md) for endpoints and [OVERVIEW.md](OVERVIEW.md) for system overview.
