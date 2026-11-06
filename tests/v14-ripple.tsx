import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { WaterRippleVisualizer } from '../src/components/WaterRippleVisualizer';
import { ThemeToggle } from '../src/components/ThemeToggle';
import '../src/style.css';
import '../src/styles/redesign.css';
import '../src/styles/v14.css';
function Prototype(){const [paused,setPaused]=useState(false);return <section style={{position:'relative',minHeight:'100dvh',isolation:'isolate'}}><WaterRippleVisualizer mock active paused={paused}/><div style={{position:'relative',zIndex:1,padding:24,color:'var(--text-primary)'}}><ThemeToggle/><h1>舞者 A</h1><p>00:40</p><button onClick={()=>setPaused(!paused)}>{paused?'继续':'暂停'}</button></div></section>};
createRoot(document.getElementById('root')!).render(<Prototype/>);
