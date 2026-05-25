import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { FileUpload } from "@remix-run/form-data-parser";

const uploadsRoot = path.join(process.cwd(), ".local-share", "uploads");

export type StoredUpload = {
  storageKey: string;
  originalFileName: string;
  contentType: string;
  size: number;
};

export async function persistUploadedVideo(file: FileUpload): Promise<StoredUpload> {
  const extension = path.extname(file.name) || ".bin";
  const storageKey = `tasks/${Date.now()}-${randomUUID()}${extension}`;
  const absolutePath = path.join(uploadsRoot, storageKey);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    storageKey,
    originalFileName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  };
}
