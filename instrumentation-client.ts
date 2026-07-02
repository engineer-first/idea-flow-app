async function enableMocking() {
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.NEXT_PUBLIC_USE_MSW !== "true") return;
  if (typeof window === "undefined") return;
  const { worker } = await import("./app/mocks/browser");
  try {
    await worker.start({ onUnhandledRequest: "bypass" });
  } catch (error) {
    console.error("[MSW] Failed to start the mock service worker:", error);
  }
}

void enableMocking();
