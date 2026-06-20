import type { TaskDetailView } from "../server/task-query.server";

type TaskSupportFailureCardProps = {
  task: TaskDetailView;
};

export function TaskSupportFailureCard({
  task,
}: TaskSupportFailureCardProps) {
  const failure = task.failureContext;

  if (!failure) {
    return null;
  }

  return (
    <section className="task-detail-callout task-failure-card" aria-labelledby="task-support-failure-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">失败 / 中断</p>
          <h3 id="task-support-failure-title">失败说明与恢复上下文</h3>
        </div>
        <p className="task-panel-copy">支持侧仅展示解释与诊断信息，不在此页直接执行恢复动作。</p>
      </div>

      <dl className="task-callout-grid">
        <div>
          <dt>失败阶段</dt>
          <dd>{failure.stage}</dd>
        </div>
        <div>
          <dt>失败说明</dt>
          <dd>{failure.message}</dd>
        </div>
        <div>
          <dt>原因分类</dt>
          <dd>{failure.supportCategory ?? failure.reasonCode ?? "未提供"}</dd>
        </div>
        <div>
          <dt>诊断标识</dt>
          <dd>{failure.diagnosticTraceId ?? "未提供"}</dd>
        </div>
        <div>
          <dt>推荐动作</dt>
          <dd>{failure.recommendedAction}</dd>
        </div>
        <div>
          <dt>是否可重试</dt>
          <dd>{failure.retryable ? "可由后续流程继续处理" : "当前不可重试"}</dd>
        </div>
      </dl>
    </section>
  );
}
