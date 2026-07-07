export const SUPABASE_CONFIGURATION_ERROR_MESSAGE =
  "Supabaseの環境変数を設定してください。";

export function getLoginErrorPath(message: string, next = "/") {
  const params = new URLSearchParams({ error: message });

  if (next !== "/") {
    params.set("next", next);
  }

  return `/login?${params.toString()}`;
}

export function getSupabaseConfigurationErrorLoginPath(next = "/") {
  return getLoginErrorPath(SUPABASE_CONFIGURATION_ERROR_MESSAGE, next);
}

export function sanitizeNextPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") {
    return "/";
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }

  try {
    const parsed = new URL(value, "http://localhost");

    if (parsed.origin !== "http://localhost") {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}
