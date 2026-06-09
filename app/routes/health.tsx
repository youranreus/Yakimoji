export async function loader() {
  return Response.json({
    status: "ok",
  });
}

export default function HealthRoute() {
  return (
    <main className="app-shell health-shell">
      <div className="shell-panel">
        <p className="eyebrow">服务状态</p>
        <h1>Yakimoji 运行正常</h1>
        <p>该页面仅用于确认服务可用性。</p>
      </div>
    </main>
  );
}
