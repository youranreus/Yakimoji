import { Link } from "react-router";

import type { TaskDetailView } from "../server/task-query.server";
import { TaskDetailTimeline } from "./TaskDetailTimeline";
import { TaskSupportFailureCard } from "./TaskSupportFailureCard";
import { TaskSupportHistoryCard } from "./TaskSupportHistoryCard";
import { TaskStatusSummaryCard } from "./TaskStatusSummaryCard";
import { TaskSupportDiagnosticsCard } from "./TaskSupportDiagnosticsCard";

type TaskSupportDiagnosticScreenProps = {
  task: TaskDetailView;
};

export function TaskSupportDiagnosticScreen({
  task,
}: TaskSupportDiagnosticScreenProps) {
  return (
    <main className="app-shell auth-shell">
      <section className="shell-panel task-audit-panel">
        <div className="task-panel-header">
          <div>
            <p className="eyebrow">Support Diagnostic</p>
            <h1>支持诊断时间线</h1>
          </div>
          <p className="task-panel-copy">
            该视图仅用于支持侧解释任务未命中、失败、中断与恢复链路，不暴露创作者交付语义。
          </p>
        </div>

        <div className="task-audit-stack">
          <TaskStatusSummaryCard task={task} />
          <TaskSupportDiagnosticsCard task={task} />
          <TaskSupportHistoryCard task={task} />
          <TaskSupportFailureCard task={task} />
          <TaskDetailTimeline task={task} />

          <Link className="secondary-action" to="/workspace">
            返回工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
