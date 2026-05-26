import { Link, useLocation, useNavigation } from "react-router";

import type { TaskDetailView } from "../server/task-query.server";
import { TaskDetailTimeline } from "./TaskDetailTimeline";
import { TaskStatusSummaryCard } from "./TaskStatusSummaryCard";

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
            ? "正在加载任务详情与状态账本..."
            : "详情页会展示当前阶段、最近进展和按时间排序的状态账本。"}
        </p>
      </div>

      {task ? (
        <div className="task-detail-stack">
          <Link className="secondary-action detail-back-link" to={backHref}>
            返回任务列表
          </Link>
          <TaskStatusSummaryCard task={task} />
          <TaskDetailTimeline task={task} />
        </div>
      ) : (
        <section className="task-empty-state" aria-live="polite">
          <h3>选择一个任务查看状态账本</h3>
          <p>
            任务详情支持直达、分享和刷新。你可以从左侧列表进入某个任务，查看当前阶段、关键进展和完整时间线。
          </p>
        </section>
      )}
    </article>
  );
}
