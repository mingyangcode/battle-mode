import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
async function load(name){const {outputText}=ts.transpileModule(await fs.readFile(`src/state/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}});return import('data:text/javascript;base64,'+Buffer.from(outputText).toString('base64'));}
const {readTheme}=await load('theme');
assert.equal(readTheme(),'light');assert.equal(readTheme({getItem:()=> 'dark'}),'dark');assert.equal(readTheme({getItem:()=> 'invalid'}),'light');assert.equal(readTheme({getItem:()=>{throw Error();}}),'light');
const {NextTrackSlot}=await load('nextTrack');const slot=new NextTrackSlot();let old;
const first=slot.select({id:'a'},()=>new Promise(r=>old=r));await slot.select({id:'b'},async()=>2);old(1);await first;assert.equal(slot.buffer,2);assert.equal(slot.track.id,'b');
let late;const pending=slot.select({id:'c'},()=>new Promise(r=>late=r));slot.clear();late(3);await pending;assert.equal(slot.buffer,undefined);assert.equal(slot.track,undefined);
await slot.select({id:'d'},async()=>{throw Error('decode')});assert.ok(slot.error);assert.equal(slot.loading,false);
console.log('PASS V1.3: light default, persistence reader, storage failure; stale preload, replacement, deletion/cleanup, decode failure');
