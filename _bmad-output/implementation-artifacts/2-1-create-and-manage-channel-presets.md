# Story 2.1: Create and Manage Channel Presets

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 创建、查看和编辑频道预设,
so that 我能把常用频道的默认处理规则沉淀成可复用资产。

## Acceptance Criteria

1. **Given** 创作者已登录并进入工作台  
   **When** 创作者进入频道预设管理入口  
   **Then** 页面必须提供预设列表视图  
   **And** 创作者可以查看自己已维护的频道预设摘要信息
2. **Given** 创作者需要为一个来源频道建立预设  
   **When** 创作者发起创建预设动作  
   **Then** 系统必须允许其创建新的频道预设  
   **And** 创建流程至少支持填写来源频道标识、默认翻译方向、默认字幕模板和默认输出偏好
3. **Given** 创作者正在创建或编辑频道预设  
   **When** 创作者提交有效配置  
   **Then** 系统必须保存该预设并与当前创作者归属关联  
   **And** 保存后的预设必须能在预设列表中再次查看和后续复用
4. **Given** 创作者已存在一个频道预设  
   **When** 创作者打开该预设的详情或编辑界面  
   **Then** 创作者必须能查看当前已保存的默认翻译方向、默认字幕模板和默认输出偏好  
   **And** 这些字段应以清晰、可读的方式展示，而不是只暴露底层技术值
5. **Given** 创作者希望调整已有频道预设  
   **When** 创作者修改并保存预设  
   **Then** 系统必须更新该预设的已保存规则  
   **And** 更新后的内容应成为后续任务命中该预设时的默认值来源
6. **Given** 创作者提交的预设信息不完整或无效  
   **When** 系统执行校验  
   **Then** 页面必须返回明确的字段级或表单级错误提示  
   **And** 错误反馈必须支持用户修正后再次提交，而不是让预设进入不确定状态
7. **Given** 创作者在桌面端使用预设创建或编辑流程  
   **When** 页面渲染预设表单  
   **Then** 该流程必须遵循渐进暴露与轻量配置原则  
   **And** 不得扩展成复杂翻译风格编辑器或超出已确认范围的高级参数后台
8. **Given** 创作者访问他人预设或无权限的预设资源  
   **When** 系统执行授权检查  
   **Then** 系统必须拒绝越权访问  
   **And** 只有预设拥有者或具备相应内部权限的角色才能查看或修改对应预设

## Tasks / Subtasks

- [x] 建立频道预设数据模型与持久化契约 (AC: 2, 3, 4, 5, 8)
  - [x] 在 `database/schema/` 新增 `channel_presets` schema，字段覆盖 owner、source identifier、默认翻译方向、字幕模板、输出偏好与元数据
  - [x] 新增 Drizzle migration，保持数据库 snake_case 与应用层 camelCase 边界
  - [x] 为同一创作者下的 `source_identifier` 建立唯一约束，避免重复预设造成后续匹配歧义
- [x] 建立 `app/features/presets/server/` 领域服务 (AC: 2, 3, 5, 6, 8)
  - [x] 提供列表、创建、更新、按 owner/source 查找能力
  - [x] 使用应用层 schema 校验并返回可映射到表单的结构化错误
  - [x] 更新预设必须校验 owner，不允许跨创作者修改
- [x] 将预设管理入口接入受保护工作台 (AC: 1, 2, 4, 5, 6, 7)
  - [x] 工作台 loader 聚合当前创作者预设列表
  - [x] 工作台 action 支持创建与更新预设 intent
  - [x] UI 提供列表摘要、轻量创建表单和现有预设的可编辑字段
- [x] 补齐测试与回归验证 (AC: 3, 5, 6, 8)
  - [x] 覆盖预设创建、字段校验、owner 隔离、更新后列表可见
  - [x] 保持现有 auth/session/task/deliverable 测试通过

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-05-27

Findings: No blocking findings. Reviewed schema/migration boundaries, owner-scoped preset service, workspace action routing, UI form states, and regression coverage.

## Dev Notes

### Story Intent

- 这是 Epic 2 的基础能力故事，目标是先把“频道预设”作为正式领域资源落地。
- 本 story 不负责未知来源人工补录，也不负责复杂翻译风格编辑器；只交付后续匹配 story 可消费的轻量预设资产。
- 预设必须属于当前创作者，并作为后续任务默认值来源，而不是前端临时态。

### Architecture Compliance

- 预设属于正式核心资源 `channel-presets`，目录归属应落在 `features/presets/` 与 `database/schema/`，不要放入 `shared/utils`。
- 本地 RBAC 与 creator ownership 是授权真源；SSO role 不能直接作为预设资源授权判断。
- 表单校验采用应用层 schema，数据库 schema 是最终真源；错误需要能映射回字段或表单级反馈。
- 数据库命名使用 `snake_case`，TypeScript read model / action result 使用 `camelCase`。

### Current Codebase State

- `app/features/presets/` 目前只有 `.gitkeep`，可建立 server 与 component 子目录。
- `app/features/tasks/server/task-intake.server.ts` 已经有默认 baseline，但没有频道预设默认值来源。
- `app/features/tasks/server/workspace-view.server.ts` 当前聚合工作台用户、导航、任务列表与选中任务详情，可扩展为同时聚合预设列表。
- `app/shared/ui/WorkspaceShell.tsx` 是工作台主布局，当前已有任务导入表单；预设入口应保持轻量配置，不要做营销式页面或复杂编辑器。

### Testing Requirements

- 新增 `tests/channel-presets.test.ts` 或等价测试文件，覆盖核心服务与 action 契约。
- 完成后运行 `pnpm typecheck` 与 `pnpm test`。

## Dev Agent Record

### Debug Log

- `pnpm install` restored dependencies already declared in `package.json` but absent from local `node_modules`.
- `pnpm typecheck` passed.
- `pnpm test` passed with 59 tests.
- `pnpm build` passed.
- `pnpm dev` started and reported `http://localhost:3000`; sandbox-local `curl` could not connect to the listener, so browser smoke verification was limited by the environment.

### Completion Notes

- Added owner-scoped channel preset persistence with unique creator/source constraint.
- Added preset create/update/list/source lookup service and structured action errors.
- Added workspace preset workbench with list, create, and edit controls.
- Added tests covering preset summaries, duplicate rejection, validation, owner isolation, action dispatch, and source lookup.

### File List

- `database/schema/channel-presets.ts`
- `database/schema/index.ts`
- `database/schema/tasks.ts`
- `drizzle/0007_channel_preset_workbench.sql`
- `drizzle/meta/_journal.json`
- `app/features/presets/server/channel-presets.server.ts`
- `app/features/presets/components/ChannelPresetWorkbench.tsx`
- `app/features/tasks/server/workspace-view.server.ts`
- `app/features/tasks/components/CreatorWorkspaceScreen.tsx`
- `app/routes/workspace.tsx`
- `app/shared/ui/WorkspaceShell.tsx`
- `app/app.css`
- `tests/channel-presets.test.ts`
- `tests/workspace-view.test.ts`
- `tests/deliverables.test.ts`

### Change Log

- 2026-05-27: Story artifact created from Epic 2 / Story 2.1 context.
- 2026-05-27: Implemented and reviewed channel preset workbench.
