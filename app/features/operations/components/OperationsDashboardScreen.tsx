import { Form } from "react-router";

import type { OperationsDashboardViewModel } from "../server/operations-dashboard.server";
import { OperationsDrilldownTable } from "./OperationsDrilldownTable";
import { OperationsMetricCards } from "./OperationsMetricCards";

type OperationsDashboardScreenProps = {
  loaderData: OperationsDashboardViewModel;
};

export function OperationsDashboardScreen({
  loaderData,
}: OperationsDashboardScreenProps) {
  return (
    <main className="app-shell operations-shell">
      <section className="shell-panel shell-hero operations-hero">
        <div className="shell-hero-grid operations-hero-grid">
          <div>
            <p className="eyebrow">Operations View</p>
            <h1>{loaderData.summary.title}</h1>
            <p className="lede">{loaderData.summary.lede}</p>
            <p className="operations-scope-note">{loaderData.summary.scopeNote}</p>
            <nav className="operations-nav" aria-label="运营导航">
              {loaderData.navigation.map((item) => (
                <a
                  key={item.href}
                  className={`operations-nav-link ${item.state === "active" ? "operations-nav-link-active" : ""}`}
                  href={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
          <aside className="operations-hero-meta">
            <dl className="operations-meta-list">
              <div>
                <dt>当前账号</dt>
                <dd>{loaderData.user.displayName}</dd>
              </div>
              <div>
                <dt>角色范围</dt>
                <dd>{loaderData.roles.join(" / ")}</dd>
              </div>
              <div>
                <dt>请求追踪</dt>
                <dd>{loaderData.requestId}</dd>
              </div>
            </dl>
            <Form method="post" action="/logout">
              <button className="secondary-action" type="submit">
                退出登录
              </button>
            </Form>
          </aside>
        </div>
      </section>

      <OperationsMetricCards metricCards={loaderData.metricCards} />

      <section className="shell-grid operations-lower-grid">
        <article className="shell-panel operations-miss-panel" aria-labelledby="operations-miss-title">
          <div className="task-panel-header">
            <div>
              <p className="eyebrow">Preset Outcomes</p>
              <h2 id="operations-miss-title">预设结果分布</h2>
            </div>
            <p className="task-panel-copy">
              保留各条预设路径的数量与定义，帮助运营判断是自动命中、资产复用，还是仍需继续补沉淀。
            </p>
          </div>

          {loaderData.pathBreakdown.length === 0 ? (
            <p className="operations-empty-copy">暂无足够数据，当前没有可用于判断预设结果的任务样本。</p>
          ) : (
            <div className="operations-source-list">
              {loaderData.pathBreakdown.map((item) => (
                <a
                  key={item.path}
                  className="operations-source-row"
                  href={item.drilldownHref}
                >
                  <div>
                    <p className="operations-source-title">{item.label}</p>
                    <p className="operations-source-subtitle">{item.supportingText}</p>
                  </div>
                  <dl className="operations-source-meta">
                    <div>
                      <dt>任务数</dt>
                      <dd>{item.count}</dd>
                    </div>
                  </dl>
                </a>
              ))}
            </div>
          )}
        </article>

        <OperationsDrilldownTable drilldown={loaderData.drilldown} />
      </section>
    </main>
  );
}
