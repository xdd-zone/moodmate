"use client";

import {
  DEFAULT_LLM_CONFIG_API,
  LlmConfigApiSchema,
  LlmConfigCreateRequestSchema,
  type LlmConfigCreateRequest,
  type LlmConfigApi,
  type LlmConfigItem,
  type LlmConfigTestCheckId,
  type LlmConfigTestResponse,
  type LlmConfigUpdateRequest,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Input } from "@repo/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  Plug,
  Plus,
  Power,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  activateAdminLlmConfig,
  createAdminLlmConfig,
  deleteAdminLlmConfig,
  testAdminLlmConfig,
  updateAdminLlmConfig,
} from "@/src/api/llm-configs.api";
import {
  adminLlmConfigKeys,
  adminLlmConfigsQueryOptions,
} from "@/src/api/llm-configs.query";
import { Drawer } from "@/src/components/ui/drawer";

const LLM_API_OPTIONS: ReadonlyArray<{
  label: string;
  value: LlmConfigApi;
}> = [
  { label: "OpenAI Chat Completions", value: "openai-chat-completions" },
  { label: "Anthropic Messages", value: "anthropic-messages" },
  { label: "OpenAI Responses", value: "openai-responses" },
];

function getLlmApiLabel(api: LlmConfigApi): string {
  return LLM_API_OPTIONS.find((option) => option.value === api)?.label ?? api;
}

function getLlmApiBaseUrlPlaceholder(api: LlmConfigApi): string {
  return api === "anthropic-messages"
    ? "https://api.anthropic.com"
    : "https://api.openai.com/v1";
}

/** 只有这两种协议有受控的思考开关：chat-completions 走 thinking，responses 走 reasoning.effort。 */
function supportsThinkingControl(api: LlmConfigApi): boolean {
  return api === "openai-chat-completions" || api === "openai-responses";
}

