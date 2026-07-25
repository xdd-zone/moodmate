"use client";

import type { CreateUserAgentRequest, UserAgent } from "@repo/contracts";
import { Button } from "@repo/ui/button";
import { Field, FieldControl, FieldLabel } from "@repo/ui/field";
import { Input } from "@repo/ui/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  createUserAgentMutationOptions,
  deleteUserAgentMutationOptions,
  updateUserAgentMutationOptions,
  userAgentsQueryOptions,
} from "@/src/api/agent.query";

interface AgentFormState {
  name: string;
  headline: string;
  description: string;
  storyBackground: string;
  personaPrompt: string;
  tonePrompt: string;
  guardrailsPrompt: string;
  defaultPrompt: string;
}

const emptyForm: AgentFormState = {
  name: "",
  headline: "",
  description: "",
  storyBackground: "",
  personaPrompt: "",
  tonePrompt: "",
  guardrailsPrompt: "",
  defaultPrompt: "",
};

function toFormState(agent: UserAgent): AgentFormState {
  return {
    name: agent.name,
    headline: agent.headline ?? "",
    description: agent.description ?? "",
    storyBackground: agent.storyBackground ?? "",
    personaPrompt: agent.personaPrompt ?? "",
    tonePrompt: agent.tonePrompt ?? "",
    guardrailsPrompt: agent.guardrailsPrompt ?? "",
    defaultPrompt: agent.defaultPrompt ?? "",
  };
}

function toRequestPayload(form: AgentFormState): CreateUserAgentRequest {
  const optional = (value: string) => {
    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  };

  return {
    name: form.name.trim(),
    headline: optional(form.headline),
    description: optional(form.description),
    storyBackground: optional(form.storyBackground),
    personaPrompt: optional(form.personaPrompt),
    tonePrompt: optional(form.tonePrompt),
    guardrailsPrompt: optional(form.guardrailsPrompt),
    defaultPrompt: optional(form.defaultPrompt),
  };
}

const textareaClassName =
  "min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60";

