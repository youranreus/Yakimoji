export async function loader() {
  return Response.json({
    status: "ok",
    service: "yakimoji",
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    migrationDirectory: "drizzle",
  });
}

export default function HealthRoute() {
  return (
    <main className="app-shell health-shell">
      <div className="shell-panel">
        <p className="eyebrow">Health Route</p>
        <h1>Yakimoji starter baseline is wired.</h1>
        <p>
          This route stays intentionally small so later stories can add protected
          workspace concerns without rewriting the application entrypoint.
        </p>
      </div>
    </main>
  );
}
