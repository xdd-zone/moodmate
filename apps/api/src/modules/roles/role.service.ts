import {
  BizCode,
  type RoleCreateRequest,
  type RoleListResponse,
  type RoleMutationResponse,
} from "@repo/contracts";

import { AppError } from "@/shared/app-error";
import type { ApiBindings } from "@/shared/hono-env";

import {
  findActiveApplication,
  findRoleByApplicationAndCode,
  findRoleById,
  findRoleList,
  insertRole,
  updateRoleStatus,
} from "./role.repository";
import { canManageRoles, isProtectedRole } from "./role-policy";
import { presentRole } from "./role.presenter";

export async function listRoles(
  bindings: ApiBindings,
  adminRoles: readonly string[],
): Promise<RoleListResponse> {
  assertCanManageRoles(adminRoles);
  const rows = await findRoleList(bindings.DB);

  return { items: rows.map((row) => presentRole(row)) };
}

export async function createRole(input: {
  bindings: ApiBindings;
  payload: RoleCreateRequest;
  adminRoles: readonly string[];
}): Promise<RoleMutationResponse> {
  assertCanManageRoles(input.adminRoles);
  const application = await findActiveApplication(
    input.bindings.DB,
    input.payload.applicationCode,
  );

  if (!application) {
    throw new AppError(
      BizCode.ROLE_APPLICATION_NOT_FOUND,
      "应用不存在或已停用",
      404,
    );
  }

  const existing = await findRoleByApplicationAndCode(
    input.bindings.DB,
    application.id,
    input.payload.code,
  );

  if (existing) {
    throw new AppError(
      BizCode.ROLE_CODE_CONFLICT,
      "该应用下的角色 code 已存在",
      409,
    );
  }

  const nowMs = Date.now();
  let roleId: string;
  try {
    roleId = await insertRole({
      applicationId: application.id,
      code: input.payload.code,
      database: input.bindings.DB,
      name: input.payload.name,
      nowMs,
    });
  } catch (error) {
    if (isRoleCodeConflict(error)) {
      throw new AppError(
        BizCode.ROLE_CODE_CONFLICT,
        "该应用下的角色 code 已存在",
        409,
      );
    }

    throw error;
  }
  const role = await findRoleById(input.bindings.DB, roleId);

  if (!role) {
    throw new AppError(BizCode.ROLE_NOT_FOUND, "角色创建后读取失败", 500);
  }

  return { role: presentRole(role) };
}

export async function disableRole(input: {
  bindings: ApiBindings;
  roleId: string;
  adminRoles: readonly string[];
}): Promise<RoleMutationResponse> {
  return updateRole(input, "disabled");
}

export async function deleteRole(input: {
  bindings: ApiBindings;
  roleId: string;
  adminRoles: readonly string[];
}): Promise<RoleMutationResponse> {
  return updateRole(input, "deleted");
}

async function updateRole(
  input: {
    bindings: ApiBindings;
    roleId: string;
    adminRoles: readonly string[];
  },
  status: "disabled" | "deleted",
): Promise<RoleMutationResponse> {
  assertCanManageRoles(input.adminRoles);
  const role = await findRoleById(input.bindings.DB, input.roleId);

  if (!role) {
    throw new AppError(BizCode.ROLE_NOT_FOUND, "角色不存在", 404);
  }

  if (isProtectedRole(role.code)) {
    throw new AppError(BizCode.ROLE_PROTECTED, "内建角色不能禁用或删除", 403);
  }

  const nowMs = Date.now();
  await updateRoleStatus({
    database: input.bindings.DB,
    roleId: input.roleId,
    status,
    nowMs,
  });
  const updatedRole = await findRoleById(input.bindings.DB, input.roleId);

  if (status === "deleted") {
    return {
      role: presentRole({
        ...role,
        deletedAtMs: nowMs,
        status,
        updatedAtMs: nowMs,
      }),
    };
  }

  if (!updatedRole) {
    throw new AppError(BizCode.ROLE_NOT_FOUND, "角色更新后读取失败", 500);
  }

  return { role: presentRole(updatedRole) };
}

function assertCanManageRoles(adminRoles: readonly string[]) {
  if (!canManageRoles(adminRoles)) {
    throw new AppError(BizCode.AUTH_FORBIDDEN, "没有角色管理权限", 403);
  }
}

function isRoleCodeConflict(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("roles_application_code_unique") ||
      error.message.includes("roles.application_id, roles.code"))
  );
}
