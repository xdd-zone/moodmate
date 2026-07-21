import { z } from "zod";

export function createPasswordLoginRequestSchema() {
  const passwordSchema = z.string().superRefine((value, context) => {
    const length = Array.from(value).length;

    if (length < 8 || length > 128) {
      context.addIssue({
        code: "custom",
        message: "密码长度必须为 8 到 128 个字符",
      });
    }
  });

  return z.object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: passwordSchema,
  });
}
