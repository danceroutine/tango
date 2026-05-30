---
name: dogfooding
description: Run dogfooding verification by spawning independent subagents with defined personas in isolated environments. Use when the user asks to dogfood docs, verify onboarding, validate that instructions work end-to-end, or invokes dogfooding with context-specific verification goals. For Tango docs that install from npm, provisions a local Verdaccio registry so subagents run documented commands verbatim.
---

# Dogfooding

Use this skill only when the user explicitly requests dogfooding. Do not trigger it for ordinary doc edits, code review, or implementation work.

Dogfooding validates instructions and first-run experience. Subagents follow materials as a newcomer would and report friction. They do not debug or fix the product under test.

## Context the user provides

Before spawning subagents, collect or infer these inputs. Ask once for anything still missing:

| Input | Purpose |
|-------|---------|
| **Verification goal** | What success means (e.g. scaffold and run an app from Getting Started) |
| **Materials** | Docs, plan files, or other instructions subagents must follow |
| **Environment** | How packages and tools are made available. For Tango docs that use `pnpm dlx @danceroutine/...`, follow [local-verdaccio-registry.md](references/local-verdaccio-registry.md). |
| **Personas** | Default is three (below); override if the user specifies fewer or different roles |
| **Stop condition** | When each subagent stops (default: verification goal met or blocked) |

## Workflow

1. Announce `Executing dogfooding.`
2. Restate the verification goal and materials back to yourself before setup.
3. Prepare environments **before** launching subagents. You run setup; subagents never do.
   - For Tango docs dogfooding (`pnpm dlx @danceroutine/...`, `pnpm add @danceroutine/...`), follow [local-verdaccio-registry.md](references/local-verdaccio-registry.md): build packages, start Verdaccio, publish `@danceroutine/*`, pre-flight the documented flow once, then provision per-subagent dirs.
   - Otherwise, provision a fully functional environment so documented commands can succeed (local registry, tarball install, workspace clone, or equivalent).
   - One working directory under `/tmp` per subagent; no shared paths or state. Each Tango subagent also gets an isolated pnpm `store-dir` (see reference).
   - Verify the environment is consumable before handing it to a subagent.
   - Include materials exactly as a real user would see them — edited files on disk, plan draft copy, or rendered paths. Do not paraphrase into prompts.
4. Spawn one subagent per persona (default three). Pass absolute paths to materials and each isolated working directory.
5. Wait for all subagent reports.
6. Synthesize findings and present them to the user (see Synthesis).
7. Close subagent threads after synthesis unless the user continues the loop.
8. Tear down ephemeral harness resources (Verdaccio, `/tmp/tango-agent-*`, preflight dirs) unless the user continues the loop.

## Hard constraints (include in every subagent prompt)

- Use **only** the provided materials as the guide.
- Do **not** inspect product or package source code.
- Do **not** fix or patch the product if something breaks. A broken or confusing step is a finding to report.
- Stop when the verification goal is met, or when blocked.

## Default personas

Spawn three subagents unless the user specifies otherwise:

1. **Experienced Django developer** — knows Django models, migrations, the ORM, and typical project layout; evaluates Tango through that lens.
2. **Experienced TypeScript developer** — knows TypeScript tooling, package managers, and typical app structure; may not know Django.
3. **Inexperienced developer (junior level)** — limited production experience; needs every step spelled out.

Give each persona independent framing so reports do not collapse into the same narrative.

If the Task/subagent tool is unavailable, abort and tell the user dogfooding requires independent subagents. Do not run the passes yourself; shared context would bias the outcomes.

## Subagent prompt checklist

Each subagent prompt must include:

- Persona name and mindset
- Verification goal and stop condition (verbatim)
- Absolute path to isolated working directory
- Absolute paths to materials
- Environment setup notes (what is pre-provisioned, how to install or run). For Verdaccio harnesses, tell subagents the registry is pre-provisioned — not a documented step.
- All hard constraints from above
- The report template below

## Required report (each subagent)

```markdown
# Dogfooding report — [persona name]

## Outcome
[running | blocked]

## What went well

## What went wrong

## Friction
[Was the material straightforward to follow? Where did momentum stop?]

## Continue with product?
[Would this persona continue using the product based on this experience? Why or why not?]

## Blocker details
[If blocked: exact step, command output or error, and what was unclear]
```

## Synthesis

After all subagents report:

1. Deduplicate overlapping friction.
2. Preserve persona-specific differences.
3. Order by severity: blockers first, then confusion, then minor friction.
4. Present to the user:
   - **Blockers** — steps that prevent completion
   - **Friction** — completable but painful or unclear
   - **Positives** — what worked across personas
   - **Recommended fixes** — concrete next changes tied to specific steps or materials

Do not silently fix the product during dogfooding unless the user explicitly asks for fixes after synthesis.

## Operating rules

- Pre-flight each environment before subagents start. Do not make subagents build a monorepo or set up Verdaccio unless the materials tell the reader to do that.
- On pnpm 10+, `better-sqlite3` build-script blocking is a genuine doc/product finding. If the goal is to test docs as-written, let subagents hit it and report it rather than pre-fixing with `pnpm approve-builds`.
- Disclose harness deviations (e.g. pre-provisioned `.npmrc`/registry) in synthesis, not as doc friction.
- When dogfooding doc changes from a plan in `~/.cursor/plans`, use the plan draft or edited files on disk — whichever matches what a reader would see.
- Point subagents at actual material files rather than summaries.
- Dogfooding is not a debugging session for the codebase.

## Reporting to the user

End with:

- Verification goal restated
- Per-persona outcome (running / blocked)
- Synthesized findings
- Prioritized fix list
