import {mkdir,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const root=dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json'));
await mkdir('public/models/runtime',{recursive:true});
for(const file of ['tfjs-backend-wasm.wasm','tfjs-backend-wasm-simd.wasm','tfjs-backend-wasm-threaded-simd.wasm']) await copyFile(join(root,'dist',file),join('public/models/runtime',file));
