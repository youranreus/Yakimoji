import { z } from "zod";

export const previewThemeOptions = [
  "classic",
  "cinema",
  "highContrast",
] as const;

export type PresetPreviewTheme = (typeof previewThemeOptions)[number];

export const previewThemeLabels: Record<PresetPreviewTheme, string> = {
  classic: "经典白描边",
  cinema: "影院柔影",
  highContrast: "高对比强调",
};

export const defaultPresetFormValues = {
  translationMode: "中译中字幕",
  subtitleTemplate: "标准 Shorts 模板",
  outputPackage: "mp4 + srt",
  previewFontSize: 36,
  previewTheme: "classic" as PresetPreviewTheme,
};

export const channelPresetFormSchema = z.object({
  sourceIdentifier: z
    .string()
    .trim()
    .min(3, "请输入可识别的来源频道标识。")
    .max(320, "来源频道标识过长。"),
  displayName: z
    .string()
    .trim()
    .min(1, "请输入预设名称。")
    .max(160, "预设名称过长。"),
  translationMode: z
    .string()
    .trim()
    .min(1, "请选择或填写默认翻译方向。")
    .max(120, "默认翻译方向过长。"),
  subtitleTemplate: z
    .string()
    .trim()
    .min(1, "请选择或填写默认字幕模板。")
    .max(160, "默认字幕模板过长。"),
  outputPackage: z
    .string()
    .trim()
    .min(1, "请选择或填写默认输出偏好。")
    .max(120, "默认输出偏好过长。"),
  notes: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().trim().max(500, "备注过长。").optional(),
  ),
  previewFontSize: z.coerce
    .number()
    .int("字幕预览字号必须是整数。")
    .min(24, "字幕预览字号不能小于 24。")
    .max(72, "字幕预览字号不能大于 72。"),
  previewTheme: z.enum(previewThemeOptions, {
    message: "请选择有效的字幕预览主题。",
  }),
});

export type ChannelPresetFormInput = z.infer<typeof channelPresetFormSchema>;

export function getPreviewThemeLabel(theme: PresetPreviewTheme) {
  return previewThemeLabels[theme];
}
