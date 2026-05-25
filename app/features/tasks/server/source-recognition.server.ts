type RecognizedSource = {
  identifier: string;
  title: string;
  recognitionMode: "youtube_link" | "video_upload";
  confidence: "high" | "unknown";
  previewLabel: string;
};

function sanitizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 320);
}

function createYoutubeSourceIdentifier(url: URL) {
  const channelHandle = url.searchParams.get("ab_channel");

  if (channelHandle) {
    return `youtube:${sanitizeIdentifier(channelHandle)}`;
  }

  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.startsWith("/@")) {
    return `youtube:${sanitizeIdentifier(pathname.slice(2))}`;
  }

  const videoId = url.searchParams.get("v");

  if (videoId) {
    return `youtube:video:${sanitizeIdentifier(videoId)}`;
  }

  return `youtube:url:${sanitizeIdentifier(url.hostname + pathname)}`;
}

function humanizeVideoName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim()
    .slice(0, 120);
}

export function recognizeSourceFromYoutubeUrl(rawUrl: string): RecognizedSource {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("请输入可识别的 YouTube 链接。");
  }

  const isYoutubeHost =
    parsed.hostname === "youtu.be" ||
    parsed.hostname.endsWith("youtube.com") ||
    parsed.hostname.endsWith("youtube-nocookie.com");

  if (!isYoutubeHost) {
    throw new Error("当前仅支持 YouTube 链接导入。");
  }

  const sourceIdentifier = createYoutubeSourceIdentifier(parsed);
  const title = parsed.searchParams.get("v")
    ? `YouTube 视频 ${parsed.searchParams.get("v")}`
    : parsed.pathname.replace(/^\//, "") || parsed.hostname;

  return {
    identifier: sourceIdentifier,
    title,
    recognitionMode: "youtube_link",
    confidence: "high",
    previewLabel: `${title} · 来源已识别`,
  };
}

export function recognizeSourceFromUpload(fileName: string): RecognizedSource | null {
  const normalized = humanizeVideoName(fileName);

  if (!normalized) {
    return null;
  }

  return {
    identifier: `upload:${sanitizeIdentifier(normalized.toLowerCase())}`,
    title: normalized,
    recognitionMode: "video_upload",
    confidence: "unknown",
    previewLabel: `${normalized} · 上传待确认`,
  };
}
