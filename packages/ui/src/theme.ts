export const THEMES = ["latte", "mocha"] as const;

export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = "latte";
export const THEME_STORAGE_KEY = "moodmate-theme:v1";

const THEME_CHANGE_EVENT = "moodmate:theme-change";

export function isThemeName(
  value: string | null | undefined,
): value is ThemeName {
  return typeof value === "string" && THEMES.includes(value as ThemeName);
}

export function resolveTheme(value: string | null | undefined): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME;
}

export function getThemeSnapshot(): ThemeName {
  return resolveTheme(document.documentElement.dataset.theme);
}

export function applyTheme(
  theme: ThemeName,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = theme;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 浏览器禁用存储时，当前页面仍然可以切换主题。
  }

  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function subscribeToTheme(onStoreChange: () => void): () => void {
  const handleThemeChange = () => onStoreChange();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;

    document.documentElement.dataset.theme = resolveTheme(event.newValue);
    onStoreChange();
  };

  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
  };
}
