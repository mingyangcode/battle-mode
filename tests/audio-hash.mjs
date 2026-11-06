import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=ts.transpileModule(await readFile('src/utils/audioHash.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {sha256}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const length of [0,1,55,56,63,64,65,1000,1000000]) {
 const bytes=randomBytes(length);
 assert.equal(sha256(bytes),createHash('sha256').update(bytes).digest('hex'));
}
console.log('PASS HTTP fallback SHA-256 matches native across padding/block boundaries and 1MB audio');
