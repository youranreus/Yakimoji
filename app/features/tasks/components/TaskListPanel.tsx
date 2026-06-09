import { Link, useLocation, useNavigation } from "react-router";

import type { PaginatedTaskList } from "../server/task-query.server";
import { formatTaskDate } from "./task-formatters";

type TaskListPanelProps = {
  taskList: PaginatedTaskList;
  selectedTaskId?: string | null;
};

function buildHref(pathname: string, page: number, taskId?: string) {
  const search = page > 1 ? `?page=${page}` : "";

  if (taskId) {
    return `/workspace/tasks/${taskId}${search}`;
  }

  return pathname.startsWith("/workspace/tasks/")
    ? `/workspace${search}`
    : `/workspace${search}`;
}

function getPendingMessage(
  currentPathname: string,
  pendingPathname: string,
  pendingSearch: string,
) {
  if (pendingPathname.startsWith("/workspace/tasks/")) {
    return "正在加载任务详情与阶段时间线...";
  }

  const nextPage = new URLSearchParams(pendingSearch).get("page");

  if (pendingPathname === currentPathname || pendingPathname === "/workspace") {
    return nextPage
      ? `正在加载任务列表第 ${nextPage} 页...`
      : "正在刷新任务列表...";
  }

  return null;
}

export function TaskListPanel({
  taskList,
  selectedTaskId = null,
}: TaskListPanelProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const pagination = taskList.meta.pagination;
  const pendingMessage = navigation.location
    ? getPendingMessage(
        location.pathname,
        navigation.location.pathname,
        navigation.location.search,
      )
    : null;

  return (
    <article className="shell-panel task-list-panel" aria-labelledby="task-list-title">
      <div className="task-panel-header">
        <div>
          <p className="eyebrow">Task List</p>
          <h2 id="task-list-title">任务列表</h2>
        </div>
        <p className="task-panel-copy">按页查看任务和最近进展。</p>
      </div>

      <p className="task-loading-copy" aria-live="polite">
        {pendingMessage ?? "可逐项查看任务并进入详情页。"}
      </p>

      {taskList.data.length === 0 ? (
        <section className="task-empty-state" aria-live="polite">
          <h3>还没有可浏览的任务</h3>
          <p>先在上方导入任务。创建成功后，这里会显示分页列表和最近关键进展。</p>
        </section>
      ) : (
        <div className="task-card-stack">
          {taskList.data.map((task) => (
            <Link
              key={task.id}
              className={`task-card-link ${selectedTaskId === task.id ? "task-card-link-active" : ""}`}
              to={buildHref(location.pathname, pagination.page, task.id)}
              aria-current={selectedTaskId === task.id ? "page" : undefined}
              aria-label={`查看任务 ${task.sourceTitle} 的状态详情`}
            >
              <div className="task-card-heading">
                <div>
                  <p className="task-card-title">{task.sourceTitle}</p>
                  <p className="task-card-subtitle">{task.sourceIdentifier}</p>
                </div>
                <span className={`status-pill status-pill-${task.statusTone}`}>
                  {task.statusLabel}
                </span>
              </div>
              <dl className="task-card-ledger">
                <div>
                  <dt>最近关键进展</dt>
                  <dd>{task.latestProgressLabel}</dd>
                </div>
                <div>
                  <dt>最近更新时间</dt>
                  <dd>{formatTaskDate(task.updatedAt)}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}

      <nav className="task-pagination" aria-label="任务列表分页">
        {pagination.hasPreviousPage ? (
          <Link
            className="secondary-action pagination-link"
            to={buildHref(location.pathname, pagination.page - 1)}
          >
            上一页
          </Link>
        ) : (
          <span className="pagination-link pagination-link-disabled">上一页</span>
        )}
        <span className="pagination-summary">
          第 {pagination.page} 页 / 共 {Math.max(pagination.totalPages, 1)} 页
        </span>
        {pagination.hasNextPage ? (
          <Link
            className="secondary-action pagination-link"
            to={buildHref(location.pathname, pagination.page + 1)}
          >
            下一页
          </Link>
        ) : (
          <span className="pagination-link pagination-link-disabled">下一页</span>
        )}
      </nav>
    </article>
  );
}
