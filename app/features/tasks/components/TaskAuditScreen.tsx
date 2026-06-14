import { Link } from "react-router";

import type { TaskAuditRecordView } from "../server/task-audit.server";
import { formatTaskDate } from "./task-formatters";

type TaskAuditScreenProps = {
  loaderData: TaskAuditRecordView;
};

export function TaskAuditScreen({ loaderData }: TaskAuditScreenProps) {
  return (
    <main className="app-shell auth-shell">
      <section className="shell-panel task-audit-panel">
        <div className="task-panel-header">
          <div>
            <p className="eyebrow">Task Audit</p>
            <h1>最小审计记录</h1>
          </div>
          <p className="task-panel-copy">{loaderData.retentionNote}</p>
        </div>

        <div className="task-audit-stack">
          <section className="task-detail-callout" aria-labelledby="task-audit-summary-title">
            <div className="task-detail-section-heading">
              <div>
                <p className="eyebrow">任务摘要</p>
                <h2 id="task-audit-summary-title">{loaderData.summary.title}</h2>
              </div>
              <p className="task-panel-copy">{loaderData.summary.body}</p>
            </div>

            <dl className="task-callout-grid">
              <div>
                <dt>任务 ID</dt>
                <dd>{loaderData.taskId}</dd>
              </div>
              <div>
                <dt>来源标识</dt>
                <dd>{loaderData.sourceIdentifier}</dd>
              </div>
              <div>
                <dt>预设路径</dt>
                <dd>{loaderData.presetPathLabel}</dd>
              </div>
              <div>
                <dt>当前状态</dt>
                <dd>{loaderData.currentStatusLabel}</dd>
              </div>
              <div>
                <dt>attempt</dt>
                <dd>
                  {loaderData.attemptNumber} / {loaderData.originTaskId}
                  {loaderData.retryOfTaskId ? ` / retry of ${loaderData.retryOfTaskId}` : ""}
                </dd>
              </div>
              <div>
                <dt>request_id</dt>
                <dd>{loaderData.requestId ?? "暂无"}</dd>
              </div>
            </dl>
          </section>

          {loaderData.failureSummary ? (
            <section className="task-detail-callout" aria-labelledby="task-audit-failure-title">
              <div className="task-detail-section-heading">
                <div>
                  <p className="eyebrow">失败 / 中断</p>
                  <h2 id="task-audit-failure-title">失败与恢复摘要</h2>
                </div>
                <p className="task-panel-copy">用于快速定位排障阶段与恢复线索。</p>
              </div>
              <dl className="task-callout-grid">
                <div>
                  <dt>失败阶段</dt>
                  <dd>{loaderData.failureSummary.stage}</dd>
                </div>
                <div>
                  <dt>失败说明</dt>
                  <dd>{loaderData.failureSummary.message}</dd>
                </div>
                <div>
                  <dt>原因码</dt>
                  <dd>{loaderData.failureSummary.reasonCode ?? "暂无"}</dd>
                </div>
                <div>
                  <dt>可重试</dt>
                  <dd>{loaderData.failureSummary.retryable ? "是" : "否"}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {loaderData.reviewSummary || loaderData.manualSummary ? (
            <section className="task-detail-callout" aria-labelledby="task-audit-review-title">
              <div className="task-detail-section-heading">
                <div>
                  <p className="eyebrow">人工确认</p>
                  <h2 id="task-audit-review-title">review 与人工操作摘要</h2>
                </div>
                <p className="task-panel-copy">包含人工确认、介入和恢复相关动作。</p>
              </div>

              {loaderData.reviewSummary ? (
                <dl className="task-callout-grid">
                  <div>
                    <dt>review ID</dt>
                    <dd>{loaderData.reviewSummary.reviewId}</dd>
                  </div>
                  <div>
                    <dt>待确认</dt>
                    <dd>{loaderData.reviewSummary.pendingCount}</dd>
                  </div>
                  <div>
                    <dt>已确认</dt>
                    <dd>{loaderData.reviewSummary.confirmedCount}</dd>
                  </div>
                  <div>
                    <dt>确认时间</dt>
                    <dd>{loaderData.reviewSummary.completedAt ?? "暂无"}</dd>
                  </div>
                </dl>
              ) : null}

              {loaderData.manualSummary ? (
                <p className="task-callout-copy">
                  {loaderData.manualSummary.actionType} · {loaderData.manualSummary.actorLabel} ·{" "}
                  {formatTaskDate(loaderData.manualSummary.occurredAt)} · {loaderData.manualSummary.detail}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="task-detail-callout" aria-labelledby="task-audit-timeline-title">
            <div className="task-detail-section-heading">
              <div>
                <p className="eyebrow">生命周期</p>
                <h2 id="task-audit-timeline-title">关键时间线</h2>
              </div>
              <p className="task-panel-copy">按时间顺序查看任务发生过什么。</p>
            </div>

            <div className="task-ledger">
              {loaderData.timeline.map((item) => (
                <article key={item.id} className={`task-ledger-item task-ledger-item-${item.kind}`}>
                  <div className="task-ledger-topline">
                    <h3>{item.label}</h3>
                    <span>{formatTaskDate(item.occurredAt)}</span>
                  </div>
                  <p>{item.description}</p>
                  <div className="feedback-meta">
                    <span>{item.actorLabel}</span>
                    <span>{item.requestId}</span>
                    {item.beforeAfter ? <span>{item.beforeAfter}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="task-detail-callout" aria-labelledby="task-audit-access-title">
            <div className="task-detail-section-heading">
              <div>
                <p className="eyebrow">访问审计</p>
                <h2 id="task-audit-access-title">交付物与敏感访问记录</h2>
              </div>
              <p className="task-panel-copy">若没有访问记录，会明确显示为空态。</p>
            </div>

            {loaderData.accessLogs.length > 0 ? (
              <div className="task-audit-access-list">
                {loaderData.accessLogs.map((log) => (
                  <article key={log.id} className="task-ledger-item task-ledger-item-support">
                    <div className="task-ledger-topline">
                      <h3>{log.label}</h3>
                      <span>{formatTaskDate(log.occurredAt)}</span>
                    </div>
                    <p>{log.detail}</p>
                    <div className="feedback-meta">
                      <span>{log.actorLabel}</span>
                      <span>{log.resourceType}</span>
                      <span>{log.requestId}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="task-callout-copy">暂无该类记录。</p>
            )}
          </section>

          <p className="task-panel-copy">当前仅展示保留窗口内记录；如果历史不完整，这里会明确说明。</p>

          <Link className="secondary-action" to="/workspace">
            返回工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
