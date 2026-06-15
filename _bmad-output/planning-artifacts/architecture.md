---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/product-brief-Yakimoji.md"
  - "_bmad-output/planning-artifacts/product-brief-Yakimoji-distillate.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-05-18-164513.md"
  - "DESIGN.md"
  - "_bmad-output/planning-artifacts/prd-validation-report.md"
workflowType: "architecture"
lastStep: 8
status: "complete"
completedAt: "2026-05-20"
project_name: "Yakimoji"
user_name: "季悠然"
date: "2026-05-19"
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
Yakimoji 当前的功能范围已经覆盖了完整的一阶段闭环，而不是单一的任务提交工具。功能需求可归纳为 7 个架构层面的能力簇：任务入口与创建、频道预设管理、任务配置与处理、异常与人工介入、交付物访问、外部 API、运营/支持可见性。

从架构角度看，最核心的业务主线是：用户通过 YouTube 链接、视频上传或外部 API 创建任务，系统识别来源频道，尝试命中频道预设，允许极少量任务级覆盖，然后驱动完整的视频处理流水线，最终向用户和 API 暴露任务状态与交付结果。围绕这条主线，系统还必须支持未命中预设时的轻量决策、低置信度片段人工确认、任务失败恢复信息、成品视频与字幕文件交付，以及最小运营/支持审计视图。

PRD 中 `FR1-FR50` 大致可分为以下类别：
- 任务入口与创建：`FR1-FR8`
- 频道预设管理：`FR9-FR16`
- 任务配置与处理：`FR17-FR23`
- 异常与人工介入：`FR24-FR33`
- 交付物访问：`FR34-FR39`
- 外部 API：`FR40-FR44`
- 运营与审计可见性：`FR45-FR50`

这意味着系统不是单纯前台产品，而是至少包含用户工作台、任务处理编排、预设资产管理、支持/运营视图、API 集成表面和结果分发机制等多个相互耦合的能力面。

**Non-Functional Requirements:**
非功能需求对架构的约束非常强，且已经具备明确验收口径，不是泛泛而谈的“性能要好”。其中最重要的约束有五类。

第一类是性能与交互响应。工作台首屏要满足 `NFR1` 的 95 分位 2 秒可交互，高频操作要满足 `NFR2` 的 95 分位 300ms 可感知响应，长列表需要在 `10,000` 条历史任务规模下依然满足首屏和分页体验要求。这会直接影响前端渲染策略、分页模式、读取接口设计和状态聚合方式。

第二类是状态同步与可靠性。`NFR4-NFR7` 要求失败状态、交付结果、前后端状态同步和审计保留都有明确时限与一致性标准。这说明“任务状态”不是 UI 文案，而是系统的一级领域对象，后续必须被严格建模、持久化和对外暴露。

第三类是安全与访问控制。`NFR8-NFR12` 明确要求认证、授权、结果文件访问、短时效链接或身份校验、发布前安全验收记录。这意味着交付物分发、API 认证和任务级别授权边界必须在架构早期就定清楚，不能后补。

第四类是 API 一致性与版本兼容。`NFR13-NFR15` 要求状态语义、错误结构和结果 envelope 保持统一并具备合约稳定性。这会约束内部状态机、外部 DTO 设计和版本演进策略。

第五类是 UX 驱动的系统要求。UX spec 明确要求桌面优先、移动端轻跟进、自动化链路透明、失败解释清楚、异常路径正式化，这些要求会倒逼任务流程可观测性、阶段化事件模型和解释层数据结构。

**Scale & Complexity:**
从业务域本身看，Yakimoji 属于单产品、单工作台、非强监管、greenfield 的中等复杂度项目；但从实现形态看，它明显高于普通中小型后台应用，因为它同时包含异步媒体处理工作流、规则命中系统、任务状态同步、交付物访问控制和对外 API。

- Primary domain: 全栈 Web 工作流平台，核心包含任务工作台、异步媒体处理编排与外部 API
- Complexity level: medium-high
- Estimated architectural components: 8-10 个核心组件域

按目前需求推断，至少会出现以下核心架构组件域：
- 身份认证与授权
- 任务入口与任务管理
- 频道预设管理
- 来源识别与预设命中
- 任务编排与状态机
- 人工介入与异常恢复
- 交付物存储与分发
- 外部 API 层
- 审计、支持与运营可见性
- 前端工作台与实时状态同步

### Technical Constraints & Dependencies

当前文档已经给出了一组很清晰的技术与产品约束，这些约束会显著收窄可接受的架构空间。

首先，产品被明确限定为以登录后工作台为核心的 SPA，桌面端是主战场，移动端只承接轻量查看、确认和下载。这意味着前端不需要为 SEO 型页面架构妥协，但需要为高频状态刷新、分页、大量任务历史和多状态详情页做优化。

其次，实时能力被建议优先采用 SSE，并以轮询兜底。这个约束虽然不是最终技术决策，但已经说明状态同步模式更偏向“单向事件广播的任务系统”，而不是协同编辑类双向实时系统。

再次，产品核心范围已明确排除自动订阅编排、重型逐句编辑器、复杂模板商店和高级视觉检测。这意味着架构第一阶段应围绕“稳定跑通主路径”设计，不应为了未来扩展提前引入过重的可编排性或可配置性。

最后，API 不再是附属接口，而是一等能力面。外部系统必须能够创建任务、查询状态、获取结果，并在异常时获得结构化反馈。这会要求内部领域模型和外部接口模型从一开始就保持强映射关系。

### Cross-Cutting Concerns Identified

有几类横切关注点会同时影响多个组件，后续做架构决策时需要被优先处理。

**任务状态一致性：**
任务从创建到交付会经历识别、命中、处理中、等待人工、失败、完成等多个阶段，且这些阶段需要同时服务于前端展示、API 响应、审计记录和支持排障。状态模型必须统一，不能由不同模块各自拼接。

**可观测性与解释能力：**
Yakimoji 的 UX 明确要求用户知道系统“正在做什么、失败在哪一步、应该如何恢复”。这意味着日志、事件、时间线、失败分类和恢复建议不是附属数据，而是核心产品能力。

**授权与交付物访问控制：**
任务结果、字幕文件和成品视频都属于高价值受保护资源。任务级授权、支持角色可见范围、外链时效控制和结果下载审计会贯穿用户层、API 层和存储分发层。

**预设命中与人工介入边界：**
预设命中失败、陌生频道决策、低置信度确认是产品定义中的正式分支，不是异常补丁。它们会横跨任务入口、规则系统、状态机、前端交互和审计记录。

**前后端契约稳定性：**
外部 API、前端工作台和后台编排都依赖统一的任务、状态、错误和结果 envelope。若内部领域建模不稳定，前后端和 API 会一起被拖垮。

**性能与历史数据增长：**
任务列表、详情页、状态账本和运营视图都依赖历史任务积累。即便第一阶段用户量不大，也必须提前以分页、摘要聚合和按需加载思路设计，否则后续很快退化为迟缓后台。

## Starter Template Evaluation

### Primary Technology Domain

Yakimoji 的主要技术域应定义为 `full-stack web application`，而不是单纯的前端 SPA 或纯 API 项目。原因很直接：它既需要一个高频交互的登录后工作台，也需要正式对外的 API、可靠的任务状态同步、受保护的交付物访问、以及围绕长任务处理构建的后台能力。

从产品约束看，这个项目更接近“工作流系统”而不是“内容站点”。因此，starter 的评价标准不应优先看 SEO、SSR 花样或营销页能力，而应优先看以下几件事：

- 是否适合登录后工作台
- 是否适合清晰承载 API / BFF
- 是否便于接入 SSE、鉴权、任务状态模型和文件交付
- 是否能在后续引入独立 worker / job orchestration 时不显得别扭
- 是否对 `pnpm`、TypeScript、Docker 化部署友好

### Technical Preferences Discovered

当前仓库没有发现显式的项目级技术偏好文件，因此这一步主要依据现有产物中的硬信号建立临时偏好基线。

**已发现的偏好/约束：**
- 包管理器已固定为 `pnpm@10.33.0`
- 产品主形态是登录后工作台
- PRD 明确建议 `SSE` 优先，轮询兜底
- 产品本体 `SEO` 不是第一阶段约束
- 目标浏览器是现代浏览器
- 需要正式外部 API
- 需要严格的认证、授权和交付物访问控制
- 需要最小审计与支持/运营可见性
- 未来很可能需要比单次 HTTP 请求更长寿命的处理链路

