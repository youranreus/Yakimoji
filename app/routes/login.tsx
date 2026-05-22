import { Form } from "react-router";

import type { Route } from "./+types/login";
import { getOptionalUserSession } from "~/features/auth/server/session.server";
import { beginSsoLogin } from "~/features/auth/server/auth-flow.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "登录 | Yakimoji" },
    {
      name: "description",
      content: "通过 Yakimoji SSO 登录并进入受保护的创作者工作台。",
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
        <p className="eyebrow">受保护入口</p>
        <h1>登录 Yakimoji 工作台</h1>
        <p className="lede">
          使用组织 SSO 完成身份认证。浏览器只会保存 Yakimoji 自己签发的
          HttpOnly session cookie，不会直接持有上游 access token。
        </p>
        <Form method="post">
          <button className="primary-action" type="submit">
            继续前往 SSO
          </button>
        </Form>
        <div className="auth-notes">
          <span>公开路由：/login</span>
          <span>健康检查：/health</span>
        </div>
      </section>
    </main>
  );
}
