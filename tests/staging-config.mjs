import assert from 'node:assert/strict';
import {endpoint,check} from '../scripts/check-staging.mjs';
assert.equal(endpoint('https://stage.example/'),'https://stage.example');
for(const value of ['http://stage.example','https://a.invalid','https://user:secret@stage.example','https://stage.example/?token=secret']) assert.throws(()=>endpoint(value));
const mock=async(url,init)=> {
  if(init.method==='OPTIONS') return new Response('',{headers:{'access-control-allow-origin':'https://stage.example','access-control-allow-methods':'GET, POST'}});
  if(url.endsWith('/health'))return Response.json({status:'ok'});
  if(url.endsWith('/status'))return Response.json({ready:true,warming:false,error:null});
  return new Response('<div id="root"></div>',{headers:{'content-type':'text/html'}});
};
assert.deepEqual(await check('https://stage.example','https://api.example',mock),[]);
const old=console.error; console.error=()=>{};
try {assert.equal((await check('https://stage.example','https://api.example',async()=>new Response('broken',{status:503}))).length,5);} finally {console.error=old;}
console.log('PASS staging checker success/failure cases (mocked transport, not public deployment)');
