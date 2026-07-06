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
