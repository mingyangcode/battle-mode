import React from 'react';import {createRoot} from 'react-dom/client';import {BattleMusicPage} from '../src/pages/BattleMusicPage';import {LiveRoundPage} from '../src/pages/LiveRoundPage';
import '../src/style.css';import '../src/styles/redesign.css';import '../src/styles/motion.css';import '../src/styles/v14.css';import '../src/styles/v15.css';
const root=createRoot(document.getElementById('root')!);const wait=()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));
function box(){const e=document.querySelector('.primary-page-action > button')!;return {rect:e.getBoundingClientRect().toJSON(),font:getComputedStyle(e).font,padding:getComputedStyle(e).padding,radius:getComputedStyle(e).borderRadius}}
root.render(<div className="app has-bottom-nav"><main className="app-main"><BattleMusicPage tracks={[]} onEdit={()=>{}} onImport={()=>{}} busy={false} onDelete={()=>{}}/></main></div>);await wait();const music=box();
root.render(<div className="app app-live has-bottom-nav"><main className="app-main"><LiveRoundPage tracks={[]} load={async()=>{throw Error('unused')}} onComplete={async()=>{}} onActive={()=>{}}/></main></div>);await wait();const live=box();
parent.postMessage({layout:true,width:innerWidth,equal:JSON.stringify(music)===JSON.stringify(live),overflow:document.documentElement.scrollWidth>innerWidth,music,live},location.origin);
