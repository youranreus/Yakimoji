export async function loader({ request }: { request: Request }) {
  return Response.redirect(new URL("/favicon.svg", request.url), 302);
}

export default function FaviconRoute() {
  return null;
}
