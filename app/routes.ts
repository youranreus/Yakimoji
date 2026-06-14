import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("logout", "routes/logout.tsx"),
  route("tasks", "routes/api.tasks.ts"),
  route("tasks/:taskId", "routes/api.tasks.$taskId.ts"),
  route("tasks/:taskId/result", "routes/api.tasks.$taskId.result.ts"),
  route(
    "tasks/:taskId/result/deliverables/:deliverableId/download",
    "routes/api.tasks.$taskId.result.deliverables.$deliverableId.download.ts",
  ),
  route("workspace", "routes/workspace.tsx"),
  route("workspace/tasks/:taskId", "routes/workspace.task-detail.tsx"),
  route("tasks/:taskId/audit", "routes/tasks.$taskId.audit.tsx"),
  route("workspace/deliverables/:deliverableId", "routes/workspace.deliverables.$deliverableId.tsx"),
  route("workspace/task-sync", "routes/workspace.task-sync.ts"),
  route("operations", "routes/operations.tsx"),
  route("health", "routes/health.tsx"),
] satisfies RouteConfig;
