import type { BizCodeValue } from "@repo/contracts";

export type HttpErrorKind = "api" | "http" | "invalid-response" | "network";

export type HttpRequestErrorOptions = {
  cause?: unknown;
  code?: BizCodeValue;
  details?: unknown;
  kind: HttpErrorKind;
  requestId?: string;
  status?: number;
};

export class HttpRequestError extends Error {
  readonly code?: BizCodeValue;
  readonly details?: unknown;
  readonly kind: HttpErrorKind;
  readonly requestId?: string;
  readonly status?: number;

  constructor(message: string, options: HttpRequestErrorOptions) {
    super(message, { cause: options.cause });

    this.name = "HttpRequestError";
    this.code = options.code;
    this.details = options.details;
    this.kind = options.kind;
    this.requestId = options.requestId;
    this.status = options.status;
  }
}
