import {
  BizCode,
  type UserCreateRequest,
  type UserListQuery,
  type UserListResponse,
  type UserMutationResponse,
} from "@repo/contracts";

import { hashPassword } from "@/modules/auth/password";
import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import { presentUser, presentUserList } from "./user.presenter";
import {
  findAssignableRoleById,
  findUserByNormalizedEmail,
  findUserList,
  insertUserWithPassword,
} from "./user.repository";

export async function listUsers(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  query: UserListQuery;
}): Promise<UserListResponse> {
  assertCanManageUsers(input.adminRoles);
  const result = await findUserList(input.bindings.DB, {
    ...(input.query.keyword ? { keyword: input.query.keyword } : {}),
    limit: input.query.pageSize,
    offset: (input.query.page - 1) * input.query.pageSize,
    ...(input.query.status ? { status: input.query.status } : {}),
  });

  return {
    items: presentUserList(result.items, result.roleRows),
    page: input.query.page,
    pageSize: input.query.pageSize,
    total: result.total,
    totalPages:
      result.total === 0 ? 0 : Math.ceil(result.total / input.query.pageSize),
  };
}

export async function createUser(input: {
  adminRoles: readonly string[];
  bindings: ApiBindings;
  payload: UserCreateRequest;
}): Promise<UserMutationResponse> {
  assertCanManageUsers(input.adminRoles);
  const existingEmail = await findUserByNormalizedEmail(
    input.bindings.DB,
    input.payload.email,
  );

  if (existingEmail) {
    throwEmailConflict();
  }

  const role = await findAssignableRoleById(
    input.bindings.DB,
    input.payload.roleId,
  );

  if (!role) {
    throw new AppError(BizCode.USER_ROLE_NOT_FOUND, "角色不存在或已停用", 404);
  }

  const nowMs = Date.now();
  const passwordHash = await hashPassword(input.payload.password);
  let userId: string;

  try {
    userId = await insertUserWithPassword({
      database: input.bindings.DB,
      displayName: input.payload.displayName,
      email: input.payload.email,
      normalizedEmail: input.payload.email,
      nowMs,
      passwordHash,
      roleId: role.id,
    });
  } catch (error) {
    if (isEmailConflict(error)) {
      throwEmailConflict();
    }

    throw error;
  }

  return {
    user: presentUser(
      {
        createdAtMs: nowMs,
        displayName: input.payload.displayName,
        email: input.payload.email,
        id: userId,
        lastLoginAtMs: null,
        status: "active",
        lastActiveAtMs: null,
        messageCount: 0,
        directMessageCount: 0,
        groupMessageCount: 0,
        friendCount: 0,
        groupChatCount: 0,
      },
      [role],
    ),
  };
}

function assertCanManageUsers(adminRoles: readonly string[]) {
  if (!adminRoles.includes("admin_owner")) {
    throw new AppError(BizCode.AUTH_FORBIDDEN, "没有用户管理权限", 403);
  }
}

function throwEmailConflict(): never {
  throw new AppError(BizCode.USER_EMAIL_CONFLICT, "该邮箱已存在", 409);
}

function isEmailConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    message.includes("user_emails_normalized_unique") ||
    message.includes("user_emails.normalized_email")
  );
}
