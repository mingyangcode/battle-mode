import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import {BattleMusicPage} from '../src/pages/BattleMusicPage';
import type {Track} from '../src/types/track';
import '../src/style.css';import '../src/styles/redesign.css';import '../src/styles/motion.css';import '../src/styles/v14.css';
const tracks:Track[]=Array.from({length:30},(_,i)=>({id:`v14-fixture-${i}`,title:`布局测试音乐 ${i+1}`,duration:180,preRoll:5,isPrepared:false,playedCount:0}));
function Fixture(){const [list,setList]=useState<Track[]>([]),[removed,setRemoved]=useState<Track>();return <div className="app has-bottom-nav"><header className="app-header"><span className="brand">Battle Mode</span></header><main className="app-main"><div>{[0,1,30].map(n=><button key={n} onClick={()=>setList(tracks.slice(0,n))}>{n} tracks</button>)}</div><BattleMusicPage tracks={list} busy={false} onEdit={()=>{}} onImport={files=>setList([...list,...files.map((f,i)=>({...tracks[0],id:`import-${i}`,title:f.name}))])} onDelete={t=>{setRemoved(t);setList(list.filter(x=>x.id!==t.id))}}/></main><nav className="bottom-nav"><button>Battle Music</button><button>Live Battle</button></nav>{removed&&<div className="undo-snackbar"><button onClick={()=>{setList([...list,removed]);setRemoved(undefined)}}>撤销</button></div>}</div>};createRoot(document.getElementById('root')!).render(<Fixture/>);
