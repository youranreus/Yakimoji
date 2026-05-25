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
  const handle = await fs.open(absolutePath, "w");

  try {
    const reader = file.stream().getReader();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value) {
        await handle.write(Buffer.from(value));
      }
    }
  } catch (error) {
    await handle.close();
    await fs.rm(absolutePath, { force: true });
    throw error;
  }

  await handle.close();

  return {
    storageKey,
    originalFileName: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  };
}

export async function deleteStoredUpload(storageKey: string) {
  const absolutePath = path.join(uploadsRoot, storageKey);
  await fs.rm(absolutePath, { force: true });
}
