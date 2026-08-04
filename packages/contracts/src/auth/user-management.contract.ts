import { z } from "zod";

import { createPasswordLoginRequestSchema } from "./password-login.contract";

const passwordSchema = createPasswordLoginRequestSchema().shape.password;

export const UserStatusSchema = z.enum(["active", "suspended", "deleted"]);

export const UserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  keyword: z.string().trim().max(120).optional(),
  status: UserStatusSchema.exclude(["deleted"]).optional(),
});

export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const UserRoleSchema = z.object({
  applicationCode: z.string().min(1),
  code: z.string().min(1),
  id: z.uuid(),
  name: z.string().min(1),
});

export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserListItemSchema = z.object({
  createdAtMs: z.number().int().nonnegative(),
  displayName: z.string().min(1),
  email: z.email(),
  id: z.uuid(),
  lastLoginAtMs: z.number().int().nonnegative().nullable(),
  roles: z.array(UserRoleSchema),
  status: UserStatusSchema,
  lastActiveAtMs: z.number().int().nonnegative().nullable(),
  messageCount: z.number().int().nonnegative(),
  directMessageCount: z.number().int().nonnegative(),
  groupMessageCount: z.number().int().nonnegative(),
  friendCount: z.number().int().nonnegative(),
  groupChatCount: z.number().int().nonnegative(),
});

export type UserListItem = z.infer<typeof UserListItemSchema>;

export const UserListResponseSchema = z.object({
  items: z.array(UserListItemSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export type UserListResponse = z.infer<typeof UserListResponseSchema>;

export const UserCreateRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: passwordSchema,
  roleId: z.uuid(),
});

export type UserCreateRequest = z.infer<typeof UserCreateRequestSchema>;

export const UserMutationResponseSchema = z.object({
  user: UserListItemSchema,
});

export type UserMutationResponse = z.infer<typeof UserMutationResponseSchema>;
