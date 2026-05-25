export type ProcessingBaselineSnapshot = {
  translationMode: string;
  subtitleTemplate: string;
  outputPackage: string;
};

const defaultProcessingBaseline: ProcessingBaselineSnapshot = {
  translationMode: "中译中字幕",
  subtitleTemplate: "标准 Shorts 模板",
  outputPackage: "mp4 + srt",
};

export function getDefaultProcessingBaseline() {
  return defaultProcessingBaseline;
}
