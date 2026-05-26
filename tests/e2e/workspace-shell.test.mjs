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

  assert.match(workspaceShell, /Protected Workspace/);
  assert.match(workspaceShell, /Global Navigation/);
  assert.match(workspaceShell, /Main Content/);
  assert.match(workspaceShell, /任务导入/);
  assert.match(workspaceShell, /request_id:/);
  assert.match(taskListPanel, /任务列表/);
  assert.match(taskListPanel, /aria-label="任务列表分页"/);
  assert.match(taskDetailPanel, /任务详情/);
  assert.match(taskDetailPanel, /状态账本/);
  assert.match(taskSyncBridge, /正在同步/);
  assert.match(taskSyncBridge, /已回退轮询/);
  assert.match(taskSyncBridge, /EventSource/);
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
