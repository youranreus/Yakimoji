import { Link, useFetcher } from "react-router";

import type { TaskDetailView } from "../server/task-query.server";

type TaskFailureCardProps = {
  task: TaskDetailView;
};

export function TaskFailureCard({ task }: TaskFailureCardProps) {
  const fetcher = useFetcher<
    | {
        ok: true;
        mode: "retry_created";
        requestId: string;
        sourceTaskId: string;
        task: {
          id: string;
          status: string;
          attemptNumber: number;
        };
      }
    | {
        ok: false;
        code: string;
        message: string;
        field?: string;
        request_id: string;
      }
  >();
  const failure = task.failureContext;

  if (!failure) {
    return null;
  }

  return (
    <section className="task-detail-callout task-failure-card" aria-labelledby="task-failure-title">
      <div className="task-detail-section-heading">
        <div>
          <p className="eyebrow">处理异常</p>
          <h3 id="task-failure-title">失败说明与恢复路径</h3>
        </div>
        <p className="task-panel-copy">
          当前任务在这一阶段中断，可按建议继续处理。
        </p>
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
          <dt>推荐动作</dt>
          <dd>{failure.recommendedAction}</dd>
        </div>
        <div>
          <dt>是否可重试</dt>
          <dd>{failure.retryable ? "可以重新发起处理" : "当前不可重试"}</dd>
        </div>
      </dl>

      {fetcher.data && fetcher.data.ok === false ? (
        <section className="inline-feedback inline-feedback-error" aria-live="polite">
          <p className="feedback-title">暂时无法重新发起</p>
          <h4>请稍后重试</h4>
          <p>{fetcher.data.message}</p>
        </section>
      ) : null}

      {fetcher.data && fetcher.data.ok ? (
        <section className="inline-feedback inline-feedback-success" aria-live="polite">
          <p className="feedback-title">已重新发起处理</p>
          <h4>新的处理任务已创建</h4>
          <p>已为当前问题创建新的处理任务，可继续跟进最新状态。</p>
          <Link className="secondary-action detail-link-inline" to={`/workspace/tasks/${fetcher.data.task.id}`}>
            查看新任务
          </Link>
        </section>
      ) : null}

      {failure.retryable ? (
        <fetcher.Form method="post" className="task-retry-form">
          <input type="hidden" name="intent" value="retry_task" />
          <input type="hidden" name="taskId" value={task.id} />
          <button className="primary-action" type="submit">
            {fetcher.state !== "idle" ? "正在发起处理..." : "重新发起处理"}
          </button>
        </fetcher.Form>
      ) : null}
    </section>
  );
}
