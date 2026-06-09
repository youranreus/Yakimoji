export function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getTaskEntryActionCopy(status: string) {
  switch (status) {
    case "completed":
      return "查看结果与下载入口";
    case "awaiting_human_review":
      return "查看待确认片段与当前状态";
    case "failed":
    case "cancelled":
      return "查看失败原因与下一步";
    default:
      return "查看详情与最新进展";
  }
}

export function getDeliverableAvailabilityCopy(status: string) {
  switch (status) {
    case "ready":
      return "通过受控下载获取文件，不会暴露长期公共链接。";
    case "pending":
      return "文件仍在生成中，当前还不能下载。";
    case "expired":
      return "文件已超过保留期，需要重新生成。";
    case "unavailable":
    default:
      return "当前结果暂不可用，请稍后重试或查看任务状态。";
  }
}

export function getReviewDecisionHelperCopy(decision: string) {
  switch (decision) {
    case "needs_attention":
      return "该片段会以“继续关注”的确认结果写入正式 review 记录。";
    case "approve":
    default:
      return "该片段将按当前识别结果继续推进后续处理。";
  }
}
