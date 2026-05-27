# Story 2.2: Resolve Preset Match for Familiar Sources

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 创作者,
I want 系统在识别到熟悉来源时解析并命中对应频道预设,
so that 我不需要每次重新确认同一套默认规则。

## Acceptance Criteria

1. **Given** 创作者已为某个来源频道维护了有效的频道预设  
   **When** 创作者导入来自该来源的新任务  
   **Then** 系统必须尝试基于识别到的来源信息自动匹配对应频道预设  
   **And** 匹配逻辑的结果必须能稳定用于任务默认值生成
2. **Given** 系统执行熟悉来源匹配  
   **When** 来源识别输入进入匹配规则  
   **Then** 匹配必须基于已定义的唯一来源标识输入  
   **And** 本 story 不负责定义复杂人工修正流程或未知来源补录分支
3. **Given** 系统成功命中某个频道预设  
   **When** 创作者查看任务创建确认区域  
   **Then** 页面必须明确标识该任务已命中已有频道预设  
   **And** 展示将被应用的关键规则摘要，包括默认翻译方向、默认字幕模板和默认输出偏好
4. **Given** 某个任务已命中频道预设  
   **When** 创作者确认继续创建任务  
   **Then** 系统必须以该预设生成任务默认值  
   **And** 创作者不需要重新逐项配置同一套默认规则
5. **Given** 系统成功命中某个频道预设  
   **When** 任务记录被创建并进入后续处理链路  
   **Then** 系统必须在任务元数据中保留命中的预设信息  
   **And** 明确标识该任务是命中已有预设而非新建预设或未使用预设
6. **Given** 同一来源有可稳定识别的熟悉频道  
   **When** 创作者多次导入该来源任务  
   **Then** 系统应在相同匹配条件下给出一致的命中结果  
   **And** 不得在没有原因说明的情况下随机切换是否命中预设
7. **Given** 预设在任务创建后被修改  
   **When** 后续系统读取该已创建任务  
   **Then** 该任务必须继续使用创建时已解析出的任务快照  
   **And** 不得因为预设后续更新而隐式改写已创建任务的默认值
8. **Given** 系统命中预设但相关默认值存在显示或应用失败  
   **When** 创作者查看确认界面或提交任务  
   **Then** 页面必须返回清楚的错误或降级提示  
   **And** 不得让用户误以为某套预设已经被完整应用而实际没有生效
9. **Given** 命中结果已产生  
   **When** 创作者、支持或后续运营模块读取该任务上下文  
   **Then** 系统必须能够区分该任务是命中已有预设、创建了新预设后继续还是未使用预设继续  
   **And** 这些状态应可作为后续支持解释和运营统计的基础

## Tasks / Subtasks

- [x] 在任务导入预览阶段执行 owner-scoped 频道预设匹配 (AC: 1, 2, 6)
  - [x] 使用来源识别产出的唯一 `sourceIdentifier` 查找当前创作者的频道预设
  - [x] 未命中时保持现有默认处理基线，不引入未知来源人工补录流程
- [x] 将命中结果反馈给任务创建确认区域 (AC: 3, 8)
  - [x] 预览 payload 返回 `presetMatch`
  - [x] UI 展示命中状态、来源标识与将应用的默认规则摘要
- [x] 确认创建任务时应用并冻结预设默认值 (AC: 4, 5, 7, 9)
  - [x] 使用命中预设的 defaults 生成 `processingBaselineSnapshot`
  - [x] 将 `presetId` 与 `presetSnapshot` 写入任务记录
  - [x] 任务创建响应区分命中预设与未使用预设
- [x] 补齐匹配回归测试 (AC: 1, 4, 5, 6, 7)
  - [x] 覆盖未命中预设时的默认基线
  - [x] 覆盖命中熟悉来源后应用预设 baseline 并持久化快照

## Dev Notes

### Story Intent

- 本 story 只处理“熟悉来源自动命中已有预设”的基础链路。
- 未知来源人工决策、新建预设后继续、任务级覆盖属于后续 Story 2.3/2.4，不在本 story 扩展。
- 任务创建后必须保留创建时快照，避免后续预设编辑隐式改写历史任务。

### Architecture Compliance

- 匹配基于 `channel_presets.owner_user_id + source_identifier`，不做模糊匹配或跨创作者复用。
- 任务元数据使用 `tasks.preset_id` 和 `tasks.preset_snapshot` 保存命中信息与创建时快照。
- 任务导入仍保留现有 preview -> confirm 两段式，不绕过已有 draft 与 request_id 模式。

## Senior Developer Review (AI)

Outcome: Approve

Review Date: 2026-05-27

Findings: No blocking findings. Reviewed source identifier matching, draft persistence, task snapshot semantics, UI confirmation copy, and regression coverage.

## Dev Agent Record

### Debug Log

- `pnpm typecheck` passed.
- `pnpm test` passed with 59 tests.
- `pnpm build` passed.

### Completion Notes

- Added `presetMatch` to task preview and creation payloads.
- Applied matched preset defaults to task creation baseline.
- Persisted `presetId` and `presetSnapshot` on created tasks.
- Added regression coverage for familiar source matching and no-match fallback.

### File List

- `app/features/tasks/server/task-intake.server.ts`
- `app/shared/ui/WorkspaceShell.tsx`
- `database/schema/tasks.ts`
- `drizzle/0007_channel_preset_workbench.sql`
- `tests/task-intake.test.ts`

### Change Log

- 2026-05-27: Story artifact created, implemented, reviewed, and completed.
