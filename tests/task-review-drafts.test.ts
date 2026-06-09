import assert from "node:assert/strict";
import test from "node:test";

import { buildReviewDraftState } from "../app/features/tasks/components/task-review-drafts";

test("review draft state preserves user choices when the same review items re-render after an error", () => {
  const initial = buildReviewDraftState(
    [{ id: "item_1" }, { id: "item_2" }],
    [],
  );

  const withUserInput = {
    ...initial,
    item_1: {
      decision: "needs_attention",
      note: "需要后续继续关注。",
    },
  } as const;

  const refreshed = buildReviewDraftState(
    [{ id: "item_1" }, { id: "item_2" }],
    [],
    withUserInput,
  );

  assert.deepEqual(refreshed.item_1, withUserInput.item_1);
  assert.equal(refreshed.item_2?.decision, "approve");
});
