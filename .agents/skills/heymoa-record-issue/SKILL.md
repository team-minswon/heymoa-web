---
name: heymoa-record-issue
description: |
  Use when encountering a recurring problem, a failed assumption, or a bug caused by an agent's lack of context.
  Records the issue and its solution so future agents (and humans) can avoid repeating the same mistake.
  Trigger on: "문제 기록해줘", "에러 정리해줘", encountering a tricky bug, or resolving an environment issue.
---

# HeyMoa Agent Issue Recording Skill

## When to Use
- You spent a long time debugging an issue and found a non-obvious solution.
- You encountered a breaking change (like Next.js 16 `middleware.ts` -> `proxy.ts`).
- An API mismatch occurred that required a specific workaround.
- The user explicitly asks you to "기록해둬" (record this).

## Workflow

### Step 1: Identify the root cause and solution
Ensure you clearly understand:
1. What the symptom was.
2. Why it happened (the root cause).
3. The definitive fix.

### Step 2: Append to AGENT_ISSUES.md
We maintain a running log of known issues in the project root: `AGENT_ISSUES.md`.
If the file doesn't exist, create it.

Append the issue using the following format:

```markdown
## [YYYY-MM-DD] {Brief Title}

- **Symptom**: {What went wrong}
- **Root Cause**: {Why it happened}
- **Fix/Workaround**: {How to solve it}
- **Agent Lesson**: {What future AI agents should do differently}
```

### Step 3: Evaluate if AGENTS.md needs updating
If this is a rule that *must* be followed on every future task (e.g., "Never use `faker` data for user endpoints"), you MUST also propose updating the `AGENTS.md` file to include this as a hard rule.

### Step 4: Notify the User
Provide a brief summary of what was recorded so the user knows the project's knowledge base has grown.