const TEST_CHECK_LABELS: Record<LlmConfigTestCheckId, string> = {
  connectivity: "连通性",
  streaming: "流式输出",
  json_schema: "结构化输出 json_schema",
  function: "结构化输出 function",
  json_object: "结构化输出 json_object",
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

export function LlmConfigsPage() {
  const queryClient = useQueryClient();
  const configsQuery = useQuery(adminLlmConfigsQueryOptions());
  const [drawerConfig, setDrawerConfig] = useState<LlmConfigItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  async function invalidateConfigs() {
    await queryClient.invalidateQueries({ queryKey: adminLlmConfigKeys.all });
  }

  const activateMutation = useMutation({
    mutationFn: activateAdminLlmConfig,
    onError: (error) => {
      setActionError(toErrorMessage(error, "激活配置失败，请稍后重试"));
    },
    onSuccess: async () => {
      setActionError("");
      await invalidateConfigs();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminLlmConfig,
    onError: (error) => {
      setActionError(toErrorMessage(error, "删除配置失败，请稍后重试"));
    },
    onSuccess: async () => {
      setActionError("");
      await invalidateConfigs();
    },
  });

  const configs = configsQuery.data?.items ?? [];

  function isConfigPending(id: string) {
    return (
      (activateMutation.isPending && activateMutation.variables === id) ||
      (deleteMutation.isPending && deleteMutation.variables === id)
    );
  }

  function handleActivate(config: LlmConfigItem) {
    if (config.isActive) return;
    activateMutation.mutate(config.id);
  }

  function handleDelete(config: LlmConfigItem) {
    if (!window.confirm(`删除模型配置“${config.name}”？该操作不可恢复。`)) {
      return;
    }
    deleteMutation.mutate(config.id);
  }

  function openCreate() {
    setDrawerConfig(null);
    setDrawerOpen(true);
  }

  function openEdit(config: LlmConfigItem) {
    setDrawerConfig(config);
    setDrawerOpen(true);
  }

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">模型配置</h1>
          <p className="mt-1 text-xs leading-6 text-muted sm:text-sm">
            管理模型协议与连接参数，激活的配置用于用户端聊天与安全意图分析
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={openCreate} size="sm" type="button">
            <Plus className="size-4" />
            新建配置
          </Button>
        </div>
      </div>

      {actionError ? (
        <p
          className="mb-4 rounded-md border border-danger bg-surface px-4 py-3 text-xs text-danger"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}

      {configsQuery.isError ? (
        <Card className="flex flex-col items-start gap-3 p-5">
          <p className="text-sm text-danger" role="alert">
            {toErrorMessage(configsQuery.error, "配置列表加载失败，请稍后重试")}
          </p>
          <Button
            onClick={() => void configsQuery.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="size-4" />
            重试
          </Button>
        </Card>
      ) : configsQuery.isPending ? (
        <Card className="p-5">
          <p className="text-sm text-muted">正在加载配置列表…</p>
        </Card>
      ) : configs.length === 0 ? (
        <Card className="flex flex-col items-start gap-3 p-8">
          <p className="text-sm font-medium">还没有模型配置</p>
          <p className="max-w-md text-xs leading-5 text-muted">
            新建一条 OpenAI 协议配置并激活后，用户端聊天才能使用。
          </p>
          <Button onClick={openCreate} size="sm" type="button">
            <Plus className="size-4" />
            新建配置
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {configs.map((config) => (
            <ConfigCard
              config={config}
              isPending={isConfigPending(config.id)}
              key={config.id}
              onActivate={() => handleActivate(config)}
              onDelete={() => handleDelete(config)}
              onEdit={() => openEdit(config)}
            />
          ))}
        </div>
      )}

      <ConfigDrawer
        config={drawerConfig}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
      />
    </section>
  );
}

function ConfigCard({
  config,
  isPending,
  onActivate,
  onDelete,
  onEdit,
}: {
  config: LlmConfigItem;
  isPending: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-start gap-4 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{config.name}</span>
          {config.isActive ? (
            <Badge variant="secondary">
              <CheckCircle2 className="size-3" />
              已激活
            </Badge>
          ) : (
            <Badge variant="outline">未激活</Badge>
          )}
          {supportsThinkingControl(config.api) && config.disableThinking ? (
            <Badge variant="outline">禁用 thinking</Badge>
          ) : null}
        </div>
        <dl className="mt-2 grid gap-1 text-xs text-muted">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">协议</dt>
            <dd className="min-w-0 break-words">
              {getLlmApiLabel(config.api)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">Provider</dt>
            <dd className="min-w-0 break-words">{config.providerName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">Base URL</dt>
            <dd className="min-w-0 break-all">{config.baseURL}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">Model</dt>
            <dd className="min-w-0 break-words">{config.model}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">API Key</dt>
            <dd className="min-w-0 tabular-nums">
              {config.apiKeyLast4 ? `••••${config.apiKeyLast4}` : "已保存"}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">更新时间</dt>
            <dd className="min-w-0 tabular-nums">
              {formatTime(config.updatedAtMs)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-wrap gap-2">
        {config.isActive ? null : (
          <Button
            disabled={isPending}
            onClick={onActivate}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Power className="size-4" />
            激活
          </Button>
        )}
        <Button
          disabled={isPending}
          onClick={onEdit}
          size="sm"
          type="button"
          variant="outline"
        >
          编辑
        </Button>
        <Button
          disabled={isPending}
          onClick={onDelete}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Trash2 className="size-4" />
          删除
        </Button>
      </div>
    </Card>
  );
}

interface ConfigFormState {
  api: LlmConfigApi;
  name: string;
  providerName: string;
  baseURL: string;
  model: string;
  apiKey: string;
  disableThinking: boolean;
}

function createFormState(config: LlmConfigItem | null): ConfigFormState {
  return {
    api: config?.api ?? DEFAULT_LLM_CONFIG_API,
    apiKey: "",
    baseURL: config?.baseURL ?? "",
    disableThinking: config?.disableThinking ?? false,
    model: config?.model ?? "",
    name: config?.name ?? "",
    providerName: config?.providerName ?? "OpenAI",
  };
}

function ConfigDrawer({
  config,
  onClose,
  open,
}: {
  config: LlmConfigItem | null;
  onClose: () => void;
  open: boolean;
}) {
  const queryClient = useQueryClient();
  const nameRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ConfigFormState>(() =>
    createFormState(config),
  );
  const [formError, setFormError] = useState("");
  const [testResult, setTestResult] = useState<
    | { kind: "error"; message: string }
    | { kind: "result"; response: LlmConfigTestResponse }
    | null
  >(null);
  const isEdit = config !== null;

  const saveMutation = useMutation({
    mutationFn: (input: {
      create?: LlmConfigCreateRequest;
      update?: { id: string; payload: LlmConfigUpdateRequest };
    }) => {
      if (input.update) {
        return updateAdminLlmConfig(input.update.id, input.update.payload);
      }
      return createAdminLlmConfig(input.create!);
    },
    onError: (error) => {
      setFormError(toErrorMessage(error, "保存配置失败，请稍后重试"));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminLlmConfigKeys.all });
      onClose();
    },
  });

  const testMutation = useMutation({
    mutationFn: testAdminLlmConfig,
    onError: (error) => {
      setTestResult({
        kind: "error",
        message: toErrorMessage(error, "模型测试失败，请稍后重试"),
      });
    },
    onSuccess: (response) => {
      setTestResult({ kind: "result", response });
    },
  });

  useEffect(() => {
    if (!open) return;
    setForm(createFormState(config));
    setFormError("");
    setTestResult(null);
    setTimeout(() => nameRef.current?.focus(), 220);
  }, [open, config]);

  function updateField<Key extends keyof ConfigFormState>(
    key: Key,
    value: ConfigFormState[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setTestResult(null);
  }

  function buildCreatePayload(): LlmConfigCreateRequest | null {
    const parsed = LlmConfigCreateRequestSchema.safeParse({
      api: form.api,
      apiKey: form.apiKey,
      baseURL: form.baseURL,
      ...(supportsThinkingControl(form.api)
        ? { disableThinking: form.disableThinking }
        : {}),
      model: form.model,
      name: form.name,
      providerName: form.providerName,
    });

    if (!parsed.success) {
      setFormError("请填写有效的名称、Provider、Base URL、Model 和 API Key。");
      return null;
    }

    return parsed.data;
  }

  function buildUpdatePayload(): LlmConfigUpdateRequest | null {
    const trimmedName = form.name.trim();
    const trimmedProvider = form.providerName.trim();
    const trimmedBaseURL = form.baseURL.trim();
    const trimmedModel = form.model.trim();
    const trimmedApiKey = form.apiKey.trim();

    if (!trimmedName || !trimmedProvider || !trimmedBaseURL || !trimmedModel) {
      setFormError("名称、Provider、Base URL 和 Model 不能为空。");
      return null;
    }

    const payload: LlmConfigUpdateRequest = {
      api: form.api,
      baseURL: trimmedBaseURL,
      ...(supportsThinkingControl(form.api)
        ? { disableThinking: form.disableThinking }
        : {}),
      model: trimmedModel,
      name: trimmedName,
      providerName: trimmedProvider,
    };

    if (trimmedApiKey) {
      payload.apiKey = trimmedApiKey;
    }

    return payload;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveMutation.isPending) return;

    setFormError("");

    if (isEdit && config) {
      const payload = buildUpdatePayload();
      if (!payload) return;
      saveMutation.mutate({ update: { id: config.id, payload } });
      return;
    }

    const payload = buildCreatePayload();
    if (!payload) return;
    saveMutation.mutate({ create: payload });
  }

  function handleTest() {
    setTestResult(null);
    setFormError("");

    const trimmedApiKey = form.apiKey.trim();

    if (
      !form.baseURL.trim() ||
      !form.model.trim() ||
      !form.providerName.trim()
    ) {
      setFormError("测试前请填写 Provider、Base URL 和 Model。");
      return;
    }

    if (!trimmedApiKey && !config) {
      setFormError("测试前请填写 API Key。");
      return;
    }

    testMutation.mutate({
      api: form.api,
      baseURL: form.baseURL.trim(),
      model: form.model.trim(),
      providerName: form.providerName.trim(),
      ...(supportsThinkingControl(form.api)
        ? { disableThinking: form.disableThinking }
        : {}),
      ...(trimmedApiKey ? { apiKey: trimmedApiKey } : {}),
      ...(config ? { configId: config.id } : {}),
    });
  }

  return (
    <Drawer
      ariaDescribedby="llm-config-desc"
      ariaLabelledby="llm-config-title"
      description="支持 OpenAI Chat Completions、Anthropic Messages 和 OpenAI Responses。"
      maxWidth="max-w-[30rem]"
      onClose={onClose}
      open={open}
      title={isEdit ? "编辑模型配置" : "新建模型配置"}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <FormField htmlFor="configApi" label="协议">
            <div className="relative">
              <select
                className="h-9 w-full appearance-none rounded-md border border-border bg-background pr-8 pl-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus"
                id="configApi"
                onChange={(event) =>
                  updateField(
                    "api",
                    LlmConfigApiSchema.parse(event.target.value),
                  )
                }
                value={form.api}
              >
                {LLM_API_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted" />
            </div>
          </FormField>

          <FormField htmlFor="configName" label="配置名称">
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              id="configName"
              maxLength={80}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="例如：生产 DeepSeek"
              ref={nameRef}
              value={form.name}
            />
          </FormField>

          <FormField htmlFor="configProvider" label="Provider">
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              id="configProvider"
              maxLength={80}
              onChange={(event) =>
                updateField("providerName", event.target.value)
              }
              placeholder="例如：OpenAI、DeepSeek、GLM"
              value={form.providerName}
            />
          </FormField>

          <FormField htmlFor="configBaseUrl" label="Base URL">
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              id="configBaseUrl"
              maxLength={300}
              onChange={(event) => updateField("baseURL", event.target.value)}
              placeholder={getLlmApiBaseUrlPlaceholder(form.api)}
              value={form.baseURL}
            />
          </FormField>

          <FormField htmlFor="configModel" label="Model">
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              id="configModel"
              maxLength={120}
              onChange={(event) => updateField("model", event.target.value)}
              placeholder="例如：deepseek-chat"
              value={form.model}
            />
          </FormField>

          <FormField
            htmlFor="configApiKey"
            label={isEdit ? "API Key（留空不修改）" : "API Key"}
          >
            <Input
              autoComplete="off"
              className="bg-background text-xs"
              id="configApiKey"
              maxLength={400}
              onChange={(event) => updateField("apiKey", event.target.value)}
              placeholder={isEdit ? "留空则沿用已保存的 Key" : "输入 API Key"}
              type="password"
              value={form.apiKey}
            />
          </FormField>

          {supportsThinkingControl(form.api) ? (
            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-xs font-medium">禁用 thinking</span>
                <span className="mt-0.5 block text-[0.6875rem] leading-4 text-muted">
                  对支持 thinking 的模型（如 DeepSeek）关闭思考输出。
                </span>
              </span>
              <input
                checked={form.disableThinking}
                className="size-4 accent-primary"
                onChange={(event) =>
                  updateField("disableThinking", event.currentTarget.checked)
                }
                type="checkbox"
              />
            </label>
          ) : null}

          <div className="rounded-md border border-border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block text-xs font-medium">模型能力测试</span>
                <span className="mt-0.5 block text-[0.6875rem] leading-4 text-muted">
                  依次检测连通性、流式输出和三种结构化输出方法。
                </span>
              </span>
              <Button
                disabled={testMutation.isPending}
                onClick={handleTest}
                size="sm"
                type="button"
                variant="outline"
              >
                <Plug className="size-4" />
                {testMutation.isPending ? "测试中…" : "开始测试"}
              </Button>
            </div>
            {testResult?.kind === "error" ? (
              <p
                className="mt-2 text-[0.6875rem] leading-4 text-danger"
                role="alert"
              >
                {testResult.message}
              </p>
            ) : null}
            {testResult?.kind === "result" ? (
              <div className="mt-2" role="status">
                <p
                  className={`text-[0.6875rem] leading-4 ${
                    testResult.response.ok ? "text-success" : "text-danger"
                  }`}
                >
                  {testResult.response.message}
                  {testResult.response.latencyMs !== undefined
                    ? `（共 ${testResult.response.latencyMs}ms）`
                    : ""}
                </p>
                {testResult.response.checks.length > 0 ? (
                  <ul className="mt-2 grid gap-1">
                    {testResult.response.checks.map((check) => (
                      <li
                        className="flex items-start gap-1.5 text-[0.6875rem] leading-4"
                        key={check.id}
                      >
                        {check.ok ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-px size-3 shrink-0 text-success"
                          />
                        ) : (
                          <X
                            aria-hidden="true"
                            className="mt-px size-3 shrink-0 text-danger"
                          />
                        )}
                        <span className="min-w-0">
                          {TEST_CHECK_LABELS[check.id]}
                          <span className="text-muted">
                            {check.latencyMs !== undefined
                              ? ` ${check.latencyMs}ms`
                              : ""}
                            {check.ok ? "" : ` — ${check.message ?? "不支持"}`}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="min-h-4 text-[0.6875rem] text-danger" role="alert">
            {formError}
          </p>
        </div>

        <footer className="flex gap-2.5 border-t border-border p-5">
          <Button
            className="flex-1"
            onClick={onClose}
            size="sm"
            type="button"
            variant="secondary"
          >
            取消
          </Button>
          <Button
            className="flex-1"
            disabled={saveMutation.isPending}
            size="sm"
            type="submit"
          >
            {saveMutation.isPending
              ? "保存中…"
              : isEdit
                ? "保存修改"
                : "创建配置"}
          </Button>
        </footer>
      </form>
    </Drawer>
  );
}

function FormField({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-[0.6875rem] font-semibold text-muted"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
