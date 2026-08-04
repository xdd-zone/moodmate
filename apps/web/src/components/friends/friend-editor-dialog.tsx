"use client";

import type { Agent, CreateUserAgentRequest } from "@repo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createUserAgentMutationOptions,
  updateUserAgentMutationOptions,
} from "@/src/api/agent.query";
import { MoodmateDialog } from "@/src/components/moodmate/dialog";

type FriendFormState = {
  defaultPrompt: string;
  description: string;
  guardrailsPrompt: string;
  headline: string;
  name: string;
  personaPrompt: string;
  storyBackground: string;
  tonePrompt: string;
};

const emptyForm: FriendFormState = {
  defaultPrompt: "",
  description: "",
  guardrailsPrompt: "",
  headline: "",
  name: "",
  personaPrompt: "",
  storyBackground: "",
  tonePrompt: "",
};

function toFormState(agent: Agent | null): FriendFormState {
  if (!agent) return emptyForm;

  return {
    defaultPrompt: agent.defaultPrompt ?? "",
    description: agent.description ?? "",
    guardrailsPrompt: agent.guardrailsPrompt ?? "",
    headline: agent.headline ?? "",
    name: agent.name,
    personaPrompt: agent.personaPrompt ?? "",
    storyBackground: agent.storyBackground ?? "",
    tonePrompt: agent.tonePrompt ?? "",
  };
}

function toRequestPayload(form: FriendFormState): CreateUserAgentRequest {
  const optional = (value: string) => {
    const trimmed = value.trim();

    return trimmed.length === 0 ? null : trimmed;
  };

  return {
    defaultPrompt: optional(form.defaultPrompt),
    description: optional(form.description),
    guardrailsPrompt: optional(form.guardrailsPrompt),
    headline: optional(form.headline),
    name: form.name.trim(),
    personaPrompt: optional(form.personaPrompt),
    storyBackground: optional(form.storyBackground),
    tonePrompt: optional(form.tonePrompt),
  };
}

type FriendEditorDialogProps = {
  agent: Agent | null;
  onClose: () => void;
  onSaved?: () => void;
  open: boolean;
};

export function FriendEditorDialog({
  agent,
  onClose,
  onSaved,
  open,
}: FriendEditorDialogProps) {
  const queryClient = useQueryClient();
  const createMutation = useMutation(
    createUserAgentMutationOptions(queryClient),
  );
  const updateMutation = useMutation(
    updateUserAgentMutationOptions(queryClient),
  );
  const [form, setForm] = useState<FriendFormState>(() => toFormState(agent));
  const [formError, setFormError] = useState<string | null>(null);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;

    setForm(toFormState(agent));
    setFormError(null);
  }, [agent, open]);

  function update<TKey extends keyof FriendFormState>(
    key: TKey,
    value: string,
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    if (form.name.trim().length === 0) {
      setFormError("请填写朋友名称");
      return;
    }

    const payload = toRequestPayload(form);

    try {
      if (agent) {
        await updateMutation.mutateAsync({ agentId: agent.id, patch: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }

      onSaved?.();
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "朋友资料保存失败，请重试",
      );
    }
  }

  return (
    <MoodmateDialog
      description={agent ? "修改这位朋友的资料。" : "填写朋友资料与相处方式。"}
      footer={
        <>
          <button
            className="moodmate-button moodmate-button--secondary"
            onClick={onClose}
            type="button"
          >
            取消
          </button>
          <button
            className="moodmate-button moodmate-button--primary"
            disabled={isSaving}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {isSaving ? <LoaderCircle aria-hidden="true" /> : null}
            {agent ? "保存修改" : "创建朋友"}
          </button>
        </>
      }
      onClose={onClose}
      open={open}
      title={agent ? "编辑朋友" : "认识新朋友"}
    >
      <form
        className="moodmate-friend-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label className="moodmate-field">
          <span>名称</span>
          <input
            maxLength={120}
            onChange={(event) => update("name", event.currentTarget.value)}
            placeholder="给 TA 起个名字"
            required
            value={form.name}
          />
        </label>

        <label className="moodmate-field">
          <span>一句话简介</span>
          <input
            maxLength={200}
            onChange={(event) => update("headline", event.currentTarget.value)}
            placeholder="例如：陪伴倾听型 · 温柔而有分寸"
            value={form.headline}
          />
        </label>

        <label className="moodmate-field">
          <span>角色说明</span>
          <textarea
            maxLength={2000}
            onChange={(event) =>
              update("description", event.currentTarget.value)
            }
            placeholder="描述 TA 擅长的陪伴场景"
            value={form.description}
          />
        </label>

        <label className="moodmate-field">
          <span>背景故事</span>
          <textarea
            maxLength={4000}
            onChange={(event) =>
              update("storyBackground", event.currentTarget.value)
            }
            placeholder="写下 TA 的经历与来处"
            value={form.storyBackground}
          />
        </label>

        <label className="moodmate-field">
          <span>人设定位</span>
          <textarea
            maxLength={4000}
            onChange={(event) =>
              update("personaPrompt", event.currentTarget.value)
            }
            placeholder="描述 TA 的性格、说话方式和关注点"
            value={form.personaPrompt}
          />
        </label>

        <label className="moodmate-field">
          <span>语气风格</span>
          <textarea
            maxLength={2000}
            onChange={(event) =>
              update("tonePrompt", event.currentTarget.value)
            }
            placeholder="例如：温和、简短、少用感叹号"
            value={form.tonePrompt}
          />
        </label>

        <label className="moodmate-field">
          <span>边界与禁忌</span>
          <textarea
            maxLength={2000}
            onChange={(event) =>
              update("guardrailsPrompt", event.currentTarget.value)
            }
            placeholder="写明不能触碰的话题和处理边界"
            value={form.guardrailsPrompt}
          />
        </label>

        <label className="moodmate-field">
          <span>默认系统提示词</span>
          <textarea
            maxLength={4000}
            onChange={(event) =>
              update("defaultPrompt", event.currentTarget.value)
            }
            placeholder="可选"
            value={form.defaultPrompt}
          />
        </label>

        {formError ? (
          <p className="moodmate-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          aria-hidden="true"
          className="moodmate-form-submit"
          tabIndex={-1}
          type="submit"
        >
          提交
        </button>
      </form>
    </MoodmateDialog>
  );
}
