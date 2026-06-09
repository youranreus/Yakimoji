import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/icon.png", type: "image/png", sizes: "160x160" },
  { rel: "shortcut icon", href: "/icon.png", type: "image/png" },
  { rel: "apple-touch-icon", href: "/icon.png", sizes: "160x160" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "页面暂时不可用";
  let details = "请稍后重试。";
  let stack: string | undefined;
  let debugCause: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "页面不存在" : "页面暂时不可用";
    details =
      error.status === 404
        ? "你访问的页面不存在或链接已失效。"
        : (typeof error.data === "object" &&
            error.data &&
            "message" in error.data &&
            typeof error.data.message === "string"
            ? error.data.message
            : error.statusText || details);
    debugCause =
      import.meta.env.DEV &&
      typeof error.data === "object" &&
      error.data &&
      "detail" in error.data &&
      typeof error.data.detail === "object" &&
      error.data.detail &&
      "cause" in error.data.detail &&
      typeof error.data.detail.cause === "string"
        ? error.data.detail.cause
        : undefined;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="app-shell error-shell">
      <div className="shell-panel">
        <p className="eyebrow">页面异常</p>
        <h1>{message}</h1>
        <p>{details}</p>
        {debugCause ? <p>cause: {debugCause}</p> : null}
        {stack ? <pre>{stack}</pre> : null}
      </div>
    </main>
  );
}
