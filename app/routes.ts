import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("auth/callback", "routes/auth.callback.tsx"),
  route("logout", "routes/logout.tsx"),
  route("workspace", "routes/workspace.tsx"),
  route("workspace/tasks/:taskId", "routes/workspace.task-detail.tsx"),
  route("workspace/deliverables/:deliverableId", "routes/workspace.deliverables.$deliverableId.tsx"),
  route("workspace/task-sync", "routes/workspace.task-sync.ts"),
  route("health", "routes/health.tsx"),
] satisfies RouteConfig;
