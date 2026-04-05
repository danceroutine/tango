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
    - Give both the current proposal or plan.
    - Instruct both to review it in detail with an adversarial eye.
    - Instruct both to aggressively raise concerns about:
        - flaws in the design itself
        - hidden assumptions
        - operational risks
        - future knock-on effects
        - migration or maintenance burden
        - edge cases and failure modes
    - Tell each subagent that disagreement is desirable when warranted and that weak objections should be omitted.
    - Prefer independent framing for the two reviews so they do not collapse into the same critique.
4. Aggregate the two subagent reviews with your own judgment.
    - Deduplicate overlapping points.
    - Preserve meaningful disagreement.
    - Present the critique to the user in a structured list, ordered from highest-risk concern to lowest.
5. Stop and wait for the user's acknowledgement and any further detail.
    - Do not move into execution while the adversarial review loop is still active.
6. After the user responds, merge the user's feedback with the subagent feedback and address each point explicitly and individually.
    - For each point, either:
        - agree and modify the plan, or
        - disagree and explain why the original plan should stand.
    - Do not silently absorb or discard a concern.
7. The user may push back further. You are allowed to continue disagreeing if the objection remains unconvincing.
    - If the user sends `<disagree_and_commit>`, stop arguing, accept the user's decision as final, and proceed on that basis.
    - If the user changes their mind, update the plan accordingly.
8. This skill may be applied multiple times in series to stress-test a proposal before execution.

## Operating Rules

- Do not manufacture balance for its own sake. If the plan is strong, say so after serious scrutiny.
- Do not soften real concerns just to keep the discussion agreeable.
- Do not treat subagent output as authoritative. Use it as adversarial input, then apply your own judgment.
- Keep critiques concrete. Prefer specific failure modes and tradeoffs over vague discomfort.
- If a subagent tool is unavailable, perform the two-perspective adversarial pass yourself and say that you are doing the fallback locally.
- Unless the user explicitly asks for implementation during the same turn, keep this skill focused on stress-testing the proposal rather than executing it.
