import {build} from 'vite';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const base=process.env.PAGES_BASE || '/';
if(!base.startsWith('/') || !base.endsWith('/') || base.includes('..')) throw new Error('PAGES_BASE must be / or /repository/');
for(const args of [['scripts/copy-analysis-runtime.mjs'],['node_modules/typescript/bin/tsc','-b']]) {
 const result=spawnSync(process.execPath,args,{stdio:'inherit'});
 if(result.status!==0) process.exit(result.status || 1);
}

await build({base, ...(process.env.BROWSER_QA === "1" ? {build:{rollupOptions:{input:{main:resolve("index.html"),analysis:resolve("tests/browser-analysis.html")}}}} : {})});
