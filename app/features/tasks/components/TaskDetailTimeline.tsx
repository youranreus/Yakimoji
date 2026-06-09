import type { TaskDetailView } from "../server/task-query.server";
import { formatTaskDate } from "./task-formatters";

type TaskDetailTimelineProps = {
  task: TaskDetailView;
};

export function TaskDetailTimeline({
  task,
}: TaskDetailTimelineProps) {
  return (
    <section className="task-timeline-panel" aria-labelledby="task-timeline-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">Stage Timeline</p>
          <h3 id="task-timeline-title">流程阶段时间线</h3>
        </div>
        <p className="task-panel-copy">按时间查看任务进展与最近变化。</p>
      </div>

      <ol className="task-stage-track">
        {task.stages.map((stage) => (
          <li key={stage.id} className={`task-stage-item task-stage-item-${stage.state}`}>
            <div className="task-stage-marker" aria-hidden="true" />
            <div>
              <p className="task-stage-label">{stage.label}</p>
              <p className="task-stage-description">{stage.description}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="task-ledger">
        {task.events.map((event) => (
          <article
            key={event.id}
            className={`task-ledger-item task-ledger-item-${event.stageState}`}
          >
            <div className="task-ledger-topline">
              <h4>{event.label}</h4>
              <span>{formatTaskDate(event.occurredAt)}</span>
            </div>
            <p>{event.description}</p>
            <div className="feedback-meta">
              <span>状态: {event.statusLabel}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
