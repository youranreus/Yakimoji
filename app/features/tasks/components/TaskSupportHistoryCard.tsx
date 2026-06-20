import type { TaskDetailView } from "../server/task-query.server";
import { formatTaskDate } from "./task-formatters";

type TaskSupportHistoryCardProps = {
  task: TaskDetailView;
};

export function TaskSupportHistoryCard({ task }: TaskSupportHistoryCardProps) {
  const diagnostics = task.supportDiagnostics;

  if (!diagnostics) {
    return null;
  }

  return (
    <section className="task-detail-callout task-support-card" aria-labelledby="task-support-history-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">Support History</p>
          <h3 id="task-support-history-title">人工确认与人工介入记录</h3>
        </div>
        <p className="task-panel-copy">
          按 task ID 结构化展示支持排障需要关注的人工作业记录。
        </p>
      </div>

      <dl className="task-callout-grid">
        <div>
          <dt>当前任务 ID</dt>
          <dd>{diagnostics.currentTaskId}</dd>
        </div>
        <div>
          <dt>源任务链路</dt>
          <dd>{diagnostics.originTaskId}</dd>
        </div>
        <div>
          <dt>当前处理轮次</dt>
          <dd>{diagnostics.attemptNumber === 1 ? "首次处理" : `第 ${diagnostics.attemptNumber} 次处理`}</dd>
        </div>
        <div>
          <dt>保留窗口</dt>
          <dd>{diagnostics.retentionWindowLabel}</dd>
        </div>
      </dl>

      {diagnostics.partialHistory ? (
        <p className="task-callout-copy">
          当前任务创建时间早于保留窗口，以下仅展示窗口内仍可查询到的人工记录。
        </p>
      ) : null}

      {diagnostics.manualHistory.length > 0 ? (
        <div className="task-ledger">
          {diagnostics.manualHistory.map((entry) => (
            <article key={entry.id} className="task-ledger-item task-ledger-item-review">
              <div className="task-ledger-topline">
                <h4>{entry.label}</h4>
                <span>{formatTaskDate(entry.occurredAt)}</span>
              </div>
              <p>{entry.detail}</p>
              <div className="feedback-meta">
                <span>{entry.taskContext}</span>
                <span>{entry.actorLabel}</span>
                <span>{entry.requestId}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="task-callout-copy">当前任务暂无可展示的人工确认或人工介入记录。</p>
      )}
    </section>
  );
}
