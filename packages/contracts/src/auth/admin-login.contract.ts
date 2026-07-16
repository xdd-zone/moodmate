import { z } from "zod";

const AdminPasswordSchema = z.string().superRefine((value, context) => {
  const length = Array.from(value).length;

  if (length < 8 || length > 128) {
    context.addIssue({
      code: "custom",
      message: "密码长度必须为 8 到 128 个字符",
    });
  }
});

export const AdminPasswordLoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: AdminPasswordSchema,
});

export type AdminPasswordLoginRequest = z.infer<
  typeof AdminPasswordLoginRequestSchema
>;
