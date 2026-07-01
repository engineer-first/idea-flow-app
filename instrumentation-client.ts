async function enableMocking() {
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.NEXT_PUBLIC_USE_MSW !== "true") return;
  if (typeof window === "undefined") return;
  const { worker } = await import("./app/mocks/browser");
  await worker.start({ onUnhandledRequest: "bypass" });
}

void enableMocking();
