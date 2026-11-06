/** Read-only deployed-site smoke check. Never uploads local music. */
import { pathToFileURL } from 'node:url';
export function endpoint(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.hostname.endsWith('.invalid'))
    throw new Error('Supply a real HTTPS URL without credentials, query or fragment');
  return u.href.replace(/\/$/, '');
}
export async function check(frontend, backend, request = fetch) {
  const web = endpoint(frontend), api = endpoint(backend);
  const origin = new URL(web).origin;
  const failures = [];
  const run = async (label, fn) => {
    try { await fn(); console.log(`PASS ${label}`); }
    catch (e) { failures.push(label); console.error(`FAIL ${label}: ${e.message}`); }
  };
  const get = (url, init={}) => request(url, {...init, signal:AbortSignal.timeout(20000), redirect:'error'});
  await run('frontend HTML', async () => {
    const r=await get(web+'/');
    if (!r.ok || !(r.headers.get('content-type')||'').includes('text/html') || !(await r.text()).includes('id="root"')) throw new Error('Missing React document');
  });
  await run('SPA refresh fallback', async () => {
    const r=await get(web+'/__battle_staging_probe');
    if (!r.ok || !(await r.text()).includes('id="root"')) throw new Error('Missing SPA fallback');
  });
  await run('backend health', async () => {
    const r=await get(api+'/health');
    if (!r.ok || (await r.json()).status!=='ok') throw new Error('Backend unhealthy');
  });
  await run('analyzer warm', async () => {
    const r=await get(api+'/api/analysis/status'); const status=await r.json();
    if (!r.ok || status.ready!==true || status.warming || status.error) throw new Error('Analyzer not ready');
  });
  await run('upload CORS preflight', async () => {
    const r=await get(api+'/api/analysis/jobs',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
    if (!r.ok || r.headers.get('access-control-allow-origin')!==origin || !r.headers.get('access-control-allow-methods')?.includes('POST')) throw new Error('Frontend origin not allowed');
  });
  return failures;
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const [frontend,backend]=process.argv.slice(2);
  if (!frontend || !backend) {console.error('Usage: node scripts/check-staging.mjs FRONTEND_HTTPS_ORIGIN BACKEND_HTTPS_ORIGIN');process.exitCode=1;}
  else try {process.exitCode=(await check(frontend,backend)).length ? 1 : 0;} catch(e){console.error(e.message);process.exitCode=1;}
}
