import { useState, useEffect, useRef } from 'react'

// Config
const COLORS = ['#6c63ff','#a78bfa','#ec4899','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#3b82f6','#8b5cf6','#d946ef','#f43f5e'];
const ICONS = ['🧘','🏃','📚','✏️','💧','🥗','🏋️','🎵','🧠','💤','🎯','⭐','🚴','🌳','💊','🎨','🖊️','🏊'];
const MAX_INTENSITY = 5;
const STREAK_MILESTONES = [7,14,21,30,60,90,180,365];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const CATEGORIES = {
  none:{label:'All',emoji:''},health:{label:'Health',emoji:'🏥'},fitness:{label:'Fitness',emoji:'💪'},
  learning:{label:'Learning',emoji:'📚'},mindfulness:{label:'Mindfulness',emoji:'🧘'},productivity:{label:'Productivity',emoji:'⚡'},
  social:{label:'Social',emoji:'👥'},creative:{label:'Creative',emoji:'🎨'},other:{label:'Other',emoji:'📌'}
};

// Utils
const pad = n => n < 10 ? '0'+n : ''+n;
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function getLast365Days() {
  const days = [], today = new Date();
  for(let i=364;i>=0;i--){ const d=new Date(today); d.setDate(d.getDate()-i); days.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`); }
  return days;
}

function getMonthLabels(days) {
  const labels = []; let lastM = -1;
  const startDow = new Date(days[0]+'T00:00:00').getDay();
  days.forEach((key,i)=>{ const d=new Date(key+'T00:00:00'); const m=d.getMonth(); if(m!==lastM){ labels.push({label:d.toLocaleString('default',{month:'short'}),col:Math.floor((i+startDow)/7)}); lastM=m; } });
  return {labels,startDow};
}

const getDayOfWeek = dateKey => new Date(dateKey+'T00:00:00').getDay();
const getLogValue = (h,k) => { if(!h.log||h.log[k]===undefined)return 0; const v=h.log[k]; if(v===true)return 1; if(v===false)return 0; return typeof v==='number'?v:0; };
const setLogValue = (h,k,v) => { if(!h.log)h.log={}; if(v<=0)delete h.log[k]; else h.log[k]=v; };
const isActiveDay = (habit,dateKey) => { if(!habit.activeDays||habit.activeDays.length===0)return true; return habit.activeDays.includes(getDayOfWeek(dateKey)); };
const isFreezed = (habit,dateKey) => habit.freezeDates&&habit.freezeDates.includes(dateKey);
const getFreezesUsed = h => h.freezeDates?h.freezeDates.length:0;
const getFreezesMax = h => h.freezePasses||0;

function getStreak(habit) {
  const days=getLast365Days(); let streak=0;
  for(let i=days.length-1;i>=0;i--){ if(!isActiveDay(habit,days[i]))continue; if(getLogValue(habit,days[i])>0||isFreezed(habit,days[i]))streak++; else break; }
  return streak;
}

function getBestStreak(habit) {
  const days=getLast365Days(); let best=0,cur=0;
  days.forEach(d=>{ if(!isActiveDay(habit,d))return; if(getLogValue(habit,d)>0||isFreezed(habit,d)){cur++;best=Math.max(best,cur);} else cur=0; });
  return best;
}

function getTotal(habit) {
  if(!habit.log)return 0;
  if(habit.multiCheck) return Object.values(habit.log).reduce((s,v)=>s+(typeof v==='number'?v:(v?1:0)),0);
  return Object.keys(habit.log).filter(k=>getLogValue(habit,k)>0).length;
}

function getActiveDaysCount(habit) { if(!habit.log)return 0; return Object.keys(habit.log).filter(k=>getLogValue(habit,k)>0).length; }

function getWeeklyProgress(habit) {
  const today=new Date(); const dow=today.getDay();
  const mondayOffset=dow===0?-6:1-dow;
  const monday=new Date(today); monday.setDate(today.getDate()+mondayOffset);
  let completed=0, target=habit.targetDays||7;
  for(let i=0;i<7;i++){ const d=new Date(monday); d.setDate(monday.getDate()+i); const key=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; if(getLogValue(habit,key)>0) completed++; }
  return {completed,target};
}

const getMilestoneEmoji = days => { if(days>=365)return'🏆'; if(days>=180)return'💎'; if(days>=90)return'🥇'; if(days>=60)return'🥈'; if(days>=30)return'🥉'; if(days>=21)return'⚡'; if(days>=14)return'🔥'; return'🌟'; };
const getMilestoneLabel = days => days+' day'+(days===1?'':'s');
const getEarnedBadges = habit => { const streak=getBestStreak(habit); return STREAK_MILESTONES.filter(m=>streak>=m); };

function hexToRgb(hex){ return {r:parseInt(hex.slice(1,3),16),g:parseInt(hex.slice(3,5),16),b:parseInt(hex.slice(5,7),16)}; }
function getCellColor(habit,count){ if(count<=0)return 'var(--border)'; if(!habit.multiCheck)return habit.color; const clamped=Math.min(count,MAX_INTENSITY); const alpha=0.25+(clamped/MAX_INTENSITY)*0.75; const {r,g,b}=hexToRgb(habit.color); return `rgba(${r},${g},${b},${alpha})`; }

// Sound
let audioCtx = null;
const getAudioCtx = () => { if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)(); return audioCtx; };
function playCheckSound() {
  try { const ctx=getAudioCtx(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(520,ctx.currentTime); o.frequency.exponentialRampToValueAtTime(880,ctx.currentTime+0.08); g.gain.setValueAtTime(0.18,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.25); } catch(e){}
}

// MAIN APP
export default function App() {
  const [habits,setHabits]=useState([]);
  const [currentView,setCurrentView]=useState('full');
  const [activeCategory,setActiveCategory]=useState('none');
  const [theme,setTheme]=useState('dark');
  const [modalState,setModalState]=useState({open:false,mode:'add',habitId:null});
  const [confirmModal,setConfirmModal]=useState({open:false,ids:[]});
  const [noteModal,setNoteModal]=useState({open:false,habitId:null,dateKey:null});
  const [dataModal,setDataModal]=useState(false);
  const [celebrationState,setCelebrationState]=useState({open:false,habit:null,milestone:0});
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [toast,setToast]=useState(null);
  const celebShownRef=useRef({});

  // Load/save
  useEffect(()=>{ try{setHabits(JSON.parse(localStorage.getItem('habitus_habits'))||[])}catch(e){setHabits([])} },[]);
  useEffect(()=>{ if(habits.length>=0)localStorage.setItem('habitus_habits',JSON.stringify(habits)); },[habits]);

  // Theme
  useEffect(()=>{ const t=localStorage.getItem('habitus_theme')||'dark'; setTheme(t); document.documentElement.setAttribute('data-theme',t); },[]);
  const toggleTheme=()=>{ const next=theme==='dark'?'light':'dark'; setTheme(next); document.documentElement.setAttribute('data-theme',next); localStorage.setItem('habitus_theme',next); };

  // Notifications
  useEffect(()=>{
    const check=()=>{
      if(typeof Notification==='undefined'||Notification.permission!=='granted')return;
      const now=new Date(); const currentTime=`${pad(now.getHours())}:${pad(now.getMinutes())}`; const today=todayKey();
      let fired={}; try{fired=JSON.parse(localStorage.getItem('habitus_notif_fired'))||{}}catch(e){}
      habits.forEach(h=>{
        if(!h.notifEnabled||!h.reminders||!h.reminders.length)return;
        h.reminders.forEach((rt,ri)=>{
          if(rt!==currentTime)return;
          const fireKey=h.id+'_'+ri;
          if(fired[fireKey]===today)return;
          const count=getLogValue(h,today);
          const body=count>0?(h.multiCheck?`Checked in ${count}× today. Keep going!`:'Already done today 🎉'):'Time to keep your streak alive! 💪';
          try{ new Notification(`${h.icon} ${h.title}`,{body,icon:'/icon.svg',badge:'/icon.svg',tag:'habitus-'+h.id+'-'+ri,silent:false}); }
          catch(err){ showToast(h.icon,`Reminder: ${h.title} — ${body}`); }
          fired[fireKey]=today; localStorage.setItem('habitus_notif_fired',JSON.stringify(fired));
        });
      });
    };
    check(); const interval=setInterval(check,30000);
    return ()=>clearInterval(interval);
  },[habits]);

  // Helpers
  const showToast=(icon,msg)=>{ setToast({icon,msg}); setTimeout(()=>setToast(null),3200); };
  const showCelebration=(habit,days)=>{
    setCelebrationState({open:true,habit,milestone:days});
    setTimeout(()=>setCelebrationState({open:false,habit:null,milestone:0}),4500);
  };
  const checkMilestone=(habit)=>{
    const streak=getStreak(habit);
    const milestone=STREAK_MILESTONES.find(m=>streak>=m&&streak<(STREAK_MILESTONES[STREAK_MILESTONES.indexOf(m)+1]||Infinity));
    if(milestone&&streak===milestone&&!celebShownRef.current[habit.id+'_'+milestone]){
      celebShownRef.current[habit.id+'_'+milestone]=true;
      showCelebration(habit,milestone);
    }
  };

  // Actions
  const checkInToday=id=>{
    const today=todayKey();
    setHabits(prev=>prev.map(h=>{
      if(h.id!==id)return h;
      if(!isActiveDay(h,today))return h;
      const current=getLogValue(h,today);
      if(h.multiCheck) setLogValue(h,today,current+1);
      else setLogValue(h,today,current>0?0:1);
      playCheckSound(); checkMilestone(h);
      return {...h};
    }));
  };

  const undoCheckIn=(id,e)=>{
    e?.stopPropagation();
    const today=todayKey();
    setHabits(prev=>prev.map(h=>{
      if(h.id!==id||!h.multiCheck)return h;
      const current=getLogValue(h,today);
      if(current>0){setLogValue(h,today,current-1);return {...h};}
      return h;
    }));
  };

  const toggleDay=(id,dateKey)=>{
    setHabits(prev=>prev.map(h=>{
      if(h.id!==id||!isActiveDay(h,dateKey))return h;
      const current=getLogValue(h,dateKey);
      const next=current>0?0:1;
      setLogValue(h,dateKey,next);
      if(next>0){playCheckSound();checkMilestone(h);}
      return {...h};
    }));
  };

  const toggleFreeze=(id,dateKey)=>{
    setHabits(prev=>prev.map(h=>{
      if(h.id!==id||!h.freezeEnabled)return h;
      if(!h.freezeDates)h.freezeDates=[];
      const idx=h.freezeDates.indexOf(dateKey);
      if(idx>-1) h.freezeDates.splice(idx,1);
      else if(getFreezesUsed(h)<getFreezesMax(h)) h.freezeDates.push(dateKey);
      return {...h};
    }));
  };

  const deleteHabits=ids=>{ setHabits(prev=>prev.filter(h=>!ids.includes(h.id))); setSelectedIds(new Set()); };

  const saveNote=(habitId,dateKey,text)=>{
    setHabits(prev=>prev.map(h=>{
      if(h.id!==habitId)return h;
      if(!h.notes)h.notes={};
      if(text.trim()) h.notes[dateKey]=text.trim(); else delete h.notes[dateKey];
      return {...h};
    }));
    showToast('📝','Note saved');
  };

  const exportJSON=()=>{
    const blob=new Blob([JSON.stringify(habits,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='habitus_backup.json'; a.click(); URL.revokeObjectURL(url);
    showToast('💾','JSON exported');
  };

  const exportCSV=()=>{
    let csv='id,title,description,category,icon,color,activeDays,multiCheck,targetEnabled,targetDays,freezeEnabled\n';
    habits.forEach(h=>{ csv+=`"${h.id}","${(h.title||'').replace(/"/g,'""')}","${(h.desc||'').replace(/"/g,'""')}","${h.category||''}","${h.icon||''}","${h.color||''}","${(h.activeDays||[]).join(';')}",${!!h.multiCheck},${!!h.targetEnabled},${h.targetDays||7},${!!h.freezeEnabled}\n`; });
    csv+='\n--- Log Data ---\nhabit_id,date,count\n';
    habits.forEach(h=>{if(h.log)Object.entries(h.log).forEach(([d,v])=>{csv+=`"${h.id}","${d}",${typeof v==='number'?v:(v?1:0)}\n`;});});
    const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='habitus_export.csv'; a.click(); URL.revokeObjectURL(url);
    showToast('💾','CSV exported');
  };

  const importJSON=e=>{
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!Array.isArray(data)){showToast('⚠️','Invalid format');return;}
        setHabits(prev=>{
          const merged=[...prev];
          data.forEach(imp=>{ if(!merged.find(h=>h.id===imp.id)){ imp.id=imp.id||Date.now().toString(36)+Math.random().toString(36).slice(2,7); merged.push(imp); } });
          return merged;
        });
        showToast('📥','Imported '+data.length+' habits');
      }catch(err){showToast('⚠️','Parse error');}
    };
    reader.readAsText(file);
  };

  const resetYear=()=>{
    if(!confirm('This will archive all current data and clear all logs. Are you sure?'))return;
    const archive={date:new Date().toISOString(),habits:JSON.parse(JSON.stringify(habits))};
    const archives=JSON.parse(localStorage.getItem('habitus_archives')||'[]');
    archives.push(archive); localStorage.setItem('habitus_archives',JSON.stringify(archives));
    setHabits(prev=>prev.map(h=>({...h,log:{},notes:{},freezeDates:[]})));
    showToast('📦','Year archived & logs reset');
  };

  // Drag & drop
  const [dragSrc,setDragSrc]=useState(null);
  const dragStart=id=>setDragSrc(id);
  const drop=(targetId)=>{
    if(!dragSrc||dragSrc===targetId)return;
    setHabits(prev=>{
      const srcIdx=prev.findIndex(h=>h.id===dragSrc);
      const tgtIdx=prev.findIndex(h=>h.id===targetId);
      if(srcIdx<0||tgtIdx<0)return prev;
      const copy=[...prev]; const [moved]=copy.splice(srcIdx,1); copy.splice(tgtIdx,0,moved);
      return copy;
    });
    setDragSrc(null);
  };

  // Filtered
  const filtered = activeCategory==='none'?habits:habits.filter(h=>(h.category||'none')===activeCategory);
  const cats = new Set(habits.map(h=>h.category||'none')); cats.add('none');

  return (
    <>
      <Header theme={theme} toggleTheme={toggleTheme} currentView={currentView} setCurrentView={setCurrentView} setDataModal={setDataModal} setModalState={setModalState} />
      <CategoryFilter cats={cats} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
      {currentView==='dashboard'?
        <DashboardView habits={filtered} checkInToday={checkInToday} />
      :
        <FullView habits={filtered} checkInToday={checkInToday} undoCheckIn={undoCheckIn} toggleDay={toggleDay} toggleFreeze={toggleFreeze} setModalState={setModalState} setConfirmModal={setConfirmModal} selectedIds={selectedIds} setSelectedIds={setSelectedIds} setNoteModal={setNoteModal} dragStart={dragStart} drop={drop} dragSrc={dragSrc} />
      }
      {selectedIds.size>0&&<BulkBar count={selectedIds.size} onDelete={()=>setConfirmModal({open:true,ids:[...selectedIds]})} onClear={()=>setSelectedIds(new Set())} />}
      {modalState.open&&<HabitModal state={modalState} onClose={()=>setModalState({open:false,mode:'add',habitId:null})} habits={habits} setHabits={setHabits} />}
      {confirmModal.open&&<ConfirmModal ids={confirmModal.ids} onConfirm={()=>{deleteHabits(confirmModal.ids);setConfirmModal({open:false,ids:[]});}} onCancel={()=>setConfirmModal({open:false,ids:[]})} />}
      {noteModal.open&&<NoteModal habitId={noteModal.habitId} dateKey={noteModal.dateKey} habits={habits} onSave={saveNote} onClose={()=>setNoteModal({open:false,habitId:null,dateKey:null})} />}
      {dataModal&&<DataModal onClose={()=>setDataModal(false)} exportJSON={exportJSON} exportCSV={exportCSV} importJSON={importJSON} resetYear={resetYear} />}
      {celebrationState.open&&<Celebration habit={celebrationState.habit} milestone={celebrationState.milestone} onClose={()=>setCelebrationState({open:false,habit:null,milestone:0})} />}
      {toast&&<Toast icon={toast.icon} msg={toast.msg} />}
    </>
  );
}

// COMPONENTS
function Header({theme,toggleTheme,currentView,setCurrentView,setDataModal,setModalState}){
  return (
    <div className="header">
      <div className="logo">Habitus<span>track your rituals</span></div>
      <div className="header-right">
        <div className="view-tabs">
          <button className={`view-tab ${currentView==='full'?'active':''}`} onClick={()=>setCurrentView('full')}>Full</button>
          <button className={`view-tab ${currentView==='dashboard'?'active':''}`} onClick={()=>setCurrentView('dashboard')}>Dashboard</button>
        </div>
        <button className="btn btn--ghost btn--icon" onClick={toggleTheme}>{theme==='dark'?'🌙':'☀️'}</button>
        <button className="btn btn--ghost btn--sm" onClick={()=>setDataModal(true)}>⋮</button>
        <button className="btn" onClick={()=>setModalState({open:true,mode:'add',habitId:null})}>+ New</button>
      </div>
    </div>
  );
}

function CategoryFilter({cats,activeCategory,setActiveCategory}){
  return (
    <div className="cat-filter">
      {[...cats].map(c=>{
        const info=CATEGORIES[c]||{label:c,emoji:''};
        return <button key={c} className={`cat-chip ${activeCategory===c?'active':''}`} onClick={()=>setActiveCategory(c)}>{info.emoji} {info.label}</button>
      })}
    </div>
  );
}

function DashboardView({habits,checkInToday}){
  if(!habits.length)return <div className="empty-state"><div className="empty-icon">🌱</div><p>No habits here yet.</p></div>;
  return (
    <div className="dashboard-grid">
      {habits.map((h,i)=>{
        const count=getLogValue(h,todayKey()); const done=count>0; const todayActive=isActiveDay(h,todayKey());
        return (
          <div key={h.id} className="dash-card" style={{animationDelay:`${i*0.04}s`}}>
            <div className="dash-icon">{h.icon}</div>
            <div className="dash-title">{escHtml(h.title)}</div>
            <div className="dash-streak">🔥 {getStreak(h)} day streak</div>
            <div className="dash-checkin">
              <button className={`checkin-btn ${done?'done':''}`} onClick={()=>checkInToday(h.id)} disabled={!todayActive}>
                <span className="checkin-dot"></span>
                <span>{h.multiCheck?(done?count+'×':'Check in'):(done?'Done':'Check in')}</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FullView({habits,checkInToday,undoCheckIn,toggleDay,toggleFreeze,setModalState,setConfirmModal,selectedIds,setSelectedIds,setNoteModal,dragStart,drop,dragSrc}){
  if(!habits.length)return <div className="container"><div className="empty-state"><div className="empty-icon">🌱</div><p>No habits here yet. Add one to start building your streak.</p></div></div>;
  return (
    <div className="container">
      {habits.map((h,i)=><HabitCard key={h.id} habit={h} index={i} checkInToday={checkInToday} undoCheckIn={undoCheckIn} toggleDay={toggleDay} toggleFreeze={toggleFreeze} setModalState={setModalState} setConfirmModal={setConfirmModal} selectedIds={selectedIds} setSelectedIds={setSelectedIds} setNoteModal={setNoteModal} dragStart={dragStart} drop={drop} isDragging={dragSrc===h.id} />)}
    </div>
  );
}

function HabitCard({habit,index,checkInToday,undoCheckIn,toggleDay,toggleFreeze,setModalState,setConfirmModal,selectedIds,setSelectedIds,setNoteModal,dragStart,drop,isDragging}){
  const h=habit; const count=getLogValue(h,todayKey()); const done=count>0; const todayActive=isActiveDay(h,todayKey());
  const badges=getEarnedBadges(h); const {completed,target}=h.targetEnabled?getWeeklyProgress(h):{completed:0,target:0};
  return (
    <div className={`habit-card ${isDragging?'dragging':''}`} draggable style={{animationDelay:`${index*0.035}s`}} onDragStart={()=>dragStart(h.id)} onDragOver={e=>e.preventDefault()} onDrop={()=>drop(h.id)}>
      <div className="habit-header">
        <div className="habit-title-row">
          <span className="drag-handle">⠿</span>
          <div className={`checkbox ${selectedIds.has(h.id)?'checked':''}`} onClick={()=>setSelectedIds(prev=>{const next=new Set(prev);if(next.has(h.id))next.delete(h.id);else next.add(h.id);return next;})}></div>
          <div className="habit-icon" style={{background:h.color+'22',color:h.color}}>{h.icon}</div>
          <div className="habit-info">
            <h3>{escHtml(h.title)}</h3>
            <p>{h.desc?escHtml(h.desc):'No description'}</p>
            {h.notifEnabled&&h.reminders&&h.reminders.length>0&&<div className="notif-badge">🔔 {h.reminders.join(', ')}</div>}
            {h.freezeEnabled&&<div className="freeze-badge">❄️ {getFreezesMax(h)-getFreezesUsed(h)} freezes left</div>}
          </div>
        </div>
        <div className="habit-actions">
          <button className={`checkin-btn ${done?'done':''}`} onClick={()=>checkInToday(h.id)} disabled={!todayActive}>
            <span className="checkin-dot"></span>
            <span>{h.multiCheck?(done?count+'× done':'Check in'):(done?'Done today':'Check in')}</span>
            {h.multiCheck&&done&&<span className="checkin-count">+1</span>}
          </button>
          {h.multiCheck&&done&&<button className="undo-btn" onClick={e=>undoCheckIn(h.id,e)}>↩</button>}
          {h.freezeEnabled&&!done&&todayActive&&<button className="btn btn--ghost btn--sm" onClick={()=>toggleFreeze(h.id,todayKey())} style={{color:'#06b6d4',borderColor:'#06b6d4'}}>❄️</button>}
          <button className="btn btn--ghost btn--sm" onClick={()=>setModalState({open:true,mode:'edit',habitId:h.id})}>Edit</button>
          <button className="btn btn--danger btn--sm" onClick={()=>setConfirmModal({open:true,ids:[h.id]})}>✕</button>
        </div>
      </div>
      {badges.length>0&&<div className="badges-row">{badges.map(m=><div key={m} className="badge"><span className="badge-icon">{getMilestoneEmoji(m)}</span>{getMilestoneLabel(m)}</div>)}</div>}
      {h.activeDays&&h.activeDays.length<7&&<div className="active-days-row">{DAY_LABELS.map((l,i)=>{const on=h.activeDays.includes(i);const cls=on?'active-day':(i===new Date().getDay()?'inactive-today':'');return <div key={i} className={`day-pill ${cls}`}>{l}</div>;})}</div>}
      {!todayActive&&<div style={{fontSize:'.65rem',color:'var(--text-muted)',marginBottom:'6px'}}>🚫 Not active today</div>}
      <Stats habit={h} completed={completed} target={target} />
      <Matrix habit={h} toggleDay={toggleDay} setNoteModal={setNoteModal} />
    </div>
  );
}

function Stats({habit,completed,target}){
  const circumference=2*Math.PI*10; const offset=target>0?circumference-((completed/target)*circumference):circumference;
  const ringColor=completed>=target?'var(--green)':habit.color;
  return (
    <div className="habit-stats">
      <div className="stat">Streak <strong>{getStreak(habit)} days</strong></div>
      <div className="stat">Best <strong>{getBestStreak(habit)} days</strong></div>
      <div className="stat">{habit.multiCheck?'Check-ins':'Done'} <strong>{getTotal(habit)}</strong></div>
      {habit.multiCheck&&<div className="stat">Days <strong>{getActiveDaysCount(habit)}</strong></div>}
      {habit.targetEnabled&&(
        <div className="target-ring-wrap">
          <div className={`target-ring ${completed>=target?'complete':''}`}>
            <svg width="28" height="28"><circle className="ring-bg" cx="14" cy="14" r="10"/><circle className="ring-fill" cx="14" cy="14" r="10" stroke={ringColor} strokeDasharray={circumference} strokeDashoffset={offset}/></svg>
            <div className="ring-text">{completed}/{target}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Matrix({habit,toggleDay,setNoteModal}){
  const days=getLast365Days(); const {labels,startDow}=getMonthLabels(days);
  const totalCols=Math.ceil((days.length+startDow)/7); const cols=[]; for(let c=0;c<totalCols;c++)cols.push([]);
  days.forEach((key,i)=>{ cols[Math.floor((i+startDow)/7)][(i+startDow)%7]=key; });
  return (
    <div className="matrix-wrapper">
      <div className="matrix-scroll">
        <div className="month-labels">{labels.map((l,i)=><span key={i} className="month-label" style={{left:`${l.col*15}px`}}>{l.label}</span>)}</div>
        <div className="matrix-grid">
          {cols.map((col,c)=>(
            <div key={c} className="matrix-col">
              {col.map((key,r)=>{
                if(!key)return <div key={r} className="matrix-cell" style={{visibility:'hidden'}}></div>;
                const active=isActiveDay(habit,key); const count=getLogValue(habit,key); const freezed=isFreezed(habit,key);
                const bg=!active?'var(--border)':(freezed?'#06b6d4':getCellColor(habit,count));
                const d=new Date(key+'T00:00:00'); const tip=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
                const extra=(habit.multiCheck&&count>0?` · ${count}×`:'')+(freezed?' [frozen]':'')+(habit.notes&&habit.notes[key]?' 📝':'');
                return (
                  <div key={r} className={`matrix-cell ${count>0||freezed?'active':''} ${!active?'inactive-cell':''}`} style={{background:bg}} onClick={()=>toggleDay(habit.id,key)} onContextMenu={e=>{e.preventDefault();setNoteModal({open:true,habitId:habit.id,dateKey:key});}}>
                    <span className="tooltip">{count>0||freezed?'✓ ':''}{tip}{extra}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Modals
function HabitModal({state,onClose,habits,setHabits}){
  const editing=state.mode==='edit'?habits.find(h=>h.id===state.habitId):null;
  const [title,setTitle]=useState(editing?editing.title:'');
  const [desc,setDesc]=useState(editing?(editing.desc||''):'');
  const [category,setCategory]=useState(editing?(editing.category||'none'):'none');
  const [color,setColor]=useState(editing?editing.color:COLORS[0]);
  const [icon,setIcon]=useState(editing?editing.icon:ICONS[0]);
  const [activeDays,setActiveDays]=useState(editing&&editing.activeDays?[...editing.activeDays]:[0,1,2,3,4,5,6]);
  const [multiCheck,setMultiCheck]=useState(editing?!!editing.multiCheck:false);
  const [targetEnabled,setTargetEnabled]=useState(editing?!!editing.targetEnabled:false);
  const [targetDays,setTargetDays]=useState(editing&&editing.targetDays?editing.targetDays:7);
  const [freezeEnabled,setFreezeEnabled]=useState(editing?!!editing.freezeEnabled:false);
  const [freezePasses,setFreezePasses]=useState(editing&&editing.freezePasses?editing.freezePasses:3);
  const [notifEnabled,setNotifEnabled]=useState(editing?!!editing.notifEnabled:false);
  const [reminders,setReminders]=useState(editing&&editing.reminders?[...editing.reminders]:['08:00']);

  const save=()=>{
    if(!title.trim())return;
    const data={title,desc,category,color,icon,activeDays:activeDays.length<7?activeDays:[0,1,2,3,4,5,6],multiCheck,targetEnabled,targetDays,freezeEnabled,freezePasses,freezeDates:editing?editing.freezeDates:[],notifEnabled,reminders:notifEnabled?reminders:[],log:editing?editing.log:{},notes:editing?editing.notes:{}};
    if(editing) setHabits(prev=>prev.map(h=>h.id===editing.id?{...editing,...data}:h));
    else setHabits(prev=>[...prev,{...data,id:Date.now().toString(36)+Math.random().toString(36).slice(2,7)}]);
    onClose();
  };

  const requestPerm=()=>{ Notification.requestPermission(); };
  const perm=typeof Notification!=='undefined'?Notification.permission:'denied';

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>{state.mode==='edit'?'Edit Habit':'New Habit'}</h2>
        <div className="form-group"><label>Title</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Morning Meditation" maxLength={40}/></div>
        <div className="form-group"><label>Description</label><textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Why does this matter to you?"/></div>
        <div className="form-group"><label>Category</label>
          <select value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="none">— None —</option>
            {Object.entries(CATEGORIES).filter(([k])=>k!=='none').map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </div>
        <div className="picker-row">
          <div className="form-group"><label>Color</label><div className="color-swatches">{COLORS.map(c=><div key={c} className={`color-swatch ${c===color?'selected':''}`} style={{background:c}} onClick={()=>setColor(c)}/>)}</div></div>
          <div className="form-group"><label>Icon</label><div className="icon-grid">{ICONS.map(ic=><div key={ic} className={`icon-opt ${ic===icon?'selected':''}`} onClick={()=>setIcon(ic)}>{ic}</div>)}</div></div>
        </div>
        <div className="form-group"><label>Active days</label>
          <div className="days-picker">{DAY_LABELS.map((l,i)=><button key={i} className={`days-picker-btn ${activeDays.includes(i)?'on':''}`} onClick={()=>setActiveDays(prev=>{const idx=prev.indexOf(i);if(idx>-1){const n=[...prev];n.splice(idx,1);return n;}return [...prev,i];})}>{l}</button>)}</div>
        </div>
        <div className="form-group"><div className="toggle-row"><div className="toggle-label">Multiple check-ins/day<span className="toggle-sub">Track reps — matrix shades by intensity</span></div><label className="toggle-switch"><input type="checkbox" checked={multiCheck} onChange={e=>setMultiCheck(e.target.checked)}/><span className="slider"></span></label></div></div>
        <div className="form-group"><div className="toggle-row"><div className="toggle-label">Weekly target<span className="toggle-sub">Set a days/week goal with a progress ring</span></div><label className="toggle-switch"><input type="checkbox" checked={targetEnabled} onChange={e=>setTargetEnabled(e.target.checked)}/><span className="slider"></span></label></div>
          {targetEnabled&&<div className="target-section"><div className="form-group" style={{marginBottom:0}}><label>Days per week</label><select value={targetDays} onChange={e=>setTargetDays(parseInt(e.target.value))}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} day{n===1?'':'s'}</option>)}</select></div></div>}
        </div>
        <div className="form-group"><div className="toggle-row"><div className="toggle-label">Streak freeze<span className="toggle-sub">Use a freeze pass on missed days to protect your streak</span></div><label className="toggle-switch"><input type="checkbox" checked={freezeEnabled} onChange={e=>setFreezeEnabled(e.target.checked)}/><span className="slider"></span></label></div>
          {freezeEnabled&&<div className="freeze-section"><div className="form-group" style={{marginBottom:0}}><label>Freeze passes available</label><select value={freezePasses} onChange={e=>setFreezePasses(parseInt(e.target.value))}>{[1,2,3,5].map(n=><option key={n} value={n}>{n} pass{n===1?'':'es'}</option>)}</select></div><div className="freeze-info">Freeze passes protect your streak when you miss an active day. They reset when you manually use them.</div></div>}
        </div>
        <div className="form-group"><div className="toggle-row"><div className="toggle-label">Daily reminders<span className="toggle-sub">Set one or more reminder times</span></div><label className="toggle-switch"><input type="checkbox" checked={notifEnabled} onChange={e=>setNotifEnabled(e.target.checked)}/><span className="slider"></span></label></div>
          {notifEnabled&&<div className="notif-section"><div className="reminder-list">{reminders.map((t,i)=><div key={i} className="reminder-item"><input type="time" value={t} onChange={e=>{const n=[...reminders];n[i]=e.target.value;setReminders(n);}}/>{i>0&&<button className="btn btn--ghost btn--sm btn--icon" onClick={()=>setReminders(prev=>prev.filter((_,idx)=>idx!==i))} style={{color:'var(--red)'}}>✕</button>}</div>)}</div><button className="add-reminder-btn" onClick={()=>setReminders([...reminders,'08:00'])}>+ Add another time</button><div className="notif-hint">{perm==='granted'?<span style={{color:'var(--green)'}}>✓ Notifications enabled.</span>:(perm==='denied'?'Notifications are blocked. Allow them in browser settings.':'Notifications are not yet allowed. ')}{perm==='default'&&<button className="perm-btn" onClick={requestPerm}>Allow notifications</button>}</div></div>}
        </div>
        <div className="modal-actions"><button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button><button className="btn btn--sm" onClick={save}>{state.mode==='edit'?'Save Changes':'Create Habit'}</button></div>
      </div>
    </div>
  );
}

function ConfirmModal({ids,onConfirm,onCancel}){
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div className="modal" style={{maxWidth:'340px'}}>
        <button className="modal-close" onClick={onCancel}>&times;</button>
        <h2>Delete Habit</h2>
        <p className="confirm-text">{ids.length===1?'Are you sure? All data for this habit will be permanently lost.':`Delete ${ids.length} habits? All data will be permanently lost.`}</p>
        <div className="modal-actions"><button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button><button className="btn btn--danger btn--sm" onClick={onConfirm}>Delete</button></div>
      </div>
    </div>
  );
}

function NoteModal({habitId,dateKey,habits,onSave,onClose}){
  const h=habits.find(x=>x.id===habitId); const [text,setText]=useState((h?.notes&&h.notes[dateKey])||'');
  const d=new Date(dateKey+'T00:00:00'); const dateLabel=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:'380px'}}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Journal Note</h2>
        <p className="note-modal-date">{dateLabel} · {escHtml(h?.title||'')}</p>
        <div className="form-group"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="How did it go today?"/></div>
        <div className="modal-actions"><button className="btn btn--ghost btn--sm" onClick={onClose}>Cancel</button><button className="btn btn--sm" onClick={()=>{onSave(habitId,dateKey,text);onClose();}}>Save Note</button></div>
      </div>
    </div>
  );
}

function DataModal({onClose,exportJSON,exportCSV,importJSON,resetYear}){
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:'380px'}}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Data & Backup</h2>
        <div className="form-group"><label>Export</label><div className="export-row"><button className="btn btn--ghost btn--sm" onClick={exportJSON}>JSON</button><button className="btn btn--ghost btn--sm" onClick={exportCSV}>CSV</button></div></div>
        <div className="form-group"><label>Import</label><input type="file" accept=".json" style={{fontSize:'.72rem',color:'var(--text-secondary)'}} onChange={importJSON}/></div>
        <div className="form-group"><label>Reset Year</label><p style={{fontSize:'.68rem',color:'var(--text-muted)',marginBottom:'6px',lineHeight:'1.4'}}>Archives current data to a backup key in localStorage, then clears all logs to start fresh.</p><button className="btn btn--danger btn--sm" onClick={resetYear}>Archive & Reset</button></div>
        <div className="modal-actions"><button className="btn btn--ghost btn--sm" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function Celebration({habit,milestone,onClose}){
  const colors=['#6c63ff','#a78bfa','#ec4899','#f97316','#22c55e','#06b6d4','#f43f5e','#eab308'];
  return (
    <div className="celebration">
      <div>{Array.from({length:60}).map((_,i)=><div key={i} className="confetti-piece" style={{left:`${Math.random()*100}%`,background:colors[Math.floor(Math.random()*colors.length)],animationDelay:`${Math.random()*0.6}s`,width:`${4+Math.random()*6}px`,height:`${4+Math.random()*6}px`,borderRadius:Math.random()>0.5?'50%':'2px'}}/>)}</div>
      <div className="celebration-card">
        <div className="celeb-emoji">{getMilestoneEmoji(milestone)}</div>
        <h3>{milestone}-Day Streak!</h3>
        <p>Amazing work on "{habit?.title}". Keep it up!</p>
        <button className="btn celeb-close" onClick={onClose}>Awesome!</button>
      </div>
    </div>
  );
}

function BulkBar({count,onDelete,onClear}){
  return <div className="bulk-bar"><span><strong>{count}</strong> selected</span><button className="btn btn--danger btn--sm" onClick={onDelete}>Delete</button><button className="btn btn--ghost btn--sm" onClick={onClear}>Cancel</button></div>;
}

function Toast({icon,msg}){
  return <div className="toast show"><span className="toast-icon">{icon}</span><span>{msg}</span></div>;
}
