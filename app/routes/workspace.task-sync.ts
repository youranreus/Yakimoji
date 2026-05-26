import { loadTaskSyncResponse } from "./workspace.task-sync.server";

import type { Route } from "./+types/workspace.task-sync";

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadTaskSyncResponse({
    request,
    context,
  });
}

export default function WorkspaceTaskSyncRoute() {
  return null;
}
