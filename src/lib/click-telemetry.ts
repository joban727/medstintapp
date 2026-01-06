export function trackClick(task: string, meta?: Record<string, string | number>) {
  try {
    const key = `telemetry.clicks.${task}`
    const current = Number(localStorage.getItem(key) || "0")
    localStorage.setItem(key, String(current + 1))

    // Best-effort server telemetry
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "click", task, meta, timestamp: new Date().toISOString() }),
    }).catch(() => {})
  } catch (error) {
    // Silent failure for telemetry
    console.error("Telemetry error:", error)
  }
}