**据此推导的临时技术偏好：**
- TypeScript 优先
- React 生态优先
- Node 20+ 运行时
- Docker 友好优先
- PostgreSQL 作为默认关系型数据库优先
- 前后端契约清晰优先于“魔法很多的一体化体验”

### Starter Options Considered

#### Option A: React Router `node-postgres` template

**当前官方起步方式：**
- `npx create-react-router@latest my-react-router-app`
- `npx create-react-router@latest --template remix-run/react-router-templates/node-postgres`

**它默认替我们做的决定：**
- React Router Framework Mode
- Node + Postgres + Drizzle + Docker 友好的官方模板路径
- 单仓 full-stack 起步
- 更偏应用框架，而不是页面渲染框架

**为什么它适合 Yakimoji 第一阶段：**
- 对登录后工作台、任务列表/详情、预设管理、人工介入页和结果下载都比较顺手
- 比 Next.js 更少“页面框架思维”的负担
- 足够正式，不像纯 demo starter
- 允许我们把注意力优先放在 `频道预设复用`、状态语义、人工介入和交付物访问这些 MVP 核心问题上
- 对第一阶段来说，工程摩擦和长期可演进性之间的平衡最好

**最大风险：**
- 很容易因为“现在这样也能跑”而把它误用成长期终局
- 如果后续任务编排、worker、对象存储、支持后台和外部 API 持续变重，server layer 可能逐渐膨胀成“大应用后端”
- 因此它适合被视为“认真做 MVP 的底座”，但要带着未来可拆分的意识使用

#### Option B: Custom Split Foundation (`Vite React TS` + `NestJS`)

**当前官方起步方式：**
- 前端：`pnpm create vite`，选择 `react-ts`
- 后端：`nest new <project-name> --strict --package-manager pnpm`

**它默认替我们做的决定：**
- 前后端职责显式拆分
- 前端保持轻量 SPA / dashboard 思维
- 后端从 Day 1 就按模块化服务架构组织
- 更适合后续接 worker、队列、对象存储、SSE 和受保护文件分发

**为什么它是长期最稳骨架：**
- 最符合 Yakimoji 的真实复杂度
- 任务状态机、鉴权边界、交付物访问控制、外部 API 契约、审计可见性都更容易从一开始建清楚
- 不容易把“页面应用顺便带点 API”误当成“工作流系统骨架”
- 从长期架构正确性和后续少后悔的角度，它是最稳的

**最大风险：**
- 第一阶段工程摩擦最大
- 很容易过早进入“系统设计模式”，把注意力拉到 monorepo、DTO、共享类型、BFF、边界拆分等问题上
- 对 MVP 来说，存在把范围做重、把验证速度拖慢的风险

#### Option C: Next.js `create-next-app`

**当前官方起步方式：**
- `pnpm create next-app`
- `pnpm create next-app --api`

**它默认替我们做的决定：**
- React + Next.js App Router
- TypeScript 默认开启
- Route Handlers / BFF 风格的一体化开发体验
- 围绕页面路由与 Next conventions 展开

**它的价值：**
- 成熟、维护强、生态大、团队熟悉度通常更高
- 很容易快速做出“看起来完整”的产品壳子
- 如果团队对 Next 极熟，前期上手速度可能最快

**为什么它不是这次的首选：**
- Yakimoji 不是 SEO 驱动型产品，核心复杂度不在 SSR / RSC / 页面渲染策略
- 它容易让团队把注意力放到框架语义上，而不是任务流、状态语义和人工介入设计上
- 更大的风险是边界错觉：前期什么都能塞进去，后期才发现后台职责已经在 Next 里堆得过重

**最大风险：**
- 壳子推进很快，但真正难的任务状态一致性、异常解释、人工介入、交付物权限可能被延后
- 后续要么继续硬塞在 Next 里，要么被迫二次拆后端

### Selected Starter: React Router `node-postgres` template

**Rationale for Selection:**
综合 party mode 的结论后，这一步把推荐分成两层：

- `第一阶段推荐`：`React Router node-postgres template`
- `长期最稳骨架`：`Vite React TS + NestJS`

之所以第一阶段选择 React Router `node-postgres` template，而不是直接选择 `Vite + NestJS`，不是因为后者不对，而是因为 Yakimoji 当前最需要回答的是产品验证问题，而不是一次性把长期系统边界全部做满。

React Router 这条路最像“认真做 MVP”的底座：它足够正式，能承载工作台、基础 API、状态展示和结果访问，又不会像分离式前后端那样在第一天就把大量非业务工程决策拉到台前。对 Yakimoji 来说，这更有利于优先验证 `频道预设复用`、预设命中失败时的体验接受度、任务透明度和人工介入边界是否成立。

同时，文档应明确记录：`Vite React TS + NestJS` 仍然是长期最稳、最不容易后悔的架构骨架。如果后续第一阶段指标成立、任务编排和后台职责持续加重，它应被视为最合理的升级方向。

**Initialization Command:**

