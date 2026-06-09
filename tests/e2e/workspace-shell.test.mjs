import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readText(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), "utf8");
}

test("workspace shell copy still exposes the protected workspace and task detail affordances", () => {
  const workspaceShell = readText("app/shared/ui/WorkspaceShell.tsx");
  const taskListPanel = readText("app/features/tasks/components/TaskListPanel.tsx");
  const taskDetailPanel = readText("app/features/tasks/components/TaskDetailPanel.tsx");
  const taskSyncBridge = readText("app/features/tasks/components/TaskSyncBridge.tsx");
  const appCss = readText("app/app.css");

  assert.match(workspaceShell, /创作者工作台/);
  assert.match(workspaceShell, /工作区导航/);
  assert.match(workspaceShell, /开始导入/);
  assert.match(workspaceShell, /任务导入/);
  assert.match(workspaceShell, /直接查看任务跟进/);
  assert.match(workspaceShell, /workspace-follow-through/);
  assert.match(workspaceShell, /workspace-panel-slot-detail/);
  assert.doesNotMatch(workspaceShell, /request_id:\s*\{/);
  assert.match(taskListPanel, /任务列表/);
  assert.match(taskListPanel, /进入详情/);
  assert.match(taskListPanel, /aria-label="任务列表分页"/);
  assert.match(taskDetailPanel, /任务详情/);
  assert.match(taskDetailPanel, /处理记录/);
  assert.match(taskSyncBridge, /自动刷新已开启/);
  assert.match(taskSyncBridge, /定时刷新/);
  assert.match(taskSyncBridge, /EventSource/);
  assert.match(appCss, /max-width: 767\.98px/);
  assert.match(appCss, /min-width: 768px\) and \(max-width: 1023\.98px/);
});

test("route manifest keeps the workspace list and direct detail routes registered", () => {
  const routes = readText("app/routes.ts");
  const taskSyncRoute = readText("app/routes/workspace.task-sync.ts");
  const taskSyncServer = readText("app/routes/workspace.task-sync.server.ts");
  const taskSyncShared = readText("app/features/tasks/task-sync.shared.ts");
  const taskSyncFeatureServer = readText("app/features/tasks/server/task-sync.server.ts");

  assert.match(routes, /route\("workspace", "routes\/workspace\.tsx"\)/);
  assert.match(routes, /route\("workspace\/tasks\/:taskId", "routes\/workspace\.task-detail\.tsx"\)/);
  assert.match(routes, /route\("workspace\/task-sync", "routes\/workspace\.task-sync\.ts"\)/);
  assert.match(taskSyncServer, /text\/event-stream/);
  assert.match(taskSyncServer, /transport === "polling"/);
  assert.match(taskSyncShared, /task\.status\.changed/);
  assert.match(taskSyncFeatureServer, /taskSyncEventName/);
});
