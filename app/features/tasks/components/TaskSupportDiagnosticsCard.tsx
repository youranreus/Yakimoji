import type { TaskDetailView } from "../server/task-query.server";
import { formatTaskDate } from "./task-formatters";

type TaskSupportDiagnosticsCardProps = {
  task: TaskDetailView;
};

function formatPresetResolution(status: string) {
  switch (status) {
    case "matched":
      return "命中已有预设";
    case "manual_reuse":
      return "复用已有预设";
    case "manual_create":
      return "已创建新预设";
    case "continue_without_preset":
      return "未保存预设";
    case "unresolved":
      return "仍待确认";
    default:
      return "未提供";
  }
}

function formatPresetReasonCategory(value: string | null) {
  if (!value) {
    return "未提供";
  }

  return value;
}

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
          <p className="eyebrow">处理记录</p>
          <h3 id="task-support-title">最近处理记录</h3>
        </div>
        <p className="task-panel-copy">这里汇总当前任务的关键处理节点，方便快速判断下一步。</p>
      </div>

      <dl className="task-callout-grid">
        <div>
          <dt>当前处理轮次</dt>
          <dd>{diagnostics.attemptNumber === 1 ? "首次处理" : `第 ${diagnostics.attemptNumber} 次处理`}</dd>
        </div>
        <div>
          <dt>当前任务 ID</dt>
          <dd>{diagnostics.currentTaskId}</dd>
        </div>
        <div>
          <dt>预设处理方式</dt>
          <dd>{formatPresetResolution(diagnostics.presetResolution)}</dd>
        </div>
        <div>
          <dt>未命中原因分类</dt>
          <dd>{formatPresetReasonCategory(diagnostics.presetReasonCategory)}</dd>
        </div>
        <div>
          <dt>源任务链路</dt>
          <dd>{diagnostics.originTaskId}</dd>
        </div>
        <div>
          <dt>未命中说明</dt>
          <dd>{diagnostics.presetReason}</dd>
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
          </article>
        ))}
      </div>
    </section>
  );
}
