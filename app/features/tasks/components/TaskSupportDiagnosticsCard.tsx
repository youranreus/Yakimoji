import type { TaskDetailView } from "../server/task-query.server";
import { formatTaskDate } from "./task-formatters";

type TaskSupportDiagnosticsCardProps = {
  task: TaskDetailView;
};

export function TaskSupportDiagnosticsCard({
  task,
}: TaskSupportDiagnosticsCardProps) {
  const diagnostics = task.supportDiagnostics;

  if (!diagnostics) {
    return null;
  }

  return (
    <section className="task-detail-callout task-support-card" aria-labelledby="task-support-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">Support Diagnostic</p>
          <h3 id="task-support-title">支持时间线与诊断上下文</h3>
        </div>
        <p className="task-panel-copy">
          当前视图使用 support 权限读取 task ID `{diagnostics.lookupTaskId}` 的诊断信息。
        </p>
      </div>

      <dl className="task-callout-grid">
        <div>
          <dt>权限模式</dt>
          <dd>{diagnostics.accessLabel}</dd>
        </div>
        <div>
          <dt>origin task</dt>
          <dd>{diagnostics.originTaskId}</dd>
        </div>
        <div>
          <dt>当前 attempt</dt>
          <dd>第 {diagnostics.attemptNumber} 次</dd>
        </div>
        <div>
          <dt>预设决策</dt>
          <dd>{diagnostics.presetResolution}</dd>
        </div>
      </dl>

      <div className="task-ledger">
        {diagnostics.entries.map((entry) => (
          <article key={entry.id} className={`task-ledger-item task-ledger-item-${entry.kind}`}>
            <div className="task-ledger-topline">
              <h4>{entry.label}</h4>
              <span>{formatTaskDate(entry.occurredAt)}</span>
            </div>
            <p>{entry.detail}</p>
            <div className="feedback-meta">
              <span>kind: {entry.kind}</span>
              <span>request_id: {entry.requestId}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
