import type { TaskDetailView } from "../server/task-query.server";
import { formatTaskDate } from "./task-formatters";

type TaskStatusSummaryCardProps = {
  task: TaskDetailView;
};

export function TaskStatusSummaryCard({
  task,
}: TaskStatusSummaryCardProps) {
  return (
    <section className="task-summary-card" aria-labelledby="task-summary-title">
      <div className="task-summary-heading">
        <div>
          <p className="eyebrow">Task Summary</p>
          <h3 id="task-summary-title">{task.sourceTitle}</h3>
          <p className="task-card-subtitle">{task.sourceIdentifier}</p>
        </div>
        <span className={`status-pill status-pill-${task.statusTone}`}>
          {task.statusLabel}
        </span>
      </div>

      <dl className="task-summary-grid">
        <div>
          <dt>预设来源</dt>
          <dd>{task.presetContextLabel}</dd>
        </div>
        <div>
          <dt>预设说明</dt>
          <dd>{task.presetContextSummary}</dd>
        </div>
        <div>
          <dt>当前生效基线</dt>
          <dd>{task.baselineSummary}</dd>
        </div>
        <div>
          <dt>字幕模板来源</dt>
          <dd>{task.subtitleTemplateContextLabel}</dd>
        </div>
        <div>
          <dt>模板说明</dt>
          <dd>{task.subtitleTemplateContextSummary}</dd>
        </div>
        <div>
          <dt>当前阶段</dt>
          <dd>{task.currentStageLabel}</dd>
        </div>
        <div>
          <dt>最近关键进展</dt>
          <dd>{task.latestProgressLabel}</dd>
        </div>
        <div>
          <dt>接下来会发生什么</dt>
          <dd>{task.nextStepLabel}</dd>
        </div>
        <div>
          <dt>最近更新时间</dt>
          <dd>{formatTaskDate(task.updatedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
