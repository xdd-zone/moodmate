import { z } from "zod";

export const RoleStatusSchema = z.enum(["active", "disabled", "deleted"]);

export const RoleSchema = z.object({
  applicationCode: z.string().min(1),
  code: z.string().min(1),
  createdAtMs: z.number().int().positive(),
  deletedAtMs: z.number().int().positive().nullable(),
  disabledAtMs: z.number().int().positive().nullable(),
  id: z.uuid(),
  isProtected: z.boolean(),
  name: z.string().min(1),
  status: RoleStatusSchema,
  updatedAtMs: z.number().int().positive(),
});

export type Role = z.infer<typeof RoleSchema>;

export const RoleListResponseSchema = z.object({
  items: z.array(RoleSchema),
});

export type RoleListResponse = z.infer<typeof RoleListResponseSchema>;

export const RoleCreateRequestSchema = z.object({
  applicationCode: z.string().trim().min(1).max(64),
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_:-]*$/u, "角色 code 格式无效"),
  name: z.string().trim().min(1).max(128),
});

export type RoleCreateRequest = z.infer<typeof RoleCreateRequestSchema>;

export const RoleMutationResponseSchema = z.object({
  role: RoleSchema,
});

export type RoleMutationResponse = z.infer<typeof RoleMutationResponseSchema>;
