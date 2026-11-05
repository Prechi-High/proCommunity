import { useEffect } from "react";
import { Platform } from "react-native";
import { getFormTheme, type ThemeMode } from "@/constants/theme";

type Props = { mode: ThemeMode; systemDark?: boolean };

/**
 * Installs one app-wide form stylesheet on web. !important is intentional:
 * React Native Web emits inline field styles, which otherwise defeat global
 * theme rules and caused page-to-page contrast differences.
 */
export function GlobalFormTheme({ mode, systemDark = false }: Props) {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const tokens = getFormTheme(mode, systemDark);
    const root = document.documentElement;
    const variables: Record<string, string> = {
      "--input-bg": tokens.inputBg,
      "--input-text": tokens.inputText,
      "--input-placeholder": tokens.inputPlaceholder,
      "--input-border": tokens.inputBorder,
      "--input-focus": tokens.inputFocus,
      "--text-primary": tokens.textPrimary,
      "--text-secondary": tokens.textSecondary,
      "--surface": tokens.surface,
      "--surface-secondary": tokens.surfaceSecondary,
    };
    Object.entries(variables).forEach(([key, value]) => root.style.setProperty(key, value));
    root.dataset.unmaskTheme = mode === "system" ? (systemDark ? "dark" : "light") : mode;

    let style = document.getElementById("unmask-global-form-theme") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "unmask-global-form-theme";
      document.head.appendChild(style);
    }
    style.textContent = `
      :root {
        color-scheme: ${root.dataset.unmaskTheme};
      }
      input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]),
      textarea,
      select {
        color: var(--input-text) !important;
        -webkit-text-fill-color: var(--input-text) !important;
        background-color: var(--input-bg) !important;
        border-color: var(--input-border) !important;
        caret-color: var(--input-text) !important;
        color-scheme: ${root.dataset.unmaskTheme};
      }
      input::placeholder,
      textarea::placeholder {
        color: var(--input-placeholder) !important;
        -webkit-text-fill-color: var(--input-placeholder) !important;
        opacity: 1 !important;
      }
      select option {
        color: var(--input-text) !important;
        background-color: var(--input-bg) !important;
      }
      input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="reset"]):focus,
      textarea:focus,
      select:focus {
        border-color: var(--input-focus) !important;
        outline: 2px solid var(--input-focus) !important;
        outline-offset: 1px;
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--input-focus) 18%, transparent) !important;
      }
      input:disabled,
      textarea:disabled,
      select:disabled,
      input[aria-disabled="true"],
      textarea[aria-disabled="true"],
      select[aria-disabled="true"] {
        color: var(--text-secondary) !important;
        -webkit-text-fill-color: var(--text-secondary) !important;
        background-color: var(--surface-secondary) !important;
        opacity: 0.68;
        cursor: not-allowed;
      }
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      textarea:-webkit-autofill,
      select:-webkit-autofill {
        -webkit-text-fill-color: var(--input-text) !important;
        -webkit-box-shadow: 0 0 0 1000px var(--input-bg) inset !important;
        box-shadow: 0 0 0 1000px var(--input-bg) inset !important;
        caret-color: var(--input-text) !important;
      }
      label,
      [data-form-label="true"],
      .unmask-form-label {
        color: var(--text-primary);
      }
      .unmask-form-hint {
        color: var(--text-secondary);
      }
    `;
  }, [mode, systemDark]);

  return null;
}
