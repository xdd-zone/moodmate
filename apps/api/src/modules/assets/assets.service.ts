import {
  BizCode,
  type AdminDefaultAvatarCurrentResponse,
  type AdminDefaultAvatarHistoryResponse,
  type AdminDefaultAvatarSetCurrentResponse,
  type AdminDefaultAvatarUploadResponse,
  type AdminDefaultAvatarVersion,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import {
  assertAvatarFile,
  deleteAvatarObject,
  getAvatarObject,
  putAvatarObject,
  requireAvatarBucket,
  type AvatarExtension,
} from "./avatar-storage";
import {
  findCurrentDefaultAvatarVersion,
  insertCurrentDefaultAvatarVersion,
  listDefaultAvatarVersions,
  setCurrentDefaultAvatarVersion,
} from "./assets.repository";
import type { DefaultAvatarVersionRecord } from "./assets.schema";

export async function uploadDefaultAvatar(input: {
  bindings: ApiBindings;
  createdByUserId: string;
  file: File;
}): Promise<AdminDefaultAvatarUploadResponse> {
  const { contentType, extension } = assertAvatarFile(input.file);
  const nowMs = Date.now();
  const avatarKey = buildDefaultAvatarKey(nowMs, extension);
  const bucket = requireAvatarBucket(input.bindings.AVATAR_BUCKET);
  const fileName = input.file.name || `default-avatar.${extension}`;

  await putAvatarObject({
    bucket,
    file: input.file,
    fileName: `default-avatar.${extension}`,
    key: avatarKey,
  });

  try {
    await insertCurrentDefaultAvatarVersion(input.bindings.DB, {
      avatarKey,
      contentType,
      createdAtMs: nowMs,
      createdByUserId: input.createdByUserId,
      fileName,
      id: uuidv7(),
      isCurrent: true,
      sizeBytes: input.file.size,
    });
  } catch (error) {
    await deleteAvatarObject(
      bucket,
      avatarKey,
      "清理未写入元数据的 R2 头像失败",
    );
    throw error;
  }

  return {
    key: avatarKey,
    updatedAtMs: nowMs,
  };
}

export async function getCurrentDefaultAvatar(
  database: D1Database | undefined,
): Promise<AdminDefaultAvatarCurrentResponse> {
  const version = await findCurrentDefaultAvatarVersion(database);

  return { version: version ? toDefaultAvatarVersion(version) : null };
}

export async function getDefaultAvatarHistory(
  database: D1Database | undefined,
): Promise<AdminDefaultAvatarHistoryResponse> {
  const versions = await listDefaultAvatarVersions(database);

  return { items: versions.map(toDefaultAvatarVersion) };
}

export async function setCurrentDefaultAvatar(input: {
  database: D1Database | undefined;
  versionId: string;
}): Promise<AdminDefaultAvatarSetCurrentResponse> {
  const version = await setCurrentDefaultAvatarVersion(
    input.database,
    input.versionId,
  );

  if (!version) {
    throw new AppError(BizCode.COMMON_NOT_FOUND, "默认头像版本不存在", 404);
  }

  return { version: toDefaultAvatarVersion(version) };
}

export async function getDefaultAvatar(
  bucketBinding: R2Bucket | undefined,
  key: string,
): Promise<R2ObjectBody> {
  return getAvatarObject(bucketBinding, key);
}

function buildDefaultAvatarKey(
  nowMs: number,
  extension: AvatarExtension,
): string {
  return `avatars/default/${nowMs}-${uuidv7()}.${extension}`;
}

function toDefaultAvatarVersion(
  record: DefaultAvatarVersionRecord,
): AdminDefaultAvatarVersion {
  return {
    contentType: record.contentType,
    createdAtMs: record.createdAtMs,
    fileName: record.fileName,
    id: record.id,
    isCurrent: record.isCurrent,
    key: record.avatarKey,
    sizeBytes: record.sizeBytes,
  };
}
