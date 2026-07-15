import { DEFAULT_THEME, THEME_STORAGE_KEY } from "./theme";

const themeScript = `
(function () {
  var theme = ${JSON.stringify(DEFAULT_THEME)};

  try {
    var storedTheme = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (storedTheme === "latte" || storedTheme === "mocha") {
      theme = storedTheme;
    }
  } catch {}

  document.documentElement.dataset.theme = theme;
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
