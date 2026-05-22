import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import { logoutCurrentSession } from "~/features/auth/server/session.server";

export async function action({ request }: Route.ActionArgs) {
  const setCookieHeader = await logoutCurrentSession(request);

  throw redirect("/login", {
    headers: {
      "Set-Cookie": setCookieHeader,
    },
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  return action({ request } as Route.ActionArgs);
}

export default function LogoutRoute() {
  return null;
}
