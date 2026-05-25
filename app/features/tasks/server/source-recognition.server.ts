type YoutubeRecognizedSource = {
  identifier: string;
  title: string;
  recognitionMode: "youtube_link";
  confidence: "high";
  previewLabel: string;
};

type UploadRecognizedSource = {
  identifier: null;
  title: string;
  recognitionMode: "video_upload";
  confidence: "unknown";
  previewLabel: string;
};

type RecognizedSource = YoutubeRecognizedSource | UploadRecognizedSource;

export type UploadRecognitionResult =
  | UploadRecognizedSource
  | null;

function sanitizeIdentifier(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 320);
}

function createYoutubeSourceIdentifier(url: URL) {
  const pathname = url.pathname.replace(/\/+$/, "");
  const channelHandle = url.searchParams.get("ab_channel");

  if (channelHandle) {
    return `youtube:${sanitizeIdentifier(channelHandle)}`;
  }

  if (pathname.startsWith("/@")) {
    return `youtube:${sanitizeIdentifier(pathname.slice(2))}`;
  }

  if (url.hostname === "youtu.be" && pathname.length > 1) {
    return `youtube:video:${sanitizeIdentifier(pathname.slice(1))}`;
  }

  if (pathname.startsWith("/shorts/")) {
    const shortId = pathname.split("/")[2];

    if (shortId) {
      return `youtube:video:${sanitizeIdentifier(shortId)}`;
    }
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

export function recognizeSourceFromYoutubeUrl(rawUrl: string): YoutubeRecognizedSource {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("请输入可识别的 YouTube 链接。");
  }

  const host = parsed.hostname.toLowerCase();
  const isYoutubeHost =
    host === "youtu.be" ||
    host === "youtube.com" ||
    host.endsWith(".youtube.com") ||
    host === "youtube-nocookie.com" ||
    host.endsWith(".youtube-nocookie.com");

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

export function recognizeSourceFromUpload(fileName: string): UploadRecognitionResult | null {
  const normalized = humanizeVideoName(fileName);

  if (!normalized) {
    return null;
  }

  return {
    identifier: null,
    title: normalized,
    recognitionMode: "video_upload",
    confidence: "unknown",
    previewLabel: `${normalized} · 当前仍无法可靠识别来源`,
  };
}
