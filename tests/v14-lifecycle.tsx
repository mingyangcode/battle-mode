import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { WaterRippleVisualizer } from '../src/components/WaterRippleVisualizer';
import { audio } from '../src/audio/AudioEngine';
import '../src/styles/v14.css';
const wait = () => new Promise(r=>setTimeout(r,80));
document.querySelector<HTMLButtonElement>('#run')!.onclick=async()=>{
 const result=document.querySelector('#result')!;result.textContent='Running';
 const originalRAF=window.requestAnimationFrame, originalCancel=window.cancelAnimationFrame, originalMeter=audio.createMeter, originalMatch=window.matchMedia;
 const pending=new Set<number>();let meters=0, reads=0;
 window.requestAnimationFrame=(callback)=>{const id=originalRAF.call(window,t=>{pending.delete(id);callback(t)});pending.add(id);return id};
 window.cancelAnimationFrame=id=>{pending.delete(id);originalCancel.call(window,id)};
 audio.createMeter=()=>{meters++;let disposed=false;return {analyser:{getByteTimeDomainData:(a:Uint8Array)=>{reads++;a.fill(140)},getByteFrequencyData:(a:Uint8Array)=>a.fill(80)} as AnalyserNode,dispose:()=>{if(!disposed){meters--;disposed=true}}}};
 let root=createRoot(document.querySelector('#fixture')!);const logs:string[]=[];
 const assert=(value:unknown,label:string)=>{if(!value)throw Error(label);logs.push(label)};
 try{
 flushSync(()=>root.render(<WaterRippleVisualizer active/>));await wait();assert(meters===1&&reads>0,'One read-only meter while active');assert(pending.size===1,'One animation loop');
 flushSync(()=>root.render(<WaterRippleVisualizer active paused/>));await wait();assert(meters===0&&pending.size===0,'Pause disposes meter and RAF');
 flushSync(()=>root.render(<WaterRippleVisualizer active/>));await wait();assert(meters===1&&pending.size===1,'Resume reconnects once');
 flushSync(()=>root.render(<WaterRippleVisualizer/>));await wait();assert(meters===0,'End releases audio meter; idle canvas continues');
 root.unmount();assert(meters===0&&pending.size===0,'Unmount cancels all visual work');
 window.matchMedia=(query)=> query.includes('prefers-reduced-motion')?{matches:true,addEventListener(){},removeEventListener(){}} as unknown as MediaQueryList:originalMatch.call(window,query);
 root=createRoot(document.querySelector('#fixture')!);flushSync(()=>root.render(<WaterRippleVisualizer active/>));await wait();assert(meters===0&&pending.size===0,'Reduced motion has no meter or continuous RAF');root.unmount();
 result.textContent=`PASS ${logs.length}\n`+logs.join('\n');
 }catch(e){root.unmount();result.textContent='FAIL '+String(e)}finally{window.requestAnimationFrame=originalRAF;window.cancelAnimationFrame=originalCancel;window.matchMedia=originalMatch;audio.createMeter=originalMeter}
};
