import { copy } from "../copy/zh-CN";
import { modeDefaults } from "../state/sequential";
import type { Track } from "../types/track";
import type { RoundHistoryItem } from "../types/round";
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("battle-mode-v0", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("tracks", { keyPath: "id" });
      db.createObjectStore("files");
      db.createObjectStore("history", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error(copy["无法打开本地存储，请检查浏览器隐私设置。"]));
  }));
}
export async function readTracks() {
  const database = await db();
  return new Promise<Track[]>((resolve, reject) => {
    const r = database.transaction("tracks").objectStore("tracks").getAll();
    r.onsuccess = () =>
      resolve(
        r.result
          .map((t: Track) => ({ ...t, ...modeDefaults(t) }))
          .sort(
            (a: Track, b: Track) =>
              Number(b.id.startsWith("demo-")) -
              Number(a.id.startsWith("demo-")),
          ),
      );
    r.onerror = () => reject(r.error);
  });
}
export async function readFile(id: string) {
  const database = await db();
  return new Promise<Blob>((resolve, reject) => {
    const r = database.transaction("files").objectStore("files").get(id);
    r.onsuccess = () =>
      r.result
        ? resolve(r.result)
        : reject(new Error(copy["找不到本地音频，请重新导入。"]));
    r.onerror = () => reject(r.error);
  });
}
export async function saveTrack(track: Track, file?: Blob) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(
      file ? ["tracks", "files"] : ["tracks"],
      "readwrite",
    );
    const { file: _, audioUrl: __, ...metadata } = track;
    tx.objectStore("tracks").put(metadata);
    if (file) tx.objectStore("files").put(file, track.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error(copy["本地保存失败，可能存储空间不足。"]));
    tx.onabort = () => reject(new Error(copy["本地保存被中止。"]));
  });
}
export async function finishRound(track: Track, history: RoundHistoryItem) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["tracks", "history"], "readwrite");
    const existingHistory = tx.objectStore("history").get(history.id);
    existingHistory.onsuccess = () => {
      if (existingHistory.result) return;
      const existingTrack = tx.objectStore("tracks").get(track.id);
      existingTrack.onsuccess = () => {
        if (existingTrack.result)
          tx.objectStore("tracks").put({
            ...existingTrack.result,
            playedCount: existingTrack.result.playedCount + 1,
          });
      };
      tx.objectStore("history").put(history);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(copy["Round 记录保存失败，请重试。"]));
    tx.onabort = () =>
      reject(new Error(copy["Round 记录保存被中止，请重试。"]));
  });
}
export function readDuration(file: Blob) {
  return new Promise<number>((resolve, reject) => {
    const el = document.createElement("audio"),
      url = URL.createObjectURL(file);
    let timer: number;
    const clean = () => {
      clearTimeout(timer);
      el.removeAttribute("src");
      el.load();
      URL.revokeObjectURL(url);
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const duration = el.duration;
      clean();
      if (Number.isFinite(duration) && duration >= 0.5) resolve(duration);
      else reject(new Error(copy["无法读取音频时长或音频过短。"]));
    };
    el.onerror = () => {
      clean();
      reject(new Error(copy["浏览器不支持此音频格式或文件已损坏。"]));
    };
    timer = window.setTimeout(() => {
      clean();
      reject(new Error(copy["读取音频超时，请换一个文件。"]));
    }, 15000);
    el.src = url;
  });
}

export async function removeTrack(
  id: string,
): Promise<{ track: Track; file: Blob }> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(["tracks", "files"], "readwrite");
    const track = tx.objectStore("tracks").get(id),
      file = tx.objectStore("files").get(id);
    tx.objectStore("tracks").delete(id);
    tx.objectStore("files").delete(id);
    tx.oncomplete = () =>
      track.result && file.result
        ? resolve({ track: track.result, file: file.result })
        : reject(new Error(copy["Track already removed"]));
    tx.onerror = () => reject(new Error(copy["删除失败，请重试。"]));
    tx.onabort = () => reject(new Error(copy["删除已中止。"]));
  });
}

/** Patch existing metadata atomically; a late worker must never resurrect deletion. */
export async function patchTrack(id: string, patch: Partial<Track>) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction("tracks", "readwrite"),
      store = tx.objectStore("tracks"),
      request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, ...patch, id });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Seed and marker share one transaction: retries cannot duplicate or resurrect deleted demos. */
export async function installDemo(track: Track, file: Blob) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction(
      ["tracks", "files", "history"],
      "readwrite",
    );
    const marker = "demo-installed:" + track.id;
    const request = tx.objectStore("history").get(marker);
    request.onsuccess = () => {
      if (request.result) return;
      tx.objectStore("tracks").put(track);
      tx.objectStore("files").put(file, track.id);
      tx.objectStore("history").put({ id: marker, installedAt: Date.now() });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function demoInstalled(id: string) {
  const database = await db();
  return new Promise<boolean>((resolve, reject) => {
    const r = database
      .transaction("history")
      .objectStore("history")
      .get("demo-installed:" + id);
    r.onsuccess = () => resolve(Boolean(r.result));
    r.onerror = () => reject(r.error);
  });
}
