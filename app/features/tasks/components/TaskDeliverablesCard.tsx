import type { TaskDetailView } from "../server/task-query.server";
import {
  formatTaskDate,
  getDeliverableAvailabilityCopy,
} from "./task-formatters";

type TaskDeliverablesCardProps = {
  task: TaskDetailView;
};

function getActionLabel(kind: string, canDownload: boolean) {
  if (!canDownload) {
    return "暂不可下载";
  }

  return kind === "video" ? "下载视频" : "下载字幕";
}

export function TaskDeliverablesCard({ task }: TaskDeliverablesCardProps) {
  return (
    <section className="task-deliverables-card" aria-labelledby="task-deliverables-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">Deliverables</p>
          <h3 id="task-deliverables-title">交付结果</h3>
        </div>
        <div className={`status-pill status-pill-${task.resultStatus.tone}`}>
          {task.resultStatus.label}
        </div>
      </div>

      <p className="task-panel-copy">{task.resultStatus.description}</p>

      {task.deliverables.length === 0 ? (
        <section className="task-empty-state task-deliverables-empty" aria-live="polite">
          <h4>尚未生成可交付文件</h4>
          <p>任务完成后，成品视频和字幕文件会在这里出现，并附带保留期与下载入口。</p>
        </section>
      ) : (
        <div className="task-deliverables-list">
          {task.deliverables.map((deliverable) => (
            <article key={deliverable.id} className="task-deliverable-row">
              <div>
                <p className="task-deliverable-title">
                  {deliverable.kindLabel} · {deliverable.fileName}
                </p>
                <p className="task-deliverable-copy">
                  {getDeliverableAvailabilityCopy(deliverable.status)}
                </p>
                <dl className="task-deliverable-meta">
                  <div>
                    <dt>类型</dt>
                    <dd>{deliverable.kindLabel}</dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{deliverable.statusLabel}</dd>
                  </div>
                  <div>
                    <dt>大小</dt>
                    <dd>{deliverable.fileSizeLabel}</dd>
                  </div>
                  <div>
                    <dt>可用至</dt>
                    <dd>{formatTaskDate(deliverable.expiresAt)}</dd>
                  </div>
                </dl>
              </div>

              {deliverable.canDownload && deliverable.downloadAction ? (
                <a className="secondary-action deliverable-link" href={deliverable.downloadAction}>
                  {getActionLabel(deliverable.kind, deliverable.canDownload)}
                </a>
              ) : (
                <span className="deliverable-link deliverable-link-disabled">
                  {getActionLabel(deliverable.kind, deliverable.canDownload)}
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
