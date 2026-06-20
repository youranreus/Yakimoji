import { Link, useLocation, useNavigation } from "react-router";

import { formatTaskDate } from "../../tasks/components/task-formatters";
import type { OperationsDashboardViewModel } from "../server/operations-dashboard.server";

type OperationsDrilldownTableProps = {
  drilldown: OperationsDashboardViewModel["drilldown"];
};

function buildPageHref(currentPath: string, page: number) {
  const url = new URL(`http://localhost${currentPath}`);

  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }

  const search = url.searchParams.toString();

  return search ? `/operations?${search}` : "/operations";
}

export function OperationsDrilldownTable({
  drilldown,
}: OperationsDrilldownTableProps) {
  const location = useLocation();
  const navigation = useNavigation();
  const pagination = drilldown.taskList.meta.pagination;
  const pending =
    navigation.location?.pathname === "/operations"
      ? "正在刷新运营任务范围..."
      : null;

  return (
    <article className="shell-panel operations-drilldown-panel" aria-labelledby="operations-drilldown-title">
      <div className="task-panel-header">
        <div>
          <p className="eyebrow">Drill-down</p>
          <h2 id="operations-drilldown-title">相关任务列表</h2>
        </div>
        <div className="operations-drilldown-actions">
          <p className="task-panel-copy">{drilldown.activeLabel}</p>
          <a className="secondary-action operations-reset-link" href={drilldown.resetHref}>
            查看全部任务
          </a>
        </div>
      </div>

      <p className="task-loading-copy" aria-live="polite">
        {pending ?? drilldown.helperText}
      </p>

      {drilldown.taskList.data.length === 0 ? (
        <section className="task-empty-state">
          <h3>{drilldown.emptyTitle}</h3>
          <p>{drilldown.emptyBody}</p>
        </section>
      ) : (
        <div className="operations-table-wrapper">
          <table className="operations-task-table">
            <thead>
              <tr>
                <th scope="col">任务与来源</th>
                <th scope="col">预设结果</th>
                <th scope="col">当前状态</th>
                <th scope="col">创建时间</th>
                <th scope="col">关键阶段时间戳</th>
                <th scope="col">运营信号</th>
              </tr>
            </thead>
            <tbody>
              {drilldown.taskList.data.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div className="operations-task-cell">
                      <p className="operations-task-id">{task.id}</p>
                      <p className="operations-task-title">{task.sourceTitle}</p>
                      <p className="operations-task-subtitle">{task.sourceIdentifier}</p>
                    </div>
                  </td>
                  <td>{task.presetOutcomeLabel}</td>
                  <td>
                    <span className={`status-pill status-pill-${task.statusTone}`}>
                      {task.statusLabel}
                    </span>
                  </td>
                  <td>{formatTaskDate(task.createdAt)}</td>
                  <td>
                    <div className="operations-task-timestamps">
                      <p>进入处理：{task.enteredProcessingAt ? formatTaskDate(task.enteredProcessingAt) : "暂无"}</p>
                      <p>处理完成：{task.completedAt ? formatTaskDate(task.completedAt) : "暂无"}</p>
                    </div>
                  </td>
                  <td>{task.operationsSignal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="task-pagination" aria-label="运营任务分页">
        {pagination.hasPreviousPage ? (
          <Link
            className="secondary-action pagination-link"
            to={buildPageHref(location.pathname + location.search, pagination.page - 1)}
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
            to={buildPageHref(location.pathname + location.search, pagination.page + 1)}
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
