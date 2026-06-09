export type ReviewDecisionValue = "approve" | "needs_attention";

type ReviewItemLike = {
  id: string;
};

type ReviewDecisionLike = {
  itemId: string;
  decision: ReviewDecisionValue;
  note: string | null;
};

export type ReviewDraftState = Record<
  string,
  {
    decision: ReviewDecisionValue;
    note: string;
  }
>;

export function buildReviewDraftState(
  items: ReviewItemLike[],
  resolvedDecisions: ReviewDecisionLike[],
  existingDrafts: ReviewDraftState = {},
): ReviewDraftState {
  const resolvedByItem = new Map(
    resolvedDecisions.map((decision) => [decision.itemId, decision]),
  );

  return Object.fromEntries(
    items.map((item) => {
      const existing = existingDrafts[item.id];

      if (existing) {
        return [item.id, existing];
      }

      const resolved = resolvedByItem.get(item.id);

      return [
        item.id,
        {
          decision: resolved?.decision ?? "approve",
          note: resolved?.note ?? "",
        },
      ];
    }),
  );
}
