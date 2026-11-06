import { LOCAL_VERSION, type LocalRaw } from './core';
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise((resolve,reject) => {
    const r = indexedDB.open('battle-browser-analysis', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('raw');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => { database = undefined; reject(r.error); };
  });
}
export async function readRaw(hash: string): Promise<LocalRaw | undefined> {
  try { const d = await db(); return await new Promise((resolve,reject) => { const r = d.transaction('raw').objectStore('raw').get(`${LOCAL_VERSION}:${hash}`); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); } catch { return undefined; }
}
export async function writeRaw(hash: string, raw: LocalRaw) {
  try { const d = await db(); await new Promise<void>((resolve,reject)=>{const tx=d.transaction('raw','readwrite'); tx.objectStore('raw').put(raw,`${LOCAL_VERSION}:${hash}`); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);}); } catch { /* Quota/private mode must not discard a usable in-memory result. */ }
}