export function AgentsManager() {
  const queryClient = useQueryClient();
  const agentsQuery = useQuery(userAgentsQueryOptions());
  const createMutation = useMutation(
    createUserAgentMutationOptions(queryClient),
  );
  const updateMutation = useMutation(
    updateUserAgentMutationOptions(queryClient),
  );
  const deleteMutation = useMutation(
    deleteUserAgentMutationOptions(queryClient),
  );

  const [editorState, setEditorState] = useState<
    { mode: "closed" } | { mode: "create" } | { mode: "edit"; agent: UserAgent }
  >({ mode: "closed" });
  const [form, setForm] = useState<AgentFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditorOpen = editorState.mode !== "closed";
  const isSaving = createMutation.isPending || updateMutation.isPending;

  function openCreate() {
    setForm(emptyForm);
    setFormError(null);
    setEditorState({ mode: "create" });
  }

  function openEdit(agent: UserAgent) {
    setForm(toFormState(agent));
    setFormError(null);
    setEditorState({ mode: "edit", agent });
  }

  function closeEditor() {
    setEditorState({ mode: "closed" });
    setFormError(null);
  }

  async function handleSubmit() {
    if (form.name.trim().length === 0) {
      setFormError("请填写 Agent 名称");
      return;
    }

    const payload = toRequestPayload(form);

    try {
      if (editorState.mode === "edit") {
        await updateMutation.mutateAsync({
          agentId: editorState.agent.id,
          patch: payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }

      closeEditor();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "保存失败，请重试");
    }
  }

  async function handleDelete(agent: UserAgent) {
    const confirmed = window.confirm(`确认归档 Agent「${agent.name}」？`);

    if (!confirmed) {
      return;
    }

    await deleteMutation.mutateAsync(agent.id);
  }

  const agents = agentsQuery.data?.items ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 text-foreground sm:px-6 sm:py-12">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
        href="/app"
      >
        <ArrowLeft aria-hidden className="size-4" />
        返回聊天
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-semibold">我的 Agent</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            创建并管理多个 Agent 人设，用于后续群聊邀请。
          </p>
        </div>
        <Button onClick={openCreate} type="button">
          <Plus aria-hidden className="size-4" />
          新建 Agent
        </Button>
      </div>

      {agentsQuery.isPending ? (
        <p className="py-10 text-center text-sm text-muted" role="status">
          正在加载 Agent 列表
        </p>
      ) : agentsQuery.isError ? (
        <p className="py-10 text-center text-sm text-danger" role="alert">
          加载失败，请刷新页面重试
        </p>
      ) : agents.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          还没有 Agent，点击右上角新建一个吧。
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex items-start gap-4 rounded-md border border-border bg-surface p-4"
            >
              <span
                aria-hidden
                className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/12 text-primary"
              >
                <Bot className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{agent.name}</p>
                {agent.headline ? (
                  <p className="mt-1 truncate text-sm text-muted">
                    {agent.headline}
                  </p>
                ) : null}
                {agent.description ? (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                    {agent.description}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={`编辑 ${agent.name}`}
                  onClick={() => openEdit(agent)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  aria-label={`归档 ${agent.name}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDelete(agent)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isEditorOpen ? (
        <AgentEditorOverlay
          error={formError}
          form={form}
          isSaving={isSaving}
          onCancelAction={closeEditor}
          onChangeAction={setForm}
          onSubmitAction={handleSubmit}
          title={editorState.mode === "edit" ? "编辑 Agent" : "新建 Agent"}
        />
      ) : null}
    </main>
  );
}

function AgentEditorOverlay({
  error,
  form,
  isSaving,
  onCancelAction,
  onChangeAction,
  onSubmitAction,
  title,
}: {
  error: string | null;
  form: AgentFormState;
  isSaving: boolean;
  onCancelAction: () => void;
  onChangeAction: (form: AgentFormState) => void;
  onSubmitAction: () => void;
  title: string;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancelAction();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancelAction]);

  function update<TKey extends keyof AgentFormState>(key: TKey, value: string) {
    onChangeAction({ ...form, [key]: value });
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-md border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <Button
            aria-label="关闭"
            onClick={onCancelAction}
            ref={closeButtonRef}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        </div>

        <form
          className="grid max-h-[70svh] gap-4 overflow-y-auto px-5 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitAction();
          }}
        >
          <Field>
            <FieldLabel htmlFor="agent-name">名称</FieldLabel>
            <FieldControl>
              <Input
                id="agent-name"
                maxLength={120}
                onChange={(event) => update("name", event.target.value)}
                placeholder="给 Agent 起个名字"
                required
                value={form.name}
              />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-headline">一句话简介</FieldLabel>
            <FieldControl>
              <Input
                id="agent-headline"
                maxLength={200}
                onChange={(event) => update("headline", event.target.value)}
                placeholder="可选"
                value={form.headline}
              />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-description">角色说明</FieldLabel>
            <FieldControl>
              <textarea
                className={textareaClassName}
                id="agent-description"
                maxLength={2000}
                onChange={(event) => update("description", event.target.value)}
                placeholder="可选"
                value={form.description}
              />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-story">故事背景</FieldLabel>
            <FieldControl>
              <textarea
                className={textareaClassName}
                id="agent-story"
                maxLength={4000}
                onChange={(event) =>
                  update("storyBackground", event.target.value)
                }
                placeholder="可选"
                value={form.storyBackground}
              />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-persona">人设 / 性格</FieldLabel>
            <FieldControl>
              <textarea
                className={textareaClassName}
                id="agent-persona"
                maxLength={4000}
                onChange={(event) =>
                  update("personaPrompt", event.target.value)
                }
                placeholder="可选"
                value={form.personaPrompt}
              />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-tone">语气</FieldLabel>
            <FieldControl>
              <textarea
                className={textareaClassName}
                id="agent-tone"
                maxLength={2000}
                onChange={(event) => update("tonePrompt", event.target.value)}
                placeholder="可选"
                value={form.tonePrompt}
              />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-guardrails">角色边界</FieldLabel>
            <FieldControl>
              <textarea
                className={textareaClassName}
                id="agent-guardrails"
                maxLength={2000}
                onChange={(event) =>
                  update("guardrailsPrompt", event.target.value)
                }
                placeholder="可选"
                value={form.guardrailsPrompt}
              />
            </FieldControl>
          </Field>

          <Field>
            <FieldLabel htmlFor="agent-default">默认系统提示词</FieldLabel>
            <FieldControl>
              <textarea
                className={textareaClassName}
                id="agent-default"
                maxLength={4000}
                onChange={(event) =>
                  update("defaultPrompt", event.target.value)
                }
                placeholder="可选"
                value={form.defaultPrompt}
              />
            </FieldControl>
          </Field>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button onClick={onCancelAction} type="button" variant="secondary">
              取消
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? (
                <LoaderCircle aria-hidden className="size-4 animate-spin" />
              ) : null}
              保存
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
