import { authenticateApiCredential } from "../features/api-credentials/server/api-credential-auth.server";
import { streamApiTaskDeliverable } from "../features/tasks/server/api-task-query.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { taskId?: string; deliverableId?: string };
}) {
  const credential = await authenticateApiCredential(request);

  if (!params.taskId || !params.deliverableId) {
    throw new Error("taskId and deliverableId are required");
  }

  return streamApiTaskDeliverable({
    credential,
    taskId: params.taskId,
    deliverableId: params.deliverableId,
  });
}
