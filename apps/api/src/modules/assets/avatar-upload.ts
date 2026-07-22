import { BizCode } from "@repo/contracts";

import { AppError } from "@/shared/app-error";

export async function readAvatarFile(request: Request): Promise<File> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    throw new AppError(
      BizCode.COMMON_INVALID_REQUEST,
      "头像上传请求必须使用 multipart/form-data",
      400,
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new AppError(BizCode.COMMON_INVALID_REQUEST, "缺少头像文件", 400);
  }

  return file;
}
