import {
  AdminProfileSchema,
  BizCode,
  PersonalAvatarKeySchema,
  type AdminProfile,
  type AdminProfileAvatarUploadResponse,
} from "@repo/contracts";
import { uuidv7 } from "uuidv7";

import {
  deleteAvatarObject,
  getAvatarObject,
  putAvatarObject,
  requireAvatarBucket,
  assertAvatarFile,
} from "@/modules/assets/avatar-storage";
import { findCurrentDefaultAvatarVersion } from "@/modules/assets/assets.repository";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import { presentAdminProfile } from "./profile.presenter";
import {
  findAdminProfile,
  findUserAvatarAsset,
  upsertUserAvatarAsset,
} from "./profile.repository";

export async function getAdminProfile(input: {
  bindings: ApiBindings;
  userId: string;
}): Promise<AdminProfile> {
  const [profile, personalAvatar, defaultAvatar] = await Promise.all([
    findAdminProfile(input.bindings.DB, input.userId),
    findUserAvatarAsset(input.bindings.DB, input.userId),
    findCurrentDefaultAvatarVersion(input.bindings.DB),
  ]);

  if (!profile) {
    throw new AppError(BizCode.AUTH_FORBIDDEN, "管理员资料不可用", 403);
  }

  const avatar = personalAvatar
    ? { key: personalAvatar.avatarKey, source: "personal" as const }
    : defaultAvatar
      ? { key: defaultAvatar.avatarKey, source: "default" as const }
      : null;

  return AdminProfileSchema.parse(presentAdminProfile(profile, avatar));
}

export async function uploadAdminProfileAvatar(input: {
  bindings: ApiBindings;
  file: File;
  userId: string;
}): Promise<AdminProfileAvatarUploadResponse> {
  const { contentType, extension } = assertAvatarFile(input.file);
  const bucket = requireAvatarBucket(input.bindings.AVATAR_BUCKET);
  const previous = await findUserAvatarAsset(input.bindings.DB, input.userId);
  const nowMs = Date.now();
  const avatarKey = `avatars/users/${input.userId}/${nowMs}-${uuidv7()}.${extension}`;
  const fileName = input.file.name || `personal-avatar.${extension}`;

  await putAvatarObject({
    bucket,
    file: input.file,
    fileName: `personal-avatar.${extension}`,
    key: avatarKey,
  });

  try {
    await upsertUserAvatarAsset(input.bindings.DB, {
      avatarKey,
      contentType,
      createdAtMs: nowMs,
      fileName,
      id: uuidv7(),
      sizeBytes: input.file.size,
      userId: input.userId,
    });
  } catch (error) {
    await deleteAvatarObject(
      bucket,
      avatarKey,
      "清理未写入元数据的个人头像失败",
    );
    throw error;
  }

  if (previous && previous.avatarKey !== avatarKey) {
    await deleteAvatarObject(
      bucket,
      previous.avatarKey,
      "清理已替换的个人头像失败",
    );
  }

  return { key: avatarKey, updatedAtMs: nowMs };
}

export async function getAdminProfileAvatar(input: {
  bindings: ApiBindings;
  key: string;
  userId: string;
}): Promise<R2ObjectBody> {
  const allowed = PersonalAvatarKeySchema.safeParse(input.key).success
    ? (await findUserAvatarAsset(input.bindings.DB, input.userId))
        ?.avatarKey === input.key
    : (await findCurrentDefaultAvatarVersion(input.bindings.DB))?.avatarKey ===
      input.key;

  if (!allowed) {
    throw new AppError(BizCode.AUTH_FORBIDDEN, "不能读取该头像", 403);
  }

  return getAvatarObject(input.bindings.AVATAR_BUCKET, input.key);
}
