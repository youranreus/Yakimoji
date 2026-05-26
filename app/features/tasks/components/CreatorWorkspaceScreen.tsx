import { Form, useActionData } from "react-router";

import { WorkspaceShell } from "~/shared/ui/WorkspaceShell";

import type { TaskIntakeActionResult } from "../server/task-intake.server";
import type { WorkspaceViewModel } from "../server/workspace-view.server";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TaskListPanel } from "./TaskListPanel";

type CreatorWorkspaceScreenProps = {
  loaderData: WorkspaceViewModel;
};

export function CreatorWorkspaceScreen({
  loaderData,
}: CreatorWorkspaceScreenProps) {
  const actionData = useActionData<TaskIntakeActionResult>();

  return (
    <WorkspaceShell
      runtime={loaderData.runtime}
      serviceName={loaderData.serviceName}
      requestId={loaderData.requestId}
      user={loaderData.user}
      roles={loaderData.roles}
      navigation={loaderData.navigation}
      panels={loaderData.panels}
      actionData={actionData ?? null}
      taskListPanel={
        <TaskListPanel
          taskList={loaderData.taskList}
          selectedTaskId={loaderData.selectedTask?.id ?? null}
        />
      }
      taskDetailPanel={<TaskDetailPanel task={loaderData.selectedTask} />}
      logoutForm={
        <Form method="post" action="/logout">
          <button className="secondary-action" type="submit">
            退出登录
          </button>
        </Form>
      }
    />
  );
}
