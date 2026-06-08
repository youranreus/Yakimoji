import { useFetcher } from "react-router";

import type { TaskDetailView } from "../server/task-query.server";

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

  if (!reviewQueue) {
    return null;
  }

  return (
    <section className="task-detail-callout task-review-card" aria-labelledby="task-review-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">Review Queue</p>
          <h3 id="task-review-title">低置信度人工确认</h3>
        </div>
        <p className="task-panel-copy">
          当前剩余 {reviewQueue.pendingCount} 个片段待确认。确认完成后任务会继续进入后续处理链路。
        </p>
      </div>

      <p className="task-callout-copy">{reviewQueue.summary}</p>

      {fetcher.data && fetcher.data.ok === false ? (
        <section className="inline-feedback inline-feedback-error" aria-live="polite">
          <p className="feedback-title">Review Error</p>
          <h4>当前确认未提交成功</h4>
          <p>{fetcher.data.message}</p>
          <div className="feedback-meta">
            <span>code: {fetcher.data.code}</span>
            <span>request_id: {fetcher.data.request_id}</span>
          </div>
        </section>
      ) : null}

      {fetcher.data && fetcher.data.ok ? (
        <section className="inline-feedback inline-feedback-success" aria-live="polite">
          <p className="feedback-title">Review Saved</p>
          <h4>人工确认已提交</h4>
          <p>已提交 {fetcher.data.resolvedCount} 个片段的确认结果，详情正在刷新。</p>
          <div className="feedback-meta">
            <span>task_id: {fetcher.data.taskId}</span>
            <span>request_id: {fetcher.data.requestId}</span>
          </div>
        </section>
      ) : null}

      <fetcher.Form method="post" className="task-review-form">
        <input type="hidden" name="intent" value="submit_review" />
        <input type="hidden" name="taskId" value={task.id} />

        <div className="task-review-list">
          {reviewQueue.items.map((item, index) => (
            <article key={item.id} className="task-review-item">
              <input type="hidden" name="reviewItemId" value={item.id} />
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
              <label className="field-label">
                处理决定
                <select className="text-input" name={`reviewDecision:${item.id}`} defaultValue="approve">
                  <option value="approve">确认当前片段可以继续</option>
                  <option value="needs_attention">标记为需要继续关注</option>
                </select>
              </label>
              <label className="field-label">
                备注
                <textarea className="text-area" name={`reviewNote:${item.id}`} rows={3} />
              </label>
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
