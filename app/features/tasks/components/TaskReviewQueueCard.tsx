import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import type { TaskDetailView } from "../server/task-query.server";
import { buildReviewDraftState } from "./task-review-drafts";
import { getReviewDecisionHelperCopy } from "./task-formatters";

type TaskReviewQueueCardProps = {
  task: TaskDetailView;
};

export function TaskReviewQueueCard({ task }: TaskReviewQueueCardProps) {
  const fetcher = useFetcher<
    | {
        ok: true;
        mode: "review_submitted";
        requestId: string;
        taskId: string;
        resolvedCount: number;
      }
    | {
        ok: false;
        code: string;
        message: string;
        field?: string;
        request_id: string;
      }
  >();
  const reviewQueue = task.reviewQueue;
  const [drafts, setDrafts] = useState(() =>
    reviewQueue
      ? buildReviewDraftState(
          reviewQueue.items,
          reviewQueue.resolvedDecisions,
        )
      : {},
  );

  useEffect(() => {
    if (!reviewQueue) {
      return;
    }

    setDrafts((current) =>
      buildReviewDraftState(
        reviewQueue.items,
        reviewQueue.resolvedDecisions,
        current,
      ),
    );
  }, [reviewQueue]);

  if (!reviewQueue) {
    return null;
  }

  const updateDecision = (
    itemId: string,
    decision: "approve" | "needs_attention",
  ) => {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        decision,
        note: current[itemId]?.note ?? "",
      },
    }));
  };

  const updateNote = (itemId: string, note: string) => {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        decision: current[itemId]?.decision ?? "approve",
        note,
      },
    }));
  };

  return (
    <section className="task-detail-callout task-review-card" aria-labelledby="task-review-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">人工确认</p>
          <h3 id="task-review-title">低置信度人工确认</h3>
        </div>
        <div className="task-review-header-copy">
          <span className="status-pill status-pill-warning">待人工确认</span>
          <p className="task-panel-copy">
            当前剩余 {reviewQueue.pendingCount} 个片段待确认。确认完成后任务会继续进入后续处理链路。
          </p>
        </div>
      </div>

      <p className="task-callout-copy">{reviewQueue.summary}</p>

      {fetcher.data && fetcher.data.ok === false ? (
        <section className="inline-feedback inline-feedback-error" aria-live="polite">
          <p className="feedback-title">提交未成功</p>
          <h4>当前确认未提交成功</h4>
          <p>{fetcher.data.message}</p>
        </section>
      ) : null}

      {fetcher.data && fetcher.data.ok ? (
        <section className="inline-feedback inline-feedback-success" aria-live="polite">
          <p className="feedback-title">已提交确认</p>
          <h4>人工确认已提交</h4>
          <p>已提交 {fetcher.data.resolvedCount} 个片段的确认结果，详情正在刷新。</p>
        </section>
      ) : null}

      <fetcher.Form method="post" className="task-review-form">
        <input type="hidden" name="intent" value="submit_review" />
        <input type="hidden" name="taskId" value={task.id} />

        <div className="task-review-list">
          {reviewQueue.items.map((item, index) => (
            <article key={item.id} className="task-review-item">
              <input type="hidden" name="reviewItemId" value={item.id} />
              <input
                type="hidden"
                name={`reviewDecision:${item.id}`}
                value={drafts[item.id]?.decision ?? "approve"}
              />
              <div className="task-review-item-heading">
                <h4>片段 {index + 1}</h4>
                <span className="status-pill status-pill-warning">{item.confidenceLabel}</span>
              </div>
              <p className="task-review-snippet">“{item.snippet}”</p>
              <dl className="task-review-context">
                <div>
                  <dt>前文</dt>
                  <dd>{item.contextBefore || "无"}</dd>
                </div>
                <div>
                  <dt>后文</dt>
                  <dd>{item.contextAfter || "无"}</dd>
                </div>
                <div>
                  <dt>建议动作</dt>
                  <dd>{item.suggestedAction}</dd>
                </div>
              </dl>
              <div className="task-review-primary-actions" role="group" aria-label={`片段 ${index + 1} 处理决定`}>
                <button
                  className={`secondary-action task-review-choice ${drafts[item.id]?.decision === "approve" ? "task-review-choice-active" : ""}`}
                  type="button"
                  aria-pressed={drafts[item.id]?.decision === "approve"}
                  onClick={() => updateDecision(item.id, "approve")}
                  disabled={fetcher.state !== "idle"}
                >
                  确认继续
                </button>
                <button
                  className={`secondary-action task-review-choice ${drafts[item.id]?.decision === "needs_attention" ? "task-review-choice-active" : ""}`}
                  type="button"
                  aria-pressed={drafts[item.id]?.decision === "needs_attention"}
                  onClick={() => updateDecision(item.id, "needs_attention")}
                  disabled={fetcher.state !== "idle"}
                >
                  继续关注
                </button>
              </div>
              <p className="task-review-decision-copy">
                {getReviewDecisionHelperCopy(drafts[item.id]?.decision ?? "approve")}
              </p>
              <details className="task-review-note-disclosure" open={Boolean(drafts[item.id]?.note)}>
                <summary>补充说明（可选）</summary>
                <label className="field-label">
                  备注
                  <textarea
                    className="text-area"
                    name={`reviewNote:${item.id}`}
                    rows={3}
                    value={drafts[item.id]?.note ?? ""}
                    onChange={(event) => updateNote(item.id, event.currentTarget.value)}
                  />
                </label>
              </details>
            </article>
          ))}
        </div>

        <button className="primary-action" type="submit">
          {fetcher.state !== "idle" ? "正在提交确认..." : "提交人工确认并继续任务"}
        </button>
      </fetcher.Form>
    </section>
  );
}
