import { authenticateApiCredential } from "../features/api-credentials/server/api-credential-auth.server";
import { loadApiTaskResult } from "../features/tasks/server/api-task-query.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { taskId?: string };
}) {
  const credential = await authenticateApiCredential(request);

  if (!params.taskId) {
    throw new Error("taskId is required");
  }

  return loadApiTaskResult(credential, params.taskId);
}
