import type { Route } from "./+types/home";
import { getOptionalUserSession } from "~/features/auth/server/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const current = await getOptionalUserSession(request);

  return Response.redirect(new URL(current ? "/workspace" : "/login", request.url));
}

export default function Home(_: Route.ComponentProps) {
  return null;
}
