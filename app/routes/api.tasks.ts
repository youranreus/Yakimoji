import { authenticateApiCredential } from "../features/api-credentials/server/api-credential-auth.server";
import { createApiTask } from "../features/tasks/server/api-task-create.server";

export async function action({ request }: { request: Request }) {
  const credential = await authenticateApiCredential(request);

  return createApiTask(request, credential);
}
