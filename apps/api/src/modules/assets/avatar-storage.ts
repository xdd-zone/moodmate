import { BizCode, DEFAULT_AVATAR_MAX_BYTES } from "@repo/contracts";

import { AppError } from "@/shared/app-error";

const AVATAR_CACHE_CONTROL = "public, max-age=31536000, immutable";

const avatarExtensionByMimeType = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AvatarMimeType = keyof typeof avatarExtensionByMimeType;
export type AvatarExtension =
  (typeof avatarExtensionByMimeType)[AvatarMimeType];

export function assertAvatarFile(file: File): {
  contentType: AvatarMimeType;
  extension: AvatarExtension;
} {
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

  if (file.size > DEFAULT_AVATAR_MAX_BYTES) {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "头像文件不能超过 2 MiB",
      413,
    );
  }

  return {
    contentType: file.type,
    extension: avatarExtensionByMimeType[file.type],
  };
}

export function requireAvatarBucket(bucket: R2Bucket | undefined): R2Bucket {
  if (!bucket) {
    throw storageUnavailableError();
  }

  return bucket;
}

export async function putAvatarObject(input: {
  bucket: R2Bucket;
  file: File;
  fileName: string;
  key: string;
}): Promise<void> {
  try {
    await input.bucket.put(input.key, await input.file.arrayBuffer(), {
      httpMetadata: {
        cacheControl: AVATAR_CACHE_CONTROL,
        contentDisposition: `inline; filename="${input.fileName}"`,
        contentType: input.file.type,
      },
    });
  } catch (error) {
    console.error("写入 R2 头像失败", error);
    throw storageUnavailableError();
  }
}

export async function getAvatarObject(
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

export async function deleteAvatarObject(
  bucket: R2Bucket,
  key: string,
  failureMessage: string,
): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (error) {
    console.error(failureMessage, error);
  }
}

function isAvatarMimeType(value: string): value is AvatarMimeType {
  return Object.hasOwn(avatarExtensionByMimeType, value);
}

function storageUnavailableError(): AppError {
  return new AppError(
    BizCode.SYSTEM_STORAGE_UNAVAILABLE,
    "头像存储不可用",
    503,
  );
}