```bash
npx create-react-router@latest --template remix-run/react-router-templates/node-postgres
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript 优先
- Node 运行时
- PostgreSQL 作为默认关系型数据库基础

**Styling Solution:**
- 不把视觉系统强绑定在过重的 UI meta-framework 上
- 允许后续按 Yakimoji 的设计语言自定义前端样式层

**Build Tooling:**
- 官方 React Router framework toolchain
- Docker 友好的 Node + Postgres 模板路径
- 更适合作为工作台型应用的单仓起点

**Testing Framework:**
- Starter 只提供基础骨架
- 任务状态机、权限、API 合约、交付物访问控制、人工介入流等测试策略仍需在架构后续步骤中明确补齐

**Code Organization:**
- 前台工作台与服务端能力先共享单仓基础
- 但应从一开始约束 server-side 代码边界，避免后续膨胀成不可拆的大应用后端
- 应把未来拆分 worker / 重后台能力视为允许演进路径

**Development Experience:**
- 对第一阶段实现最友好
- 对登录后工作台、任务列表/详情、结果下载、基础 API 都较顺手
- 在工程摩擦、产品验证速度和后续可演进性之间取得了当前最好的平衡

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- 认证体系采用自有 SSO 接入，而不是托管认证或本地密码体系
- 应用授权采用本地 RBAC，而不是直接复用 SSO 上游角色
- 数据建模围绕“任务主表 + 任务事件表 + 预设表 + 交付物表 + SSO 用户映射表”展开
- Web 会话与外部 API credential 分离

**Important Decisions (Shape Architecture):**
- SSO 适配器放在服务端实现，前端不直接持有上游访问令牌
- 状态审计与安全审计进入统一事件/日志模型
- 第一阶段不把 Redis 作为强依赖，先保证无缓存也能成立

**Deferred Decisions (Post-MVP):**
- 是否拆独立 worker / queue service
- 是否引入跨服务事件总线
- 是否支持多身份源或多组织 SSO

### Data Architecture

**Database:**
- 使用 `PostgreSQL`
- 沿 starter 默认继续采用 `Drizzle ORM + Drizzle Kit migrations`

**Core modeling approach:**
- `users`：Yakimoji 本地用户主表
- `sso_accounts`：映射上游 SSO 身份，保存 `provider_user_id / email / nickname / raw_role`
- `user_role_assignments`：Yakimoji 本地 RBAC 角色映射
- `tasks`：任务主表
- `task_events`：任务状态流转与人工介入事件
- `channel_presets`：频道预设
- `deliverables`：成品视频、字幕文件及其访问元数据
- `api_credentials`：外部 API 凭证
- `audit_logs`：安全与运营审计日志

**Validation & migrations:**
- 输入/输出校验采用应用层 schema 校验
- 数据库变更统一通过版本化 migration 管理
- 不采用手工漂移式 schema 修改

**Caching strategy:**
- 第一阶段不把 Redis 作为必须依赖
- 优先设计成“没有分布式缓存也能正确工作”
- 后续若 SSE 扇出、任务列表热点或权限查询压力上升，再补缓存层

### Authentication & Security

#### ADR: SSO Identity Boundary and Local Authorization Model

**Decision:**
Yakimoji 接入自有 SSO 作为唯一身份来源，但不直接以 SSO 返回的角色作为应用内最终授权结果。  
最终采用的边界是：

- `SSO 负责身份认证`
- `Yakimoji 负责本地会话`
- `Yakimoji 负责应用授权`
- `外部 API 使用独立凭证体系`

**Status:**
Accepted for MVP architecture

**Context:**
当前提供的 `SSO.json` 描述了一套自定义 OAuth 风格的 SSO 接口，包括：

- `POST /oauth/authorize`
- `POST /oauth/token`
- `GET /oauth/user`

通过该接口，Yakimoji 可以获得：
- 上游身份
- bearer access token
- 用户基础资料
- 上游粗粒度角色字段 `role=0/1`
  - `0`: 普通用户
  - `1`: 管理员

Yakimoji 第一阶段同时要求：
- 登录后工作台访问控制
- 支持/运营最小可见性
- 成品视频与字幕文件的受保护访问
- 人工介入与审计记录
- 外部 API 与 Web 会话分离
- 后续可扩展到更复杂的任务权限与支持权限

这意味着仅靠上游 `role=0/1` 无法表达 Yakimoji 应用内部真正需要的权限模型。

**Options Considered:**

**Option A: 直接信任 SSO role 作为 Yakimoji 最终授权**
- 优点：
  - 实现最简单
  - 不需要维护本地角色映射
- 缺点：
  - 上游角色粒度过粗，只能区分普通用户/管理员
  - 无法表达 `creator / support / ops / admin` 等应用内职责差异
  - 后续权限扩展会被 SSO 字段设计反向约束
- Decision:
  - Rejected

**Option B: SSO 负责身份，本地维护 RBAC**
- 优点：
  - 身份来源统一，避免自建密码体系
  - 授权边界留在 Yakimoji 内部，适配产品实际需求
  - 可以先兼容当前上游 `role=0/1`，未来再扩展更细粒度映射
  - 更利于任务、交付物、支持视图、API 权限做独立控制
- 缺点：
  - 需要维护本地用户、角色和权限映射
  - 登录链路比“纯托管认证”多一层适配器
- Decision:
  - Accepted

**Option C: SSO 只做一次性登录，Yakimoji 完全独立维护身份与授权**
- 优点：
  - 应用自治性最强
  - 不受上游角色模型影响
- 缺点：
  - 会弱化 SSO 的统一身份价值
  - 用户同步、账户合并、退出语义更复杂
- Decision:
  - Rejected for MVP

**Why Option B Was Selected:**
Yakimoji 当前最合适的边界是“身份统一、授权本地化”。  
因为第一阶段真正复杂的不是“用户是谁”，而是“这个人能看哪些任务、能下载哪些交付物、能不能作为 support 查看失败详情、能不能以 ops 身份看运营视图、能不能以 admin 身份做系统级操作”。

SSO 已经足够解决“用户是谁”的问题，但它现在提供的 `role=0/1` 还不足以承担这些应用内授权语义。  
因此，最合理的做法是保留 SSO 作为唯一身份入口，同时把应用权限决策留在 Yakimoji 自己手里。

#### Session Strategy

**Decision:**
Web 登录成功后，由 Yakimoji 自己签发 `HttpOnly + Secure` session cookie。  
浏览器不直接持有上游 SSO access token。

**Rationale:**
- 避免把 SSO token 暴露到前端运行环境
- 让 Yakimoji 自己掌握 session 生命周期和撤销语义
- 便于后续统一接入审计、登出、权限变化即时失效等机制

**Implications:**
- 需要服务端实现 `SSO adapter`
- 需要本地 session store 或等价 session persistence 方案
- 需要定义 session 与本地用户/角色快照的关系

#### Local RBAC Model

**Decision:**
Yakimoji 本地采用 RBAC，MVP 至少保留以下角色层：

- `creator`
- `support`
- `ops`
- `admin`

**Recommended mapping principle:**
- SSO `role=0` 默认只代表“可登录的普通身份”
- SSO `role=1` 默认只代表“具备更高信任级别的上游管理员身份”
- 两者都不能直接等价替换为 Yakimoji 内部角色
- Yakimoji 内部角色分配由本地 `user_role_assignments` 控制

**Reasoning:**
SSO 角色回答的是“这个人在统一身份系统里大概是什么人”，  
Yakimoji 角色回答的是“这个人在 Yakimoji 里能做什么”。  
这两个问题不能混为一谈。

#### External API Security Boundary

**Decision:**
外部 API 不复用 Web SSO session，也不直接复用浏览器登录态。  
外部 API 采用独立 `api_credentials` 体系。

**Rationale:**
- API 调用主体和浏览器登录主体不同
- 便于做单独的失效、轮换、审计和最小权限控制
- 避免把浏览器认证模型强行扩展到服务间调用

#### Asset Protection Model

**Decision:**
交付物访问统一走受控下载或短时效签名 URL。  
禁止匿名长期公开 URL。

**Rationale:**
- 交付物是高价值受保护资源
- 授权应基于“用户/角色/任务归属/操作上下文”判断，而不是“拿到链接就能永久访问”
- 需要支持下载审计与越权拒绝记录

#### Security Risks and Mitigations

**Risk 1: 误把 SSO role 当成应用角色**
- Mitigation:
  - 明确本地 RBAC 为唯一授权真源
  - SSO role 仅作映射输入或辅助信号

**Risk 2: 前端持有上游 access token**
- Mitigation:
  - token exchange 和 `/oauth/user` 调用全部在服务端完成
  - 浏览器只持有 Yakimoji session cookie

**Risk 3: 角色变更后本地 session 仍保留旧权限**
- Mitigation:
  - session 中不固化长期权限结论
  - 对高敏感操作实时查本地角色映射
  - 后续可加入 session version / forced re-auth 机制

**Risk 4: support / ops 越权访问交付物或任务细节**
- Mitigation:
  - 资源访问统一走显式授权检查
  - 审计所有下载、查看失败详情、查看人工介入记录等动作

**Risk 5: 当前 SSO 协议细节与标准 OIDC 不完全一致**
- Mitigation:
  - 不把通用 OIDC 黑盒中间件当作默认依赖
  - 显式实现 `SSO adapter`，把 authorize/token/user 三步封装在应用边界内

#### Data Model Implications

为支持该决策，数据层至少应包含：

- `users`
- `sso_accounts`
- `user_role_assignments`
- `sessions`
- `api_credentials`
- `audit_logs`

其中：
- `sso_accounts` 保存上游身份映射与必要元数据
- `user_role_assignments` 保存 Yakimoji 本地授权事实
- `sessions` 保存本地会话状态
- `audit_logs` 记录认证、安全和越权相关事件

#### MVP Boundary

MVP 阶段明确采用以下约束：

- 不做多身份源聚合
- 不做复杂组织层级授权
- 不依赖 refresh token 高级能力
- 不把 SSO 角色体系扩展当作 MVP 前提
- 先以“SSO 身份 + 本地 RBAC + 本地 session + 独立 API credential”完成闭环

#### Future Upgrade Path

若后续需要增强，可演进到：

- SSO group / department / org 信息同步
- 更细粒度的资源级授权
- 支持角色模板和自动映射规则
- session 失效联动与权限变更推送
- 多身份源支持

### API & Communication Patterns

#### API Design Pattern

**Decision:**
Yakimoji 采用 `REST` 作为统一 API 设计风格，不引入 GraphQL 作为第一阶段主接口形态。

**Rationale:**
- 任务、预设、交付物、人工介入、审计等资源边界天然适合 REST
- 外部 API 需要清晰稳定、易于文档化和合约测试
- 当前项目复杂度在工作流与状态一致性，而不在前端自由查询能力
- REST 更利于与 OpenAPI 规范、受控下载、SSE 事件流和支持排障工具链对齐

**Implications:**
- Web 工作台与外部 API 共用统一资源语义
- 浏览器侧与外部 API 的差异主要体现在认证方式，而不是资源建模方式
- 不为前端 convenience 引入额外查询语言层

#### Resource Boundary Model

**Decision:**
第一阶段 API 以以下核心资源为中心组织：

- `sessions`
- `users`
- `channel-presets`
- `tasks`
- `task-events`
- `task-reviews` 或等价人工介入资源
- `deliverables`
- `api-credentials`

**Rationale:**
Yakimoji 的关键复杂度来自任务生命周期和交付物访问，不应把动作全部折叠成“胖 RPC 接口”。  
核心动作应尽量通过资源 + 显式 action endpoint 表达，例如：

- 创建任务
- 查询任务详情
- 获取任务事件流
- 提交人工确认
- 请求交付物下载
- 管理 API credential

#### Error Handling Standard

**Decision:**
Yakimoji 内部 API 采用统一错误 envelope，不直接沿用上游 SSO 的 `code/msg/data` 语义作为内部标准。  
推荐统一结构：

```json
{
  "request_id": "req_123",
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found.",
    "details": {}
  }
}
```

成功响应则采用资源导向结构，例如：

```json
{
  "data": { ... },
  "meta": { ... }
}
```

**Rationale:**
- 上游 SSO 是外部依赖，适配即可，不应反向约束 Yakimoji 内部 API 语义
- 统一错误码更利于前端状态处理、支持排障、外部 API 合约和审计关联
- `request_id` 是连接日志、SSE 事件、用户报错和审计线索的关键字段

**Boundary with SSO:**
- `SSO adapter` 负责把上游 `code/msg/data` 转换为 Yakimoji 内部标准
- 上游错误不直接穿透到产品 API 合约层

#### Task Status Model

**Decision:**
Yakimoji 对外暴露一套统一任务状态模型，Web 工作台和外部 API 使用同一套状态枚举，不允许各自定义不同命名。

**Recommended high-level states:**
- `created`
- `resolving_source`
- `matching_preset`
- `awaiting_preset_decision`
- `queued`
- `processing`
- `awaiting_human_review`
- `failed`
- `completed`
- `cancelled`

**Rationale:**
- PRD 已要求状态语义对前端与外部 API 保持一致
- 支持/运营视图、审计记录、SSE 推送和外部 API 都依赖同一状态真源
- 细粒度阶段可进入 `task_events`，不必全部抬升为顶层状态

**Implementation note:**
- 顶层状态用于产品语义与筛选
- 细粒度进展通过 `task_events` 提供
- 避免把内部实现细节直接暴露成公开状态爆炸

#### SSE Event Contract

**Decision:**
SSE 只用于“服务端到客户端”的单向任务事件推送，不扩展为双向实时协议。  
SSE 推送内容围绕任务状态变化与关键事件展开。

**Recommended event families:**
- `task.status_changed`
- `task.progress_updated`
- `task.review_required`
- `task.review_resolved`
- `task.failed`
- `task.completed`
- `deliverable.ready`

**Rationale:**
- 产品需求是状态可见性，不是协同编辑
- SSE 与当前工作流特征高度匹配，实现成本也低于 WebSocket
- 轮询兜底仍保留，避免把核心体验压在单一通道可用性上

**Contract guidance:**
每条事件至少包含：
- `event_id`
- `event_type`
- `task_id`
- `occurred_at`
- `status`（如适用）
- `payload`

#### Human Review Communication Model

**Decision:**
人工介入采用显式 review 资源或 action endpoint，不通过模糊状态字段临时拼接。

**Examples:**
- `POST /tasks/:id/review-decisions`
- `GET /tasks/:id/review-items`

**Rationale:**
- “低置信度确认”是正式产品路径，不是异常 hack
- 显式 review 资源更利于前端 UI、审计记录、支持解释与未来扩展

#### External API Boundary

**Decision:**
外部 API 与 Web 工作台共享核心资源模型，但明确隔离认证与访问上下文。

**External API MVP scope:**
- 创建任务
- 查询任务状态
- 查询任务结果
- 获取失败/未命中预设的结构化结果
- 请求结果访问方式

**Rationale:**
- 符合 PRD 已定义的 MVP 边界
- 避免过早把内部运营/支持能力暴露给第三方
- 保持“外部 API 是处理节点接口，不是后台镜像接口”

#### API Documentation Strategy

**Decision:**
Yakimoji API 文档以 `OpenAPI` 为主，并采用当前官方最新稳定规范版本。  
根据 OpenAPI 官方规范站点，最新主规范为 `OpenAPI 3.2.0`。

**Rationale:**
- 与当前 `SSO.json` 的 OpenAPI 风格保持一致
- 更利于生成文档、做合约测试、支持 SDK 或 mock
- 适合清晰描述 REST 资源、错误模型、认证方式与 SSE 辅助约定

**Documentation note:**
- Web 内部私有接口与外部公开 API 可分成不同 spec 或不同 tag 分组
- SSE 事件模型需在文档中补充事件 payload 约定

#### Rate Limiting and Abuse Control

**Decision:**
第一阶段对外部 API 启用基础限流；Web session 接口启用基础反滥用保护，但不上来做复杂配额系统。

**Recommended shape:**
- 外部 API：基于 credential 的速率限制
- 登录/回调/下载等敏感接口：独立保护策略
- 大文件下载与交付物访问：结合短时效链接与访问审计

**Rationale:**
- 外部 API 是正式能力面，必须具备基本防滥用能力
- 第一阶段重点是稳定和可审计，不是做复杂计费/配额平台
- 与交付物保护模型天然配套

#### Decision Impact Analysis

**Implementation Sequence:**
1. 先定义统一任务状态枚举与 `task_events` 模型
2. 再定义 REST 资源边界与错误 envelope
3. 同步定义 SSE 事件 contract
4. 最后再扩展外部 API 与 OpenAPI 文档

**Cross-Component Dependencies:**
- 状态模型会影响前端工作台、SSE、支持视图和外部 API
- 错误 envelope 会影响前端错误处理、支持排障和日志追踪
- review 资源建模会影响人工介入 UI、审计记录和任务恢复流
- OpenAPI 结构会影响后续 SDK、mock 和合约测试策略

### Infrastructure & Deployment

#### Hosting Strategy

**Decision:**
Yakimoji 第一阶段采用“单仓单应用部署 + 明确预留后台任务进程边界”的部署策略，而不是一开始拆分微服务。

**Rationale:**
- 第一阶段重点是验证产品闭环，而不是追求服务数量
- 当前复杂度主要来自任务生命周期与受保护交付物，不必用微服务数量来表达架构成熟度
- 但长任务处理、媒体处理和交付链天然具备未来拆分为独立 worker 的趋势，因此必须预留进程边界

**Implications:**
- 第一期不以微服务为目标
- 代码和部署上允许后续把 worker 单独拉起
- 不把“现在单体部署”误当成“永远同进程执行所有任务”

#### Runtime Topology

**Decision:**
MVP 推荐的运行拓扑包含以下组件：

- `web-app`
- `postgres`
- `object-storage`
- `background-worker`（可先与主应用共代码库，部署时允许独立进程）

**Component responsibilities:**

**web-app**
- 登录后工作台
- REST API
- SSO adapter
- session 管理
- SSE 推送
- 受控下载入口或签名 URL 发放入口

**postgres**
- 业务主数据
- 任务状态
- 事件流
- 本地授权映射
- API credential
- 审计日志

**object-storage**
- 成品视频
- 字幕文件
- 中间交付物或可保留的产出文件
- 下载受控访问对象

**background-worker**
- 异步任务编排
- 长任务执行
- 处理状态推进
- 交付物完成事件回写

#### Background Processing Boundary

**Decision:**
第一阶段架构上明确存在 `background-worker` 边界，即使最初实现可以共仓、甚至在较轻场景下共部署，也不把长任务逻辑设计成只能依附于 Web 请求生命周期运行。

**Rationale:**
- Yakimoji 的核心流程天然包含长任务
- 任务链中的媒体处理、结果生成、人工介入恢复都不适合被建模为普通同步请求
- 如果不先保留 worker 边界，后续从“请求内执行”迁移出去时会非常痛

**Recommended MVP posture:**
- 允许同仓
- 允许先用简单任务调度方式
- 但任务执行入口、状态推进、结果回写、失败处理必须与 Web 请求层解耦

**Explicit non-goals for MVP:**
- 不要求第一阶段就上复杂消息总线
- 不要求第一阶段就拆成多服务集群
- 不要求第一阶段就引入强依赖 Redis 队列系统

#### Object Storage and File Delivery

**Decision:**
大文件与交付物统一进入 `S3-compatible object storage`，数据库只保存元数据与访问控制信息。  
不采用本地磁盘作为长期交付物主存储。

**Rationale:**
- 成品视频和字幕文件天然适合对象存储
- 对象存储更适合受控下载、生命周期管理和后续扩展
- 本地磁盘在部署迁移、横向扩容、回收与备份上都会更别扭

**Delivery model:**
- 交付物元数据写入 `deliverables`
- 文件本体写入对象存储
- 下载通过以下两种方式之一受控提供：
  - 受控下载代理
  - 短时效 presigned URL

**Security note:**
- 不发长期公开 URL
- 签名链接必须短时效
- 下载动作必须与审计日志挂钩

#### Environment and Secret Management

**Decision:**
至少区分三套环境：

- `local`
- `staging`
- `production`

所有高敏感配置通过环境变量或 secret manager 注入，不进入前端构建产物，不写死在仓库中。

**High-sensitivity secrets include:**
- SSO `client_secret`
- 数据库连接串
- 对象存储访问密钥
- session signing secret
- 外部 API credential signing / hashing secret

**Rationale:**
- 当前系统已经具备正式认证、下载控制和外部 API 能力
- secret 泄漏的代价远高于普通内容站
- SSO 和对象存储都要求后端安全持有凭证

#### Observability

**Decision:**
第一阶段采用结构化日志 + 最小可用 tracing/correlation 方案，并以 OpenTelemetry 作为观测标准方向。

**Baseline guidance:**
- 结构化日志必须包含：
  - `request_id`
  - `task_id`（如适用）
  - `user_id`（如适用）
  - `api_credential_id`（如适用）
  - `event_type`
- 最低限度要能串起：
  - 登录链路
  - 任务创建链路
  - 任务执行链路
  - 下载链路
  - 人工介入链路

**Rationale:**
- Yakimoji 的支持/排障价值高度依赖可解释性
- 没有贯穿 ID 和结构化日志，支持视图与审计设计会失去落点
- OpenTelemetry 更适合作为后续 tracing/log correlation 的标准化方向

#### CI/CD Strategy

**Decision:**
第一阶段 CI/CD 保持克制，但必须覆盖架构正确性最敏感的检查项。

**Minimum pipeline should include:**
- lint
- typecheck
- test
- migration validation
- OpenAPI contract validation
- build verification

**Rationale:**
- 现在最怕的是状态枚举漂移、接口 envelope 漂移、迁移失控和权限逻辑回归
- 不需要一开始就做复杂发布编排
- 但不能没有最基本的自动化质量门槛

#### Scaling Strategy

**Decision:**
当前不把 Redis、消息总线或微服务作为 MVP 前提，但必须保留清晰升级路径。

**Expected upgrade path:**
1. 单应用 + 单数据库 + 对象存储
2. 拆出独立 worker 进程
3. 若任务吞吐或事件复杂度上升，再引入队列/缓存
4. 若 API、任务执行和下载控制边界持续增重，再考虑服务拆分

**Rationale:**
- 先把产品闭环做稳
- 扩展复杂度按真实压力引入，而不是预支
- 避免“还没验证产品，就先搭平台”

#### Decision Impact Analysis

**Implementation Sequence:**
1. 先建立对象存储与交付物元数据模型
2. 再建立 worker 边界与任务回写机制
3. 同步补齐日志关联字段
4. 最后固化 CI/CD 校验项

**Cross-Component Dependencies:**
- 对象存储策略会影响下载接口、权限检查、审计记录与前端结果页
- worker 边界会影响任务状态模型、SSE 推送和失败恢复
- secret 管理会影响 SSO、API credential 与交付物签名策略
- 观测方案会影响支持视图、错误定位与人工介入排障体验

### Frontend Architecture

#### Rendering Strategy

**Decision:**
Yakimoji 前端采用 React Router Framework Mode，并保持以登录后工作台为核心的应用形态。  
渲染策略上，第一阶段不以 SEO 为目标，不做营销页驱动的 SSR 设计；但考虑到受保护会话、初次文档加载和 BFF 场景，保留服务端参与首个文档请求的能力。

**Rationale:**
- 产品核心是登录后工作台，不是公开内容站点
- 首屏是否可被搜索引擎抓取不是当前目标
- 但当前架构已包含 session、SSO adapter、受保护路由和 BFF/API 层，因此完全纯静态 SPA 并不是唯一收益最大的方向
- React Router 官方数据加载模型允许“首次文档请求由 server loader 处理，后续导航由 clientLoader 直连 API”这一混合模式

**Frontend implication:**
- 公开内容页不是当前前端架构中心
- 登录后应用必须围绕核心对象建立清晰路由边界：workspace、tasks、presets、review、deliverables / results
- `workspace` 只负责总览与入口，不承载完整任务管理、任务详情、预设编辑或预设更新 action
- 前端渲染策略服务于身份与工作流，而不是服务于 SEO

**Core route ownership:**
- `/workspace`：工作入口与总览，展示基础状态、运行中任务 banner、任务预览、任务创建入口、预设预览、预设入口
- `/tasks`：任务列表，负责分页、筛选、状态摘要和进入详情
- `/tasks/new`：任务创建，负责链接导入、上传、来源识别、预设命中确认和任务级轻量覆盖
- `/tasks/:taskId`：任务详情，负责状态、来源、时间线、交付物、失败解释和恢复入口
- `/presets`：预设列表，负责展示已配置预设摘要和创建入口
- `/presets/new`：预设创建，负责最小预设创建和基础配置
- `/presets/:presetId`：预设详情，只读展示预设配置与字幕样式效果摘要
- `/presets/:presetId/edit`：预设编辑，负责基础信息、字幕样式配置、模拟播放器预览和保存
- `/review` 或 `/tasks/:taskId/review`：低置信度片段处理入口，具体形态可按任务上下文决定
- `/deliverables` 或 `/tasks/:taskId/result`：结果与交付物入口，具体形态可优先嵌入任务详情

#### State Management Approach

**Decision:**
前端状态管理采用“三层分离”：

- React Router 内建网络/路由状态
- TanStack Query v5 管理需要客户端缓存的服务器状态
- React 本地状态仅管理短生命周期 UI 状态

**Rationale:**
React Router 官方文档明确指出：在 Framework Mode 下，很多传统“客户端缓存/状态同步”模式会变得冗余，因为 `loader`、`action`、`fetcher` 和自动 revalidation 已经内建处理了大量网络状态。  
因此 Yakimoji 不引入 Redux/Zustand 这类重量级全局状态库作为 MVP 前提。

但 Yakimoji 也不是普通表单站点，它存在：
- 任务列表局部刷新
- 任务详情与事件流
- SSE 驱动的状态推进
- 局部失效和定向刷新需求

因此完全只靠 route loader 也会让前端局部交互变笨重。  
最终采用的方式是：

- 路由/导航/提交中状态：交给 React Router
- 需要细粒度缓存与按键失效的服务器状态：交给 TanStack Query v5
- 面板开关、临时选择、局部草稿：保留在组件本地状态

#### Data Fetching and Cache Model

**Decision:**
采用“Route Bootstrap + Selective Query Cache”的混合数据策略。

**具体原则：**
- 首次进入关键路由时，用 React Router `loader` 提供页面级 bootstrap 数据
- 后续对高频更新资源，使用 TanStack Query v5 承接客户端缓存与定向失效
- 不做“所有后端数据都统一进 Query Cache”的全量缓存方案

**Recommended ownership split:**

**React Router loaders / actions / fetchers 负责：**
- 路由级初始数据
- 鉴权后重定向
- 表单提交后的自然 revalidation
- 导航中 pending 状态
- 不需要长期缓存的小型资源加载

**TanStack Query v5 负责：**
- 任务列表
- 单任务详情
- 任务事件流
- review 项列表
- 交付物状态摘要

**Route data ownership constraints:**
- `workspace` loader 只能加载总览摘要数据，不应加载完整任务详情、完整预设编辑模型或承担创建/更新 action
- 任务相关 loader/action 必须归属 `tasks` 路由族
- 预设相关 loader/action 必须归属 `presets` 路由族
- review 与 deliverables 可以嵌入任务详情展示，但其 mutation/action 不应通过 workspace 代理
- 若使用弹窗或抽屉承载详情/创建流程，也必须保留可寻址 URL 或等价路由状态，避免重要流程只存在组件本地状态中

**Rationale:**
这能兼顾两边优点：
- 借 React Router 保持 route-driven 心智和服务端一致性
- 借 TanStack Query 解决工作台型产品的细粒度刷新、局部失效和 SSE 写回问题

#### Form and Validation Strategy

**Decision:**
表单策略分两类处理：

**Class A: 简单提交型表单**
- 优先使用 React Router `<Form>` / `fetcher.Form`
- 例如：
  - 简单人工确认
  - 轻量筛选
  - 小型更新动作

**Class B: 复杂交互型表单**
- 使用 React Hook Form
- 结合 Zod v4 作为前端 schema 校验层
- 例如：
  - 任务创建
  - 频道预设编辑
  - 多字段配置表单

其中，预设编辑页及其模拟播放器字幕预览属于正式复杂交互型表单，不应继续以 workspace 内联小表单方式演进。

**Validation principle:**
- 后端 schema 是最终真源
- 前端 schema 只做提前反馈与类型对齐
- 服务端返回的字段错误必须能稳定映射回前端表单

**Rationale:**
- React Router 的表单/提交/revalidation 模型非常适合简单网络交互
- 但 Yakimoji 的预设编辑和任务创建不会永远是简单单字段表单
- React Hook Form 更适合复杂表单性能和字段编排
- Zod v4 能让前后端 schema 更容易保持一致

#### Component and Route Architecture

**Decision:**
前端按“路由层 + 领域层 + 共享层”组织，不按纯技术类型大平铺。

**Recommended structure:**
- `routes/`
- `features/tasks/`
- `features/presets/`
- `features/reviews/`
- `features/deliverables/`
- `features/auth/`
- `shared/ui/`
- `shared/hooks/`
- `shared/lib/`

**Route boundary expectations:**
- `routes/workspace*`：只承载总览与入口
- `routes/tasks*`：承载任务列表、任务详情、任务创建及其 route handler
- `routes/presets*`：承载预设列表、详情、编辑及其 route handler
- `features/presets/`：承载预设领域组件，包括字幕模拟播放器预览
- `features/tasks/`：承载任务领域组件，包括列表、详情、状态时间线、失败恢复和交付摘要

**Rationale:**
- Yakimoji 的复杂度来自领域边界，不是来自组件花样
- 若按 `components/ hooks/ utils/ pages/` 纯技术切分，任务/预设/review 很快会互相缠绕
- 领域分层更利于后续 story 按模块推进

**Server-only boundary:**
- 所有 session、SSO、secret、签名 URL、受保护下载逻辑都放在 `.server` 文件或 server-only 目录中
- 避免意外进入客户端 bundle

#### SSE Integration Strategy

**Decision:**
前端将 SSE 视为“服务器状态增量通知层”，而不是状态真源。  
SSE 到达后，不直接在组件里手写大量状态变更，而是通过以下方式驱动 UI：

- 更新 TanStack Query 缓存
- 或触发指定 query invalidation / route revalidation

**Rationale:**
- 避免组件层自己维护“第二套任务状态机”
- 保持后端状态模型为唯一真源
- 让 SSE 成为缓存更新信号，而不是业务逻辑承载层

**Recommended behavior:**
- 任务列表页：只更新受影响 task 的 cache entry
- 任务详情页：对状态、事件流、交付物摘要做定向刷新
- review-required 事件：触发对应 review 查询失效
- SSE 断开时：自动降级到轮询兜底

#### Performance and Bundle Strategy

**Decision:**
前端性能策略围绕“分页、按需加载、局部刷新、避免大对象进内存”展开。

**Key rules:**
- 任务列表必须分页
- 任务事件流按需加载，不在列表页预取完整历史
- 详情页重组件按路由或模块边界做懒加载
- SSE 更新只影响受影响数据，不全局粗暴刷新
- 大文件下载不经前端 blob 中转，直接走受控下载入口

**Rationale:**
- 这比过早做复杂客户端性能魔法更符合 Yakimoji 的真实瓶颈
- 当前性能关键点是工作台流畅度，不是动画跑分

#### URL and UI State Strategy

**Decision:**
可分享、可恢复、可刷新保留的界面状态优先进入 URL；  
只影响当前局部交互的临时状态留在组件本地。

**Should live in URL:**
- 列表筛选
- 排序
- 当前 tab
- 任务视图模式
- 分页位置

**Should stay local:**
- 抽屉开关
- modal 临时显示
- 临时 hover / selection
- 未提交草稿交互

**Rationale:**
- 工作台型产品需要刷新后尽量保留上下文
- React Router 官方也强调 URL search params 是天然状态容器

#### Error Handling and Observability Hooks

**Decision:**
前端错误处理采用“结构化错误 UI + request_id 可见 + 支持上下文友好”的方式，而不是单靠 toast。

**Requirements:**
- 关键失败页显式展示：
  - 错误说明
  - 可恢复动作
  - `request_id` 或等价追踪字段
- review / download / task failed 场景必须有页面级错误表达
- toast 只用于轻量反馈，不承担核心故障解释责任

**Rationale:**
- Yakimoji 的支持与排障价值依赖可解释性
- 用户和支持都需要把前端异常与后端日志串起来
- 这与前面已经定下的统一错误 envelope 是配套关系

#### Decision Impact Analysis

**Implementation Sequence:**
1. 先确定路由层与领域层目录边界
2. 再确定 loader/action/fetcher 与 Query Cache 的分工
3. 再补复杂表单的 RHF + Zod 路径
4. 最后接入 SSE 增量刷新与错误可观测性 UI

**Cross-Component Dependencies:**
- 路由数据策略会影响 API 形态和 session 检查方式
- Query Cache 策略会影响 SSE 集成方式
- 表单策略会影响 schema 共享与服务端错误映射
- URL 状态策略会影响列表页和工作台信息架构

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
至少有 5 类高风险冲突点，如果不先钉死，不同 AI agents 很容易写出彼此不兼容的实现：

- 命名模式
- 响应/数据格式
- 事件与状态通信模式
- 目录与文件结构
- 提交、校验、错误恢复等过程模式

### Naming Patterns

#### Database Naming Conventions

- 数据库表名统一使用 `snake_case` 复数名词
  - `users`
  - `channel_presets`
  - `task_events`
- 列名统一使用 `snake_case`
  - `user_id`
  - `created_at`
  - `provider_user_id`
- 外键列统一使用 `<target>_id`
  - `task_id`
  - `user_id`
  - `preset_id`
- 索引名统一使用 `idx_<table>_<column_list>`
  - `idx_tasks_status`
  - `idx_deliverables_task_id`
- 唯一约束统一使用 `uq_<table>_<column_list>`

#### API Naming Conventions

- REST endpoint 使用 `kebab-case` + 复数资源名
  - `/tasks`
  - `/channel-presets`
  - `/api-credentials`
- 子资源保持层级表达
  - `/tasks/:taskId/events`
  - `/tasks/:taskId/review-items`
- 路径参数统一使用 `camelCase`
  - `:taskId`
  - `:presetId`
- query 参数统一使用 `camelCase`
  - `pageSize`
  - `sortBy`
  - `createdAfter`

#### Code Naming Conventions

- React 组件名使用 `PascalCase`
  - `TaskListPage`
  - `ReviewDecisionPanel`
- React hooks 使用 `camelCase` 且必须以 `use` 开头
  - `useTaskList`
  - `useSseTaskUpdates`
- 普通函数与变量统一使用 `camelCase`
  - `buildTaskStatusLabel`
  - `requestId`
- TypeScript 类型、接口、schema factory 使用 `PascalCase`
  - `TaskSummary`
  - `DeliverableAccessPolicy`

#### File Naming Conventions

- React 组件文件使用 `PascalCase.tsx`
  - `TaskListPage.tsx`
  - `PresetEditorForm.tsx`
- 普通非组件 TS 文件统一使用 `kebab-case.ts`
  - `task-events.ts`
  - `request-context.ts`
  - `sso-adapter.server.ts`
- route 文件遵循 React Router 约定，但内部引用模块仍遵守上述命名规则
- server-only 文件统一追加 `.server`
  - `session.server.ts`
  - `deliverable-access.server.ts`

### Format Patterns

#### API Response Formats

**成功响应统一：**
```json
{
  "data": {},
  "meta": {}
}
```

**错误响应统一：**
```json
{
  "request_id": "req_123",
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found.",
    "details": {}
  }
}
```

#### Data Exchange Formats

- API JSON 字段统一使用 `camelCase`
- 数据库存储字段统一使用 `snake_case`
- API 日期时间字段统一使用 ISO 8601 字符串
  - `2026-05-20T10:30:00Z`
- 布尔值统一使用 `true/false`
- 单资源返回不包数组
- 分页集合统一返回：
```json
{
  "data": [],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 200
    }
  }
}
```

#### Status and Enum Formats

- 顶层任务状态统一使用 `snake_case`
  - `created`
  - `matching_preset`
  - `awaiting_human_review`
- 内部公开枚举值禁止同时出现 `snake_case` 和 `kebab-case` 两套写法
- 前端展示文案必须通过映射层生成，不直接把枚举值展示给用户

### Communication Patterns

#### Event System Patterns

- SSE 事件名统一使用 `dot.case`
  - `task.status_changed`
  - `task.review_required`
  - `deliverable.ready`
- 事件 payload 顶层结构统一为：
```json
{
  "eventId": "evt_123",
  "eventType": "task.status_changed",
  "taskId": "task_123",
  "occurredAt": "2026-05-20T10:30:00Z",
  "payload": {}
}
```
- 事件版本如需引入，优先放在 payload metadata 中，不在事件名里先做花式编码

#### State Management Patterns

- 后端状态模型是唯一真源
- SSE 只做增量通知，不做第二套前端状态机
- 前端状态更新优先通过：
  - query cache update
  - query invalidation
  - route revalidation
- 禁止在多个组件中各自复制一套任务状态推导逻辑

#### Logging Patterns

- 结构化日志字段统一使用 `snake_case`
- 核心关联字段统一保留：
  - `request_id`
  - `task_id`
  - `user_id`
  - `api_credential_id`
  - `event_type`
- 错误日志与用户可见错误必须可通过 `request_id` 关联

### Structure Patterns

#### Project Organization

**Frontend:**
- `routes/`
- `features/tasks/`
- `features/presets/`
- `features/reviews/`
- `features/deliverables/`
- `features/auth/`
- `shared/ui/`
- `shared/hooks/`
- `shared/lib/`

**Backend / server modules:**
- 以领域优先组织：
  - `tasks/`
  - `presets/`
  - `reviews/`
  - `deliverables/`
  - `auth/`
  - `api-credentials/`
- 每个领域内优先保持以下内聚：
  - route handler
  - service
  - repository
  - schema
  - mapper

#### File Structure Patterns

- shared 工具只放真正跨领域复用的内容
- 领域私有 helper 不允许一开始就丢进全局 `utils`
- OpenAPI 文档放在专门的 `docs/api/` 或等价目录，不散落在 feature 内
- 静态资源按用途分层，不在 feature 目录中混放大文件资产

#### Testing Structure

- 测试优先 co-locate
  - `task-events.test.ts`
  - `PresetEditorForm.test.tsx`
- 跨模块集成测试可集中到更高层测试目录
- contract / OpenAPI / auth flow / deliverable access 测试允许单独分组

### Process Patterns

#### Validation Patterns

- 服务端 schema 是最终真源
- 前端 schema 只做提前反馈与类型对齐
- 所有复杂表单必须支持服务端字段错误回填
- 禁止前后端各自维护不同字段约束却无同步机制

#### Loading State Patterns

- 路由级加载优先依赖 React Router pending/navigation state
- 高频服务器状态优先依赖 Query status
- loading UI 文案统一表达“正在做什么”，而不是只显示 spinner
- 对长任务页，loading 与 processing 状态必须区分

#### Error Handling Patterns

- 核心失败场景必须有页面级或面板级错误 UI
- toast 只用于轻量成功/提醒，不承担主要错误解释
- 所有关键失败视图必须展示 `request_id` 或等价追踪信息
- review、download、task failed 场景必须提供恢复动作或下一步建议

#### Authentication Flow Patterns

- 浏览器不直接持有上游 SSO token
- 所有 SSO 交互通过服务端 adapter 完成
- 本地 session 是 Web 真正登录态
- API credential 与 Web session 不混用

#### Download and Review Action Patterns

- 交付物下载必须先经过授权判断，再进入签名 URL 或受控下载
- 人工确认动作必须落审计事件
- 任何高敏感动作都必须可追踪到：
  - 谁做的
  - 对哪个 task 做的
  - 在什么时间做的

### Consistency Enforcement Principles

- 如果某个模式已经在文档中写死，agent 不得自行创造第二套等价模式
- 新增 feature 必须优先归入既有领域边界，而不是随手建新层级
- 命名、格式、事件、错误 envelope 视为“跨模块契约”，优先级高于局部代码偏好
- 若未来确需偏离这些规则，必须通过显式 ADR 或架构文档更新，而不是在实现中悄悄分叉

### High-Risk Divergence Pre-Mortem

假设 Yakimoji 后续由多个 AI agents 并行实现 3-5 个 story，最可能出现的失败并不是单个功能写不出来，而是多个局部“都合理”的实现最终互相不兼容。下面是预判到的最高风险分叉点，以及必须补充的防分叉规则。

#### Failure Scenario 1: API 和前端各自发明状态语义

**What fails:**
- 后端返回 `awaiting_review`
- 前端写成 `awaiting_human_review`
- SSE 事件里又出现 `review_required`
- 支持页再自己映射一套标签

最终结果是：
- 前端筛选和详情页状态不一致
- 外部 API 合约测试失效
- 支持排障无法稳定按状态检索

**Required hard rule:**
- 顶层任务状态枚举必须只定义在一个共享契约层
- 任何 route、service、component、SSE handler 都不得自行创建第二套状态字符串
- `task_events` 可以更细，但顶层状态只能来自统一枚举定义

#### Failure Scenario 2: 不同 agent 各自包装 API 响应

**What fails:**
- 某些接口返回 `{ data, meta }`
- 某些接口直接返回数组
- 某些错误接口沿用上游 SSO `{ code, msg, data }`
- 某些下载接口返回自定义 `{ success: false }`

最终结果是：
- Query 层 selector 四处特判
- 错误展示逻辑变成 if/else 拼图
- OpenAPI 文档与真实实现漂移

**Required hard rule:**
- 所有 Yakimoji 自有 API 必须遵守统一 envelope
- 上游 SSO 格式只允许存在于 adapter 层
- 任何例外都必须显式记录为 ADR，而不是在实现中临时特殊处理

#### Failure Scenario 3: SSE 被写成前端第二套状态机

**What fails:**
- 一个 agent 在组件里直接 `setState`
- 一个 agent 更新 query cache
- 一个 agent 触发 route revalidation
- 最后同一事件导致三种刷新路径并存

最终结果是：
- UI 同步偶发抖动
- 任务详情和列表刷新节奏不一致
- review-required 状态在不同页面表现不同

**Required hard rule:**
- SSE 只能做“缓存更新信号”或“revalidation 信号”
- 组件层禁止直接基于 SSE 手搓长期业务状态机
- SSE handler 逻辑必须集中放在约定的集成层，而不是散落在页面组件里

#### Failure Scenario 4: 本地 RBAC 被不同模块用不同来源判断

**What fails:**
- 一个 agent 从 session 直接读 role
- 一个 agent 查 `user_role_assignments`
- 一个 agent 误用 SSO `role=1` 当本地 admin
- 下载权限和支持页权限各自有不同判断逻辑

最终结果是：
- 同一用户在不同页面权限表现不一致
- 支持人员可能能看任务但不能下载，或反过来
- 高敏感权限无法可靠审计

**Required hard rule:**
- Yakimoji 本地 RBAC 是唯一授权真源
- SSO role 只能作为输入信号，不能直接用于资源授权判断
- 所有高敏感授权检查必须走统一 authorization service

#### Failure Scenario 5: 领域目录规则被“临时方便”慢慢侵蚀

**What fails:**
- 第一个 agent 建 `features/tasks`
- 第二个 agent 图快，把 preset helper 丢进 `shared/utils`
- 第三个 agent 又新建 `components/common`
- 第四个 agent 把 review 相关 schema 放到全局 `types`

最终结果是：
- 目录结构名义上 domain-first，实际上变回 tech-first 大杂烩
- 共享层变成垃圾回收站
- 新 agent 无法判断代码该放哪

**Required hard rule:**
- `shared/` 只允许放跨两个以上领域稳定复用的内容
- 领域私有 helper/schema/hook 默认必须先放回所属 feature/domain
- 新建全局目录应被视为架构变更，而不是实现自由

#### Failure Scenario 6: 表单校验规则前后端悄悄漂移

**What fails:**
- 前端 Zod 允许空字符串
- 后端 schema 要求非空 trimmed 值
- 服务端错误格式又没稳定映射到字段级
- 不同 agent 给同一字段写了两套错误文案和触发时机

最终结果是：
- 用户在前端能提交，通过不了后端
- 字段错误无法稳定回填
- 支持难以解释为什么“看起来填了也不行”

**Required hard rule:**
- 服务端 schema 是最终真源
- 前端 schema 必须显式标明是“mirror/derived validation”
- 所有复杂表单必须约定统一字段错误映射格式

#### Failure Scenario 7: 下载链路被不同 agent 用不同安全模型实现

**What fails:**
- 一个 agent 直接回 presigned URL
- 一个 agent 先做鉴权再 302
- 一个 agent 甚至直接暴露对象存储 key 路径
- 审计链路只在部分下载路径记录

最终结果是：
- 同类交付物访问方式不一致
- 部分下载路径绕过审计
- 文件权限风险被放大

**Required hard rule:**
- 交付物访问必须只通过统一 delivery access service 暴露
- presigned URL、受控下载代理、审计记录必须属于同一条授权流水线
- 禁止业务模块直接拼接对象存储下载地址

#### Failure Scenario 8: 测试策略失去一致性，回归盲区扩大

**What fails:**
- 某些功能只写组件测试
- 某些功能只写 service 测试
- 权限、SSE、状态枚举和 OpenAPI contract 没有稳定归属
- agent 们都觉得“别人会补”

最终结果是：
- 合约漂移无人发现
- 权限回归只能线上发现
- SSE/任务状态相关缺陷最晚暴露

**Required hard rule:**
- 每类高风险能力必须有最低测试归属：
  - 状态枚举：contract/integration
  - 权限：service/integration
  - API envelope：contract
  - 表单映射：component/integration
  - 下载授权：integration
- “co-locate” 是默认规则，但高风险跨模块行为必须允许集中测试补位

### Pre-Mortem Derived Enforcement Rules

基于上述失败推演，需要把以下规则从“建议”提升为“硬性约束”：

1. 顶层任务状态枚举必须单点定义，禁止重复声明。
2. Yakimoji API envelope 必须全局统一，SSO 格式只存在于 adapter 层。
3. SSE 不得驱动组件级私有业务状态机，只能驱动 cache/revalidation。
4. 本地 RBAC 是唯一授权真源，SSO role 不得直接作为资源授权依据。
5. `shared/` 不是兜底目录；领域私有代码默认必须留在所属 feature/domain。
6. 服务端 schema 是最终真源，复杂表单必须支持统一字段错误映射。
7. 下载链路必须集中在统一授权/审计流水线中。
8. 状态、权限、接口 envelope、下载访问四类能力必须有明确测试归属。

### Enforcement Priority

**Highest priority rules:**
- 状态枚举单点定义
- API envelope 统一
- 本地 RBAC 单一真源
- 下载授权链路集中

**Medium priority rules:**
- SSE 集成层集中
- shared 目录使用约束
- 表单字段错误映射统一

**Operational priority rules:**
- 测试归属清单
- request_id 全链路可见
- 结构化日志字段固定

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
当前所有核心决策总体兼容，没有明显内在冲突。

- `React Router node-postgres` 作为第一阶段 starter，与前端工作台、REST API、SSO adapter、本地 session、对象存储和 worker 预留边界是兼容的
- `SSO 负责身份 + Yakimoji 负责本地 RBAC` 与 API、下载控制、审计日志和支持/运营视图要求保持一致
- `REST + OpenAPI + SSE` 的组合与当前产品“工作流透明 + 外部 API + 单向状态通知”的需求一致
- `单应用部署 + 预留 worker 边界` 与当前 MVP 范围匹配，也和后续演进路径一致
- `React Router + TanStack Query v5 + RHF + Zod v4` 的前端分工与任务列表、详情、review 流和 SSE 更新模型兼容

**Pattern Consistency:**
实现模式与架构决策基本一致。

- 命名规则已覆盖数据库、API、代码、文件、状态和事件命名
- 响应 envelope、错误结构、状态枚举、SSE 事件、日志字段已经形成跨模块契约
- SSO 上游格式被正确隔离在 adapter 层，没有污染应用内 API 规范
- pre-mortem 已经把最容易分叉的地方提升为硬性约束

**Structure Alignment:**
项目结构支持当前架构，没有明显结构性错位。

- `app/features`、`app/server`、`worker`、`db/schema`、`tests` 之间的边界与先前决策一致
- 认证、任务、预设、review、交付物、API credential 都有清晰归属
- `.server` 边界和 `worker/` 边界都被明确写入结构中
- contract / integration / e2e 的测试分层与高风险能力匹配

### Requirements Coverage Validation ✅

**Feature Coverage:**
`FR1-FR50` 已被架构性承接，未发现无归属的大类需求。

- 任务入口与创建：由 `tasks` 路由、服务、表单与 worker 起点承接
- 频道预设管理：由 `presets` feature 与 server domain 承接
- 任务处理与状态：由 `tasks + task_events + worker + SSE` 承接
- 异常与人工介入：由 `reviews` feature/domain 承接
- 交付物访问：由 `deliverables + object storage + access service` 承接
- 外部 API：由 `api.* routes + api-credentials + OpenAPI` 承接
- 运营/审计可见性：由 `audit_logs + task_events + deliverables + supporting views` 承接

**Functional Requirements Coverage:**
所有功能需求类别都至少有对应的架构落点：

- `FR1-FR8`：任务创建与工作台入口已覆盖
- `FR9-FR16`：预设创建、编辑、命中、标识已覆盖
- `FR17-FR23`：任务覆盖、处理状态、详情、失败表达已覆盖
- `FR24-FR33`：未命中预设、低置信度 review、支持定位已覆盖
- `FR34-FR39`：交付物下载、移动端轻操作已覆盖
- `FR40-FR44`：外部 API 创建、状态、结果与异常结果已覆盖
- `FR45-FR50`：最小运营/审计可见性已在数据层与结构层覆盖

**Non-Functional Requirements Coverage:**
`NFR1-NFR15` 已被架构层面承接，但个别项还需要实现期明确验收机制。

- 性能：分页、按需加载、局部刷新、SSE 增量更新已覆盖 `NFR1-NFR3`
- 可靠性：失败状态、任务状态同步、交付物访问和审计保留已有架构承接，覆盖 `NFR4-NFR7`
- 安全：SSO、本地 RBAC、受控下载、API credential、审计日志已承接 `NFR8-NFR12`
- 集成：统一状态枚举、错误 envelope、OpenAPI 合约已承接 `NFR13-NFR15`

### Implementation Readiness Validation ✅

**Decision Completeness:**
大部分关键决策已经足以指导实现。

- starter、数据库、认证、API、SSE、对象存储、worker、前端状态与表单方案都已明确
- 关键边界均已写成可执行的约束，而不仅是方向性建议
- 版本层面已覆盖 OpenAPI、PostgreSQL、OpenTelemetry 等关键基础项

**Structure Completeness:**
项目结构已达到“可指导 implementation story 切分”的程度。

- 根目录、前端、server、worker、db、tests、docs 都有具体结构
- 各 FR 大类已映射到具体 feature/domain
- 高风险跨模块能力已有统一落点

**Pattern Completeness:**
模式定义对 AI agent 实现一致性已具备较强约束力。

- 命名、格式、通信、结构、过程模式均已覆盖
- pre-mortem 已补强最容易被不同 agent 分叉的高风险点
- 测试归属已经从“建议”提升到最低要求层

### Gap Analysis Results

#### Critical Gaps
当前未发现会直接阻塞实现启动的 critical gap。

#### Important Gaps

本轮重要 gap 已通过以下 ADR 关闭：

- `docs/adr/001-worker-execution-model.md`
- `docs/adr/002-openapi-ownership.md`
- `docs/adr/003-support-ops-ia.md`
- `docs/adr/004-provider-adapter-boundary.md`

当前不再存在会阻塞实现启动的重要未决架构空白。

#### Nice-to-Have Gaps

- 可补一份“support 排障视图字段最小集合”清单
- 可补一份“任务状态与事件示例 payload”附录
- 可补一份“前后端共享契约文件 ownership 说明”
- 可补一份“对象存储生命周期与清理策略”说明

### Validation Issues Addressed

本轮验证未发现需要回退重做的架构问题。  
本轮验证未发现需要回退重做的架构问题，当前剩余工作主要是把已决议的架构约束落实到代码与 CI 中。

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:**
Ready for implementation.

**Readiness Judgment:**
这份架构已经达到“可以指导多个 AI agents 并行实现第一阶段能力”的程度。  
当前架构主干与关键实现边界都已明确，可直接进入实现阶段。

**Recommended pre-implementation follow-ups:**
1. 在实际代码库中落地上述 4 份 ADR 对应的目录结构与契约文件
2. 将 public OpenAPI contract validation 接入 CI
3. 将 worker job schema 与 task status enum 作为共享契约优先落地
