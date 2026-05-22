import type { Route } from "./+types/auth.callback";
import { handleSsoCallback } from "~/features/auth/server/auth-flow.server";

export async function loader({ request }: Route.LoaderArgs) {
  return handleSsoCallback(request);
}

export default function AuthCallbackRoute() {
  return null;
}
