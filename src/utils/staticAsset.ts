/** Resolve bundled assets for both root hosting and GitHub project Pages. */
export function staticAsset(path: string) {
  const base = (import.meta as ImportMeta & {env?:{BASE_URL?:string}}).env?.BASE_URL ?? '/';
  return base + path.replace(/^\//, '');
}
