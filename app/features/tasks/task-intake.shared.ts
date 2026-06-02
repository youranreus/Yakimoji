export const subtitleTemplateOverrideOptions = [
  "标准 Shorts 模板",
  "标准模板",
  "科普模板",
  "双语模板",
  "高对比模板",
  "访谈模板",
] as const;

export function isValidSubtitleTemplateOverride(value: string) {
  return subtitleTemplateOverrideOptions.includes(
    value as (typeof subtitleTemplateOverrideOptions)[number],
  );
}
