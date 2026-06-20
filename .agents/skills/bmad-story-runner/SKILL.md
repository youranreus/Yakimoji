---
name: bmad-story-runner
description: "Run one or more BMAD story identifiers through a strict sequential delivery loop: create story, develop it, run code review, fix review findings, sync sprint-status, and create one Chinese Conventional Commit per story. Use when the user asks to run a BMAD story end-to-end, batch multiple BMAD stories in order, or wants a non-parallel BMAD workflow that fully finishes each story before starting the next."
---

# BMAD Story Runner

Treat this skill as a strict single-lane orchestrator for BMAD stories. Finish the entire lifecycle for the current story before touching the next one.

## Inputs

- Accept one or more story identifiers such as `1.1`, `1-1`, or a concrete story file path.
- Preserve the user-provided order. Never reorder, merge, or parallelize stories.
- Normalize each input before execution:
  - `story_id`: dotted form such as `1.1`
  - `story_key`: dashed key such as `1-1-user-auth` when discoverable
- If the identifier is ambiguous, resolve it from `_bmad-output/implementation-artifacts/sprint-status.yaml` or the implementation artifact story files before asking.

## Hard Rules

- Run stories strictly one by one. Story N+1 cannot start until story N is fully complete.
- Use these BMAD skills in this order for each story:
  1. `bmad-create-story`
  2. `bmad-dev-story`
  3. `bmad-code-review`
  4. fix all actionable review findings
  5. verify or reconcile `sprint-status`
  6. create one git commit for that story
- Do not use `bmad-story-automator` unless the user explicitly asks for that workflow. This skill is the manual sequential runner.
- Do not leave review findings for the user unless blocked by a real external dependency or genuine spec ambiguity.
- Do not combine multiple stories into one commit.
- Do not commit unrelated existing changes. If the worktree is already dirty, isolate only files that belong to the current story. If safe isolation is impossible, stop and ask.
- Use Chinese Conventional Commits derived from the actual outcome.
- Never use placeholder commit text such as `story1.1`, `story-1-1`, `完成story`, `update`, or similar low-signal messages.

## Per-Story Workflow

### 1. Baseline

- Inspect `git status` before starting the story.
- Record the pre-existing dirty files so they do not leak into the current story commit.
- Resolve the exact story target from the user input.

### 2. Create Story

- Run `bmad-create-story` for the current story identifier.
- Ensure a usable story file exists and contains enough context for development.
- If the story file already exists and is ready for implementation, reuse it instead of recreating it blindly.

### 3. Develop Story

- Run `bmad-dev-story` on the current story.
- Continue until the story implementation is complete according to that skill's own checklist.
- Let the dev workflow update the story file sections it owns.

### 4. Review And Fix Loop

- Run `bmad-code-review` on the current story's changes.
- If review reports actionable findings, fix them immediately in the same story scope.
- Re-run `bmad-code-review` after fixes.
- Repeat until review is clean enough to finish and there are no unresolved actionable findings.
- If the review workflow offers a menu or asks whether to fix issues, choose the path that fixes all actionable issues without handing routine decisions back to the user.
- Do not move to the next story while the current story still has unresolved review items.

### 5. Sprint Status

- Verify `_bmad-output/implementation-artifacts/sprint-status.yaml` matches the real story state.
- Prefer the normal BMAD path: `bmad-create-story`, `bmad-dev-story`, and `bmad-code-review` should perform the status transitions.
- Expected completed end state: the story is `done`.
- If the implementation and review are actually complete but `sprint-status` is still stale, first re-run the workflow that should update it.
- Only manually edit `sprint-status.yaml` when the workflow is clearly complete and the file is provably out of sync with the story file or review result.
- Never leave the story in `review` when the review issues are already fixed and accepted.

### 6. Commit

- Review the diff for current-story files only.
- Stage only the files that belong to the current story.
- Create exactly one commit for the current story.
- Use a Chinese Conventional Commit message derived from the real change.

Good examples:

- `feat: 完成工作区任务列表筛选与分页`
- `fix: 修复任务详情页状态同步异常`
- `refactor: 拆分会话服务并统一错误处理`

Bad examples:

- `feat: story1.1`
- `fix: 完成story`
- `chore: update`

### 7. Move To Next Story

Before starting the next story, verify the current story has:

- a completed or explicitly blocked story file state
- resolved review follow-ups
- synchronized `sprint-status`
- one dedicated commit
- no later-story changes mixed into the commit

## Completion Contract

When reporting progress, always state:

- current index and total, for example `[1/3] 1.1`
- current phase: `create`, `dev`, `review`, `fix`, `sprint-status`, or `commit`
- blockers immediately when they appear
- the final commit message used for each completed story
