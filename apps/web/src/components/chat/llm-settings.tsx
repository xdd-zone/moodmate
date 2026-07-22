"use client";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Eye, EyeOff, KeyRound, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  clearLocalLlmConfig,
  createDefaultLocalLlmConfig,
  readLocalLlmConfig,
  saveLocalLlmConfig,
  type LocalLlmConfig,
} from "@/src/auth/local-llm-config";

export function LlmSettings() {
  const [config, setConfig] = useState<LocalLlmConfig>(
    createDefaultLocalLlmConfig,
  );
  const [notice, setNotice] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const storedConfig = readLocalLlmConfig();

    if (storedConfig) {
      setConfig(storedConfig);
    }
  }, []);

  function updateConfig<Key extends keyof LocalLlmConfig>(
    key: Key,
    value: LocalLlmConfig[Key],
  ) {
    setConfig((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  function handleSave() {
    try {
      const savedConfig = saveLocalLlmConfig(config);
      setConfig(savedConfig);
      setNotice(
        savedConfig.enabled
          ? "本地配置已保存并启用。"
          : "本地配置已保存，启用后聊天才会使用。",
      );
    } catch {
      setNotice("请填写有效的 Provider、Base URL、Model 和 API Key。");
    }
  }

  function handleClear() {
    clearLocalLlmConfig();
    setConfig(createDefaultLocalLlmConfig());
    setNotice("本地 LLM 配置和 API Key 已删除。");
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div>
          <h2 className="text-xl font-semibold">LLM 设置</h2>
          <p className="mt-2 max-w-[58ch] text-sm leading-6 text-muted">
            未启用本地配置时，聊天使用平台 DeepSeek V4 Flash。
          </p>
        </div>
        <Badge variant={config.enabled ? "default" : "outline"}>
          {config.enabled ? "使用本地配置" : "使用平台配置"}
        </Badge>
      </div>

      <div className="grid gap-5 py-6">
        <label className="flex min-h-11 items-center justify-between gap-4 rounded-md border border-border bg-surface px-3 py-2">
          <span>
            <span className="block text-sm font-medium">启用本地配置</span>
            <span className="mt-1 block text-xs leading-5 text-muted">
              开启后优先使用下面的 Provider。
            </span>
          </span>
          <input
            checked={config.enabled}
            className="size-5 accent-primary"
            onChange={(event) =>
              updateConfig("enabled", event.currentTarget.checked)
            }
            type="checkbox"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField
            label="Provider"
            onChange={(value) => updateConfig("providerName", value)}
            placeholder="DeepSeek"
            value={config.providerName}
          />
          <SettingField
            label="Model"
            onChange={(value) => updateConfig("model", value)}
            placeholder="deepseek-v4-flash"
            value={config.model}
          />
        </div>

        <SettingField
          label="Base URL"
          onChange={(value) => updateConfig("baseURL", value)}
          placeholder="https://api.deepseek.com"
          type="url"
          value={config.baseURL}
        />

        <div>
          <label className="text-sm font-medium" htmlFor="llm-api-key">
            API Key
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative min-w-0 flex-1">
              <KeyRound
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              />
              <input
                autoComplete="off"
                className="min-h-11 w-full rounded-md border border-border bg-surface pr-11 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                id="llm-api-key"
                onChange={(event) =>
                  updateConfig("apiKey", event.currentTarget.value)
                }
                placeholder="输入 API Key"
                type={showApiKey ? "text" : "password"}
                value={config.apiKey}
              />
              <button
                aria-label={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-sm text-muted outline-none hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
                onClick={() => setShowApiKey((current) => !current)}
                title={showApiKey ? "隐藏 API Key" : "显示 API Key"}
                type="button"
              >
                {showApiKey ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">
            API Key 只保存在当前浏览器。发送消息时会交给 Moodmate API
            代理，不会写入账号资料。
          </p>
        </div>
      </div>

      {notice ? (
        <p className="mb-4 text-sm text-muted" role="status">
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
        <Button className="min-h-11" onClick={handleSave} type="button">
          保存配置
        </Button>
        <Button
          className="min-h-11"
          onClick={handleClear}
          type="button"
          variant="danger"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          删除本地配置
        </Button>
      </div>
    </section>
  );
}

function SettingField({
  label,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: "text" | "url";
  value: string;
}) {
  const id = `llm-${label.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <input
        className="mt-2 min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        id={id}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </div>
  );
}
