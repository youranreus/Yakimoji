import { Link, useLocation, useNavigation } from "react-router";

import type { TaskDetailView } from "../server/task-query.server";
import { TaskDeliverablesCard } from "./TaskDeliverablesCard";
import { TaskDetailTimeline } from "./TaskDetailTimeline";
import { TaskFailureCard } from "./TaskFailureCard";
import { TaskReviewQueueCard } from "./TaskReviewQueueCard";
import { TaskStatusSummaryCard } from "./TaskStatusSummaryCard";
import { TaskSupportDiagnosticsCard } from "./TaskSupportDiagnosticsCard";

type TaskDetailPanelProps = {
  task: TaskDetailView | null;
};

export function TaskDetailPanel({
  task,
}: TaskDetailPanelProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const pendingDetail =
    navigation.location?.pathname.startsWith("/workspace/tasks/") ??
    false;
  const backHref = location.search ? `/workspace${location.search}` : "/workspace";

  return (
    <article className="shell-panel task-detail-panel" aria-labelledby="task-detail-title">
      <div className="task-panel-header">
        <div>
          <p className="eyebrow">Task Detail</p>
          <h2 id="task-detail-title">任务详情</h2>
        </div>
        <p className="task-loading-copy" aria-live="polite">
          {pendingDetail
            ? "正在加载任务详情..."
            : "查看当前阶段、最近进展、结果状态和处理记录。"}
        </p>
      </div>

      {task ? (
        <div className="task-detail-stack">
          <Link className="secondary-action detail-back-link" to={backHref}>
            返回任务列表
          </Link>
          <TaskStatusSummaryCard task={task} />
          <TaskReviewQueueCard task={task} />
          <TaskFailureCard task={task} />
          <TaskSupportDiagnosticsCard task={task} />
          {task.accessMode === "creator" ? <TaskDeliverablesCard task={task} /> : null}
          <TaskDetailTimeline task={task} />
        </div>
      ) : (
        <section className="task-empty-state" aria-live="polite">
          <h3>选择一个任务查看详情</h3>
          <p>从左侧列表进入任务，查看进度、结果和处理记录。</p>
        </section>
      )}
    </article>
  );
}
