import { config } from "@repo/eslint-config/base";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: [".wrangler/**", "worker-configuration.d.ts"] },
  ...config,
];
