/** API base includes /api. Resolve lazily so invalid cloud config never blocks manual UI. */
export function resolveApiUrl(path: string, base = "/api", protocol = "http:"): string {
  const clean = base.trim().replace(/\/+$/, "");
  if (!path.startsWith("/api/")) throw new Error("Invalid API path");
  if (!clean.startsWith("/") || clean.startsWith("//")) {
    const url = new URL(clean);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
      throw new Error("Invalid API base URL");
    if (protocol === "https:" && url.protocol !== "https:") throw new Error("API requires HTTPS");
  }
  if (!clean) throw new Error("Invalid API base URL");
  return clean + path.slice(4);
}
export async function apiFetch(path: string, init?: RequestInit) {
  const base = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL || '/api';
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) abort();
  else init?.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, path === '/api/analysis/jobs' ? 180000 : 20000);
  try {
    return await fetch(resolveApiUrl(path, base, globalThis.location?.protocol), { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !init?.signal?.aborted)
      throw new Error('分析服务响应超时，请检查网络后刷新重试；仍可手动设置片段。');
    throw error;
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener('abort', abort);
  }
}
