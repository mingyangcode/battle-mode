import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile} from 'node:fs/promises';
const source=ts.transpileModule(await readFile('src/analysis/core.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {quickFeatures,rankLocal}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const rate=1000,pcm=new Float32Array(180*rate);
for(let i=0;i<pcm.length;i++){const t=i/rate;pcm[i]=Math.sin(t*2*Math.PI*110)*(.1+.5*(t>.03&&t%0.5<.08));}
const raw=quickFeatures(pcm,rate);
assert.equal(raw.duration,180);assert.equal(raw.energy.length,360);assert.ok(raw.bpm>=50&&raw.bpm<=180);
for(const mode of ['same','matched','sequential']){
 const r=rankLocal(raw,'hash',{length:45,mode,pre:5,post:5});
 assert.equal(r.quality,'quick');assert.ok(r.recommendations.length);
 for(const s of r.recommendations){assert.equal(s.end-s.start,45);assert.ok(s.start>=0);assert.ok(s.end<=180);if(mode==='sequential')assert.ok(s.start+100<=180);}
 for(const p of r.matchedPairs){assert.ok(Math.max(p.segmentA.start,p.segmentB.start)>=Math.min(p.segmentA.end,p.segmentB.end));assert.ok(Number.isFinite(p.score));}
}
assert.deepEqual(rankLocal(raw,'hash',{length:90,mode:'sequential',pre:5,post:5}).recommendations,[]);
const silence=quickFeatures(new Float32Array(40000),rate);assert.equal(silence.bpm,0);assert.equal(rankLocal(silence,'s',{length:10,mode:'same',pre:5,post:5}).recommendations.length,0);
raw.embeddings=Array.from({length:60},(_,i)=>({start:i*3,end:i*3+3,values:[i%2,1]}));
const deep=rankLocal(raw,'hash',{length:30,mode:'matched',pre:5,post:5},true);
assert.equal(deep.quality,'deep');assert.equal(deep.cacheHit,true);assert.equal(deep.roundDuration,30);assert.ok(deep.matchedPairs.length);
assert.equal(raw.duration,180);assert.throws(()=>rankLocal(raw,'x',{length:NaN,mode:'same',pre:5,post:5}));
console.log('PASS browser analysis: whole song, silence, mode constraints, pairs, cached duration rerank, genuine-model-only quality');
