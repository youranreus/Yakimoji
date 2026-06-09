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

      <section className="task-summary-section" aria-labelledby="task-summary-core-title">
        <h4 id="task-summary-core-title" className="task-summary-section-title">
          当前跟进重点
        </h4>
        <dl className="task-summary-grid">
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
            <dt>结果状态</dt>
            <dd>{task.resultStatus.label}</dd>
          </div>
          <div>
            <dt>最近更新时间</dt>
            <dd>{formatTaskDate(task.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="task-summary-section" aria-labelledby="task-summary-context-title">
        <h4 id="task-summary-context-title" className="task-summary-section-title">
          任务上下文
        </h4>
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
        </dl>
      </section>
    </section>
  );
}
