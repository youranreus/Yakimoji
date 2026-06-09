import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeliverableAvailabilityCopy,
  getReviewDecisionHelperCopy,
  getTaskEntryActionCopy,
} from "../app/features/tasks/components/task-formatters";

test("task entry action copy stays aligned with follow-through states", () => {
  assert.equal(getTaskEntryActionCopy("completed"), "查看结果与下载入口");
  assert.equal(
    getTaskEntryActionCopy("awaiting_human_review"),
    "查看待确认片段与当前状态",
  );
  assert.equal(getTaskEntryActionCopy("failed"), "查看失败原因与下一步");
  assert.equal(getTaskEntryActionCopy("processing"), "查看详情与最新进展");
});

test("deliverable availability copy explains mobile-safe download states", () => {
  assert.equal(
    getDeliverableAvailabilityCopy("ready"),
    "通过受控下载获取文件，不会暴露长期公共链接。",
  );
  assert.equal(
    getDeliverableAvailabilityCopy("pending"),
    "文件仍在生成中，当前还不能下载。",
  );
  assert.equal(
    getDeliverableAvailabilityCopy("expired"),
    "文件已超过保留期，需要重新生成。",
  );
  assert.equal(
    getDeliverableAvailabilityCopy("unavailable"),
    "当前结果暂不可用，请稍后重试或查看任务状态。",
  );
});

test("review decision helper copy keeps mobile review actions explicit", () => {
  assert.equal(
    getReviewDecisionHelperCopy("approve"),
    "该片段将按当前识别结果继续推进后续处理。",
  );
  assert.equal(
    getReviewDecisionHelperCopy("needs_attention"),
    "该片段会以“继续关注”的确认结果写入正式 review 记录。",
  );
});
