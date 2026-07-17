import {
  BizCode,
  type AdminDefaultAvatarUploadResponse,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import { insertDefaultAvatarVersion } from "./assets.repository";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_CACHE_CONTROL = "public, max-age=31536000, immutable";

const avatarExtensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AvatarMimeType = keyof typeof avatarExtensionByMimeType;
type AvatarExtension = (typeof avatarExtensionByMimeType)[AvatarMimeType];

export async function uploadDefaultAvatar(input: {
  bindings: ApiBindings;
  createdByUserId: string;
  file: File;
}): Promise<AdminDefaultAvatarUploadResponse> {
  const extension = assertAvatarFile(input.file);
  const nowMs = Date.now();
  const avatarKey = buildDefaultAvatarKey(nowMs, extension);
  const bucket = requireAvatarBucket(input.bindings.AVATAR_BUCKET);
  const fileName = input.file.name || `default-avatar.${extension}`;

  await putDefaultAvatar(bucket, avatarKey, input.file, extension);

  try {
    await insertDefaultAvatarVersion(input.bindings.DB, {
      avatarKey,
      contentType: input.file.type as AvatarMimeType,
      createdAtMs: nowMs,
      createdByUserId: input.createdByUserId,
      fileName,
      id: uuidv7(),
      sizeBytes: input.file.size,
    });
  } catch (error) {
    await deleteOrphanedAvatar(bucket, avatarKey);
    throw error;
  }

  return {
    key: avatarKey,
    updatedAtMs: nowMs,
  };
}

export async function getDefaultAvatar(
  bucketBinding: R2Bucket | undefined,
  key: string,
): Promise<R2ObjectBody> {
  const bucket = requireAvatarBucket(bucketBinding);

  try {
    const object = await bucket.get(key);

    if (!object) {
      throw new AppError(BizCode.COMMON_NOT_FOUND, "头像不存在", 404);
    }

    return object;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("读取 R2 头像失败", error);
    throw storageUnavailableError();
  }
}

function assertAvatarFile(file: File): AvatarExtension {
  if (!isAvatarMimeType(file.type)) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "头像只支持 JPG、PNG 或 WebP",
      400,
    );
  }

  if (file.size <= 0) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, "头像文件不能为空", 400);
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "头像文件不能超过 2 MiB",
      413,
    );
  }

  return avatarExtensionByMimeType[file.type];
}

function isAvatarMimeType(value: string): value is AvatarMimeType {
  return Object.hasOwn(avatarExtensionByMimeType, value);
}

function buildDefaultAvatarKey(
  nowMs: number,
  extension: AvatarExtension,
): string {
  return `avatars/default/${nowMs}-${uuidv7()}.${extension}`;
}

async function putDefaultAvatar(
  bucket: R2Bucket,
  key: string,
  file: File,
  extension: AvatarExtension,
): Promise<void> {
  try {
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        cacheControl: AVATAR_CACHE_CONTROL,
        contentDisposition: `inline; filename="default-avatar.${extension}"`,
        contentType: file.type,
      },
    });
  } catch (error) {
    console.error("写入 R2 头像失败", error);
    throw storageUnavailableError();
  }
}

async function deleteOrphanedAvatar(
  bucket: R2Bucket,
  key: string,
): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (error) {
    console.error("清理未写入元数据的 R2 头像失败", error);
  }
}

function requireAvatarBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) {
    throw storageUnavailableError();
  }

  return bucket;
}

function storageUnavailableError(): AppError {
  return new AppError(
    BizCode.SYSTEM_STORAGE_UNAVAILABLE,
    "头像存储不可用",
    503,
  );
}
