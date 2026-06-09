import { Form } from "react-router";

import type { Route } from "./+types/login";
import { getOptionalUserSession } from "~/features/auth/server/session.server";
import { beginSsoLogin } from "~/features/auth/server/auth-flow.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "登录 | Yakimoji" },
    {
      name: "description",
      content: "登录 Yakimoji，进入工作台继续处理任务。",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const current = await getOptionalUserSession(request);

  if (current) {
    return Response.redirect(new URL("/workspace", request.url));
  }

  return null;
}

export async function action() {
  return beginSsoLogin();
}

export default function LoginRoute() {
  return (
    <main className="app-shell auth-shell">
      <section className="shell-panel auth-card">
        <p className="eyebrow">欢迎使用</p>
        <h1>登录 Yakimoji</h1>
        <p className="lede">使用你的组织账号登录后，即可进入工作台继续处理任务。</p>
        <Form method="post">
          <button className="primary-action" type="submit">
            继续登录
          </button>
        </Form>
      </section>
    </main>
  );
}
