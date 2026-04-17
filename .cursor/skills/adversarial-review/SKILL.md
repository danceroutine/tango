---
name: adversarial-review
description: Use this skill only when the user explicitly asks for an adversarial review. Run a disagreement-friendly proposal review by spawning two subagents to attack the plan, aggregating their concerns, surfacing the critique to the user, then iterating point-by-point until the user either changes the plan, accepts the pushback, or uses <disagree_and_commit> to force the user's decision.
---

# Adversarial Review

Use this skill only when the user explicitly requests an adversarial review. Do not trigger it for ordinary planning, code review, or brainstorming.

## Workflow

1. Announce `Executing adversarial-review.`
2. State to yourself that disagreement is useful and you are allowed to disagree when the plan is weak, incomplete, or likely to create future problems.
3. Before finalizing your own critique, spawn exactly two subagents if the tool is available.
    - If a CODEX/IDE plan exists, copy it verbatim into a temporary markdown file that the subagents can access.
    - Pass both the current proposal or plan to the subagents, and when a CODEX plan exists, include the temporary markdown file path in both prompts.
    - Instruct both subagents to critique the actual plan from that file rather than a paraphrase or summary.
    - Instruct both to review it in detail with an adversarial eye.
    - Instruct both to aggressively raise concerns about:
        - flaws in the design itself
        - hidden assumptions
        - operational risks
        - future knock-on effects
        - migration or maintenance burden
        - edge cases and failure modes
    - Instruct both subagents not to return feedback that purely tightens language, reframes emphasis, or polishes wording without identifying a substantive design, correctness, workflow, migration, or operational risk.
    - If wording contributes to a real problem, instruct both subagents to name the underlying substantive risk rather than recommending rhetorical cleanup by itself.
    - Tell each subagent that disagreement is desirable when warranted and that weak objections should be omitted.
    - Prefer independent framing for the two reviews so they do not collapse into the same critique.
4. Aggregate the two subagent reviews with your own judgment.
    - Deduplicate overlapping points.
    - Preserve meaningful disagreement.
    - Filter out comments that only propose tightening language, rebalancing tone, or changing emphasis without a concrete substantive risk.
    - Present the critique to the user in a structured list, ordered from highest-risk concern to lowest.
5. Stop and wait for the user's acknowledgement and any further detail.
    - Do not move into execution while the adversarial review loop is still active.
6. After the user responds, merge the user's feedback with the subagent feedback and address each point explicitly and individually.
    - For each point, either:
        - agree and modify the plan, or
        - disagree and explain why the original plan should stand.
    - Do not silently absorb or discard a concern.
7. After the adversarial review loop is complete and you no longer need the spawned subagents, close the old agent threads.
    - Close both adversarial review subagents after their output has been incorporated or explicitly set aside.
    - Remove any temporary markdown file that was created to share the CODEX plan once it is no longer needed.
8. The user may push back further. You are allowed to continue disagreeing if the objection remains unconvincing.
    - If the user sends `<disagree_and_commit>`, stop arguing, accept the user's decision as final, and proceed on that basis.
    - If the user changes their mind, update the plan accordingly.
9. This skill may be applied multiple times in series to stress-test a proposal before execution.

## Operating Rules

- Do not manufacture balance for its own sake. If the plan is strong, say so after serious scrutiny.
- Do not soften real concerns just to keep the discussion agreeable.
- Do not treat subagent output as authoritative. Use it as adversarial input, then apply your own judgment.
- When a CODEX plan exists, make the subagents review the temporary markdown copy of that plan so they critique the real plan text.
- Clean up adversarial review artifacts after use by closing the spawned agent threads and removing any temporary plan file.
- Keep critiques concrete. Prefer specific failure modes and tradeoffs over vague discomfort.
- Do not allow wording-only critique. Exclude feedback that merely tightens language, adjusts tone, or changes emphasis unless it is tied to a substantive flaw or risk in the plan.
- If a subagent tool is unavailable, perform the two-perspective adversarial pass yourself and say that you are doing the fallback locally.
- Unless the user explicitly asks for implementation during the same turn, keep this skill focused on stress-testing the proposal rather than executing it.
