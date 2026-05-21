import type { Route } from "./+types/home";
import { WorkspaceShell } from "~/shared/ui/WorkspaceShell";

const pendingDomains = [
  "Creator login and protected workspace shell",
  "Manual task intake and source recognition",
  "Preset management and matching",
  "Review queue and deliverable access",
];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Yakimoji Workspace" },
    {
      name: "description",
      content: "Minimal React Router workspace shell aligned to the approved node-postgres starter.",
    },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  return {
    runtime: context.releaseStage,
    serviceName: context.serviceName,
    pendingDomains,
    boundaries: [
      "Route-first application shell in React Router Framework Mode",
      "Node + Express server boundary reserved for session, SSO, secrets and signed-download logic",
      "PostgreSQL + Drizzle migration chain configured, but no business domain tables prebuilt",
    ],
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <WorkspaceShell {...loaderData} />;
}
