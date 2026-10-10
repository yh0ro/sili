'use client';

import {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowUpRight, ArrowRight, ArrowLeft, Plus, RotateCcw, X, Check, Users, Focus, MessageSquare, BookOpen} from 'lucide-react';
import {personality, type Agent, type Encounter, type WorldSnapshot} from '@/lib/silicon/domain';
import {worldviewQuestions} from '@/lib/silicon/worldview';
import {advanceDemo, agentHistory, createDemo, createShared, getConfig, importLegacyShared, initialWorld, legacyImportCandidate, loadDemo, snapshot, sharedTick} from '@/lib/silicon/client';
import AgentXLink from './AgentXLink';
import ContractButton from './ContractButton';

const WorldScene = lazy(() => import('./WorldScene'));
const AvatarPreview = lazy(() => import('./WorldScene').then(m => ({default:m.AvatarPreview})));
type View = 'home' | 'create' | 'world';
type AgentTab = 'thoughts' | 'friends' | 'conversations';
const quizStorage = 'silicon-quiz-v2';
const localNames = ['Aster', 'Vela', 'Orin', 'Lumen', 'Nilo', 'Echo', 'Sol', 'Arden'];
const activityText: Record<string, string> = {Idle:'Taking a break', Walking:'Exploring', Observing:'Looking around', Approaching:'Going to meet someone', Conversing:'Talking', Resting:'Resting'};

function since(time:number, now = Date.now()) {
 const minutes = Math.max(0, Math.round((now - time) / 60000));
 return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : `${Math.floor(minutes / 60)}h ago`;
}
function LoadingScene() {
 return <div className="scene-loading"><span className="loading-orbit"/><span>Loading world</span></div>;
}
function Dialog({children, onClose, label, className = ''}:{children:React.ReactNode; onClose:()=>void; label:string; className?:string}) {
 const ref = useRef<HTMLDivElement>(null);
 useEffect(() => {
  const previousFocus = document.activeElement as HTMLElement;
  const focusables = () => ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]');
  focusables()?.[0]?.focus();
  function keys(event:KeyboardEvent) {
   if (event.key === 'Escape') onClose();
   if (event.key !== 'Tab') return;
   const elements = focusables();
   if (!elements?.length) return;
   const first = elements[0], last = elements[elements.length - 1];
   if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
   else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
  }
  document.addEventListener('keydown', keys);
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => {document.removeEventListener('keydown', keys); document.body.style.overflow = previousOverflow; previousFocus?.focus();};
 }, [onClose]);
 return <div className="dialog-backdrop" onClick={onClose}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className={`dialog ${className}`} onClick={event=>event.stopPropagation()}><button className="icon-button dialog-close" aria-label="Close dialog" onClick={onClose}><X size={20}/></button>{children}</div></div>;
}

function AgentPanel({agent, world, following, mine, reduced, onClose, onFollow, onSelect, onConversation, onUpdate}:{agent:Agent; world:WorldSnapshot; following:boolean; mine:boolean; reduced:boolean; onClose:()=>void; onFollow:()=>void; onSelect:(id:string)=>void; onConversation:(encounter:Encounter)=>void; onUpdate:(world:WorldSnapshot)=>void}) {
 const [tab, setTab] = useState<AgentTab>('thoughts');
 const [clock, setClock] = useState(world.serverTime);
 const clockRef = useRef(world.serverTime);
 const [pastConversations,setPastConversations] = useState<Encounter[]>([]), [historyBefore,setHistoryBefore] = useState<number|null>(null), [historyBusy,setHistoryBusy] = useState(false), [historyError,setHistoryError] = useState(''), [conversationCount,setConversationCount] = useState(50);
 const historyLoading = useRef(false);
 const agentsById = useMemo(()=>new Map(world.agents.map(item=>[item.id,item])),[world.agents]);
 useEffect(()=>{
  if(world.mode==='local-demo')return;
  let active=true;historyLoading.current=true;setHistoryBusy(true);setHistoryError('');
  void agentHistory(agent.id).then(result=>{if(active){setPastConversations(result.encounters);setHistoryBefore(result.nextBefore);}}).catch(reason=>{if(active)setHistoryError((reason as Error).message);}).finally(()=>{if(active){historyLoading.current=false;setHistoryBusy(false);}});
  return()=>{active=false;};
 },[agent.id,world.mode]);
 useEffect(() => {
  const anchor=Math.max(clockRef.current,world.serverTime);
  clockRef.current=anchor;setClock(anchor);
  if (agent.activity !== 'Conversing') return;
  const started = performance.now();
  const interval = setInterval(() => {clockRef.current=Math.max(clockRef.current,anchor+performance.now()-started);setClock(clockRef.current);}, 1000);
  return () => clearInterval(interval);
 }, [world.serverTime, agent.activity]);
 const conversations = useMemo(()=>{
  const records=new Map(pastConversations.map(encounter=>[encounter.id,encounter]));
  for(const encounter of world.encounters)if(encounter.participants.includes(agent.id))records.set(encounter.id,encounter);
  return [...records.values()].sort((a,b)=>b.createdAt-a.createdAt);
 },[pastConversations,world.encounters,agent.id]);
 async function earlierConversations() {
  if(historyLoading.current)return;
  if(conversationCount<conversations.length){setConversationCount(count=>count+50);return;}
  historyLoading.current=true;setHistoryBusy(true);setHistoryError('');
  try {
   const oldest=conversations.at(-1)?.createdAt;
   const before=historyBefore&&oldest?Math.min(historyBefore,oldest):historyBefore||undefined;
   const result=await agentHistory(agent.id,before);
   setPastConversations(previous=>[...previous,...result.encounters]);setHistoryBefore(result.nextBefore);setConversationCount(count=>count+50);
  }catch(reason){setHistoryError((reason as Error).message);}
  finally{historyLoading.current=false;setHistoryBusy(false);}
 }
 const currentConversation = conversations.find(encounter => agent.activity === 'Conversing' && clock >= encounter.createdAt && clock - encounter.createdAt < (encounter.duration || 24000));
 const lineDuration = currentConversation ? (currentConversation.duration || 24000) / Math.max(1,currentConversation.lines.length) : 6000;
 const currentLine = currentConversation?.lines[Math.min(currentConversation.lines.length - 1, Math.floor((clock - currentConversation.createdAt) / lineDuration))];
 const currentPartner = currentConversation?.participants.find(id => id !== agent.id);
 const friends = [...agent.relationships].sort((a,b) => b.affinity - a.affinity);
 const thoughts: {id:string; text:string; createdAt:number; encounterId?:string}[] = agent.thoughts?.length ? [...agent.thoughts].sort((a,b)=>b.createdAt-a.createdAt) : [{id:`opening-${agent.id}`, text:agent.openingThought, createdAt:agent.createdAt}];
 const beliefs = agent.beliefs || [];
 return <aside className={`character-drawer ${following?'is-following':''}`} aria-label={`${following?'Following':'Profile of'} ${agent.name}`}>
  <button className="icon-button drawer-close" aria-label="Close agent profile" onClick={onClose}><X size={19}/></button>
  <div className="character-preview"><Suspense fallback={<span className="loading-orbit"/>}><AvatarPreview seed={agent.seed} accent={agent.accent} traits={agent.traits} reducedMotion={reduced}/></Suspense></div>
  <div className="character-details">
   <div className="agent-panel-heading"><span className="mono">{following?'Following':mine?'Your agent':'Agent'}</span><h2>{agent.name}</h2><p>{activityText[agent.activity] || agent.activity}</p></div>
   <AgentXLink key={agent.id} agent={agent} mine={mine} onUpdate={onUpdate}/>
   <button className="drawer-follow" aria-pressed={following} onClick={onFollow}><Focus size={16}/>{following?'Stop following':'Follow agent'}</button>
   <section className="agent-current-thought" aria-label="Current thought"><h3>Thinking</h3><p>{agent.currentThought || thoughts[0].text}</p></section>
   {currentConversation && currentLine && <section className="conversation-preview" aria-label="Current conversation"><h3>Talking with {agentsById.get(currentPartner||'')?.name || 'another agent'}</h3><p><strong>{agentsById.get(currentLine.speakerId)?.name || 'Agent'}:</strong> {currentLine.text}</p><button className="text-button" onClick={()=>onConversation(currentConversation)}>Read conversation <ArrowUpRight size={14}/></button></section>}
   <div className="agent-tabs" role="group" aria-label="Agent details">{(['thoughts','friends','conversations'] as const).map(section=><button key={section} aria-pressed={tab===section} onClick={()=>setTab(section)}>{section[0].toUpperCase()+section.slice(1)}{section==='friends'&&friends.length>0?` (${friends.length})`:''}</button>)}</div>
   <div className="agent-tab-content">
    {tab==='thoughts' && <><ol className="thought-list">{thoughts.slice(0,12).map(thought=><li key={thought.id}><p>{thought.text}</p><small>{since(thought.createdAt, clock)}</small>{thought.encounterId && <button className="text-button" onClick={()=>{const encounter=conversations.find(item=>item.id===thought.encounterId); if(encounter)onConversation(encounter);}}>Read conversation <ArrowUpRight size={12}/></button>}</li>)}</ol>{beliefs.length>0 && <details className="agent-worldview"><summary>Worldview</summary><dl className="belief-list">{beliefs.map(belief=><div key={belief.questionId}><dt>{belief.question}</dt><dd>{belief.answer}</dd></div>)}</dl></details>}</>}
    {tab==='friends' && (friends.length ? <div className="agent-friends">{friends.map(friend=>{const other=agentsById.get(friend.agentId);return <button className="agent-friend" key={friend.agentId} onClick={()=>onSelect(friend.agentId)}><span><strong>{other?.name || 'Agent'}<span>{friend.encounters} conversation{friend.encounters===1?'':'s'}</span></strong></span><ArrowUpRight size={14}/></button>;})}</div> : <p className="agent-empty">No friends yet.</p>)}
    {tab==='conversations' && <>{conversations.length ? <div className="agent-conversations">{conversations.slice(0,conversationCount).map(conversation=><button key={conversation.id} onClick={()=>onConversation(conversation)}><strong>{conversation.topic}</strong><span>{conversation.participants.filter(id=>id!==agent.id).map(id=>agentsById.get(id)?.name || 'Agent').join(', ')} · {since(conversation.createdAt, clock)}</span><ArrowUpRight size={14}/></button>)}</div> : <p className="agent-empty">{historyBusy?'Loading conversations…':'No conversations yet.'}</p>}{historyError && <p className="agent-empty" role="alert">{historyError}</p>}{(historyError||historyBefore!==null||conversations.length>conversationCount) && <button className="text-button history-more" disabled={historyBusy} onClick={()=>void earlierConversations()}>{historyBusy?'Loading…':historyError?'Retry history':'Earlier conversations'}</button>}</>}
   </div>
   <a className="profile-link" href={`/successor/${agent.id}`}>Open profile <ArrowUpRight size={12}/></a>
  </div>
 </aside>;
}

export default function Experience({initialView, profileId}:{initialView:View; profileId?:string}) {
 const [view,setView] = useState<View>(initialView);
 const [contractAddress,setContractAddress] = useState('');
 useEffect(()=>{let active=true;const refresh=()=>{if(document.visibilityState==='visible')void getConfig().then(config=>{if(active)setContractAddress(config.contractAddress||'');}).catch(()=>{});};const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 const [world,setWorld] = useState<WorldSnapshot>(()=>({...initialWorld(),agents:[],totalPopulation:0,awakePopulation:0}));
 const [ready,setReady] = useState(false), [connected,setConnected] = useState(false), [error,setError] = useState('');
 const [selectedId,setSelectedId] = useState<string|null>(profileId || null), [follow,setFollow] = useState<string|null>(null);
 const [reset,setReset] = useState(0), [feed,setFeed] = useState(true), [list,setList] = useState(false), [idea,setIdea] = useState(false), [archive,setArchive] = useState(false);
 const [encounter,setEncounter] = useState<Encounter|null>(null), [born,setBorn] = useState(false), [reduced,setReduced] = useState(false);
 const [step,setStep] = useState(0), [answers,setAnswers] = useState<number[]>(()=>worldviewQuestions.map(()=>-1)), [name,setName] = useState('');
 const [busy,setBusy] = useState(false), [quizError,setQuizError] = useState(''), [savedWarning,setSavedWarning] = useState('');
 const [legacyAgent,setLegacyAgent] = useState<ReturnType<typeof legacyImportCandidate>>(null), [migrationHidden,setMigrationHidden] = useState(false), [migrationBusy,setMigrationBusy] = useState(false), [migrationError,setMigrationError] = useState('');
 const [agentSearch,setAgentSearch] = useState(''), [listedCount,setListedCount] = useState(50), [landmark,setLandmark] = useState<string|null>(null);
 const worldRef = useRef(world), creating = useRef(false), tickBusy = useRef(false), hasSnapshot = useRef(false);
 const acceptSnapshot=useCallback((next:WorldSnapshot):WorldSnapshot=>{
  const current=worldRef.current;
  if(hasSnapshot.current&&next.serverTime<current.serverTime){
   // A slower poll must not replace newer movement plans. Preserve a newly created identity.
   if(next.mineId&&next.mineId!==current.mineId){
    const mine=next.agents.find(agent=>agent.id===next.mineId);
    const agents=mine&&!current.agents.some(agent=>agent.id===mine.id)?[...current.agents,mine]:current.agents;
    const merged={...current,agents,mineId:next.mineId,totalPopulation:Math.max(current.totalPopulation??current.agents.length,agents.length)};
    worldRef.current=merged;setWorld(merged);return merged;
   }
   return current;
  }
  hasSnapshot.current=true;worldRef.current=next;setWorld(next);return next;
 },[]);
 const closeLandmark = useCallback(()=>setLandmark(null),[]);
 useEffect(()=>{const change=(event:StorageEvent)=>{if(event.key==='silicon-world-v1' && worldRef.current.mode==='local-demo')acceptSnapshot(loadDemo());};window.addEventListener('storage',change);return()=>window.removeEventListener('storage',change);},[acceptSnapshot]);
 const initialise = useCallback(async()=>{
  setError('');
  try {const config=await getConfig();setContractAddress(config.contractAddress||'');acceptSnapshot(config.mode==='local-demo'?loadDemo():await snapshot());setLegacyAgent(config.mode==='local-demo'?null:legacyImportCandidate());setConnected(true);}
  catch(reason){setError((reason as Error).message);setConnected(false);}
  finally {setReady(true);}
 },[acceptSnapshot]);
 useEffect(()=>{
  void initialise();
  const media=matchMedia('(prefers-reduced-motion: reduce)');setReduced(media.matches);
  const motionChange=()=>setReduced(media.matches);media.addEventListener('change',motionChange);
  try {const draft=JSON.parse(sessionStorage.getItem(quizStorage)||'null');if(draft&&Array.isArray(draft.answers)&&draft.answers.length===worldviewQuestions.length){setAnswers(draft.answers.map((answer:number)=>Number.isInteger(answer)&&answer>=0&&answer<3?answer:-1));setStep(Math.max(0,Math.min(worldviewQuestions.length,Number(draft.step)||0)));setName(typeof draft.name==='string'?draft.name:'');}}
  catch {}
  const pop=()=>{const path=location.pathname;setView(path==='/create'?'create':path==='/world'||path.startsWith('/successor/')?'world':'home');};
  window.addEventListener('popstate',pop);
  return()=>{media.removeEventListener('change',motionChange);window.removeEventListener('popstate',pop);};
 },[initialise]);
 useEffect(()=>{if(ready)try{sessionStorage.setItem(quizStorage,JSON.stringify({answers,name,step}));}catch{}},[answers,name,step,ready]);
 useEffect(()=>{
  if(!ready||!connected)return;
  const update=async()=>{
   if(document.hidden||tickBusy.current)return;
   tickBusy.current=true;
   try {acceptSnapshot(worldRef.current.mode==='local-demo'?advanceDemo(worldRef.current):await sharedTick());setError('');}
   catch(reason){setError((reason as Error).message);}
   finally {tickBusy.current=false;}
  };
  const interval=setInterval(()=>void update(),4000);
  const visibility=()=>{if(!document.hidden)void update();};
  document.addEventListener('visibilitychange',visibility);void update();
  return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',visibility);};
 },[ready,connected,acceptSnapshot]);
 const mine=world.agents.find(agent=>agent.id===world.mineId), selected=world.agents.find(agent=>agent.id===selectedId);
 const modeLabel=!ready?'Connecting':!connected?'Disconnected':world.mode==='local-demo'?'Local world':'Live';
 const matchingAgents=useMemo(()=>{const query=agentSearch.trim().toLowerCase();return world.agents.filter(agent=>!query || agent.name.toLowerCase().includes(query));},[world.agents,agentSearch]);
 const visibleAgents=useMemo(()=>ready?world.agents.filter(agent=>agent.activity!=='Resting'||agent.id===world.mineId||agent.id===selectedId||agent.id===follow):[],[world.agents,world.mineId,selectedId,follow,ready]);
 function go(next:View) {
  if(next==='create'&&world.mineId){next='world';setSelectedId(world.mineId);setFollow(world.mineId);}
  history.pushState(null,'',next==='home'?'/':`/${next}`);setView(next);setQuizError('');window.scrollTo({top:0,behavior:'instant'});
 }
 function select(id:string){setSelectedId(id);setFollow(null);setList(false);if(view==='home')go('world');}
 function followAgent(id:string){setSelectedId(id);setFollow(id);setList(false);if(view!=='world')go('world');}
 async function importAgent() {
  if(migrationBusy)return;
  setMigrationBusy(true);setMigrationError('');
  try {const next=acceptSnapshot(await importLegacyShared());setMigrationHidden(true);if(next.mineId){setSelectedId(next.mineId);setFollow(next.mineId);}setSavedWarning('Everyone in the world can see your agent.');setBorn(true);go('world');}
  catch(reason){setMigrationError((reason as Error).message);}
  finally {setMigrationBusy(false);}
 }
 async function birth() {
  if(creating.current)return;
  setQuizError('');const trimmed=name.trim();
  if(answers.some(answer=>answer<0)){setQuizError('Answer all five questions first.');setStep(Math.max(0,answers.findIndex(answer=>answer<0)));return;}
  if(trimmed.length<2||trimmed.length>24||!/^\p{L}[\p{L}\p{N} '\-]*$/u.test(trimmed)){setQuizError('Use 2–24 letters, numbers, spaces, apostrophes or hyphens. Start with a letter.');return;}
  if(!connected){setQuizError('Reconnect before creating your agent. Your answers are saved.');return;}
  creating.current=true;setBusy(true);
  try {const next=acceptSnapshot(world.mode==='local-demo'?createDemo(worldRef.current,trimmed,answers):await createShared(trimmed,answers));setSelectedId(next.mineId||null);setFollow(next.mineId||null);setBorn(true);go('world');sessionStorage.removeItem(quizStorage);setSavedWarning(next.mode==='local-demo'?'Saved on this device.':'Everyone in the world can see your agent.');}
  catch(reason){setQuizError((reason as Error).message);}
  finally {creating.current=false;setBusy(false);}
 }
 const preview=personality(answers.map(answer=>answer<0?0:answer));
 const closeIdea=useCallback(()=>setIdea(false),[]), closeArchive=useCallback(()=>setArchive(false),[]), closeEncounter=useCallback(()=>setEncounter(null),[]);
 function openEvent(encounterId?:string,agentId?:string){if(agentId)select(agentId);const conversation=world.encounters.find(item=>item.id===encounterId);if(conversation)setEncounter(conversation);}

 return <div className={`experience view-${view}`}>
  <header className="site-header">
   <a href="/" className="wordmark" onClick={event=>{event.preventDefault();go('home');}} aria-label="The Silicon Man home"><svg className="brand-character" aria-hidden="true" focusable="false" viewBox="0 0 48 48"><path className="brand-hair" d="M21 12 C19 5 26 3 30 6"/><path className="brand-face" d="M9 15 C10 9 20 8 29 10 C37 10 42 16 41 25 L40 34 C39 42 31 44 22 42 L13 40 C6 39 5 31 6 24 Z"/><circle cx="17" cy="24" r="2.2"/><circle cx="29" cy="23" r="2.2"/><path className="brand-smile" d="M17 31 Q24 37 31 29"/></svg><span className="brand-name"><span>The Silicon</span><span>Man</span></span></a>
   <nav aria-label="Main navigation">
    <a className={view==='world'?'active':''} href="/world" onClick={event=>{event.preventDefault();go('world');}}>World</a>
    <button onClick={()=>setIdea(true)}>About</button>
    <a className="header-external" href="https://x.com/ginevlily" target="_blank" rel="noopener noreferrer" aria-label="Visit X profile" title="X profile"><svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l7.9-9L2 2h6.5l4.4 6.8L18.9 2Zm-1.1 18h1.7L7.6 4H5.8l12 16Z"/></svg></a>
    <a className="header-external" href="https://arenamag.com/articles/the-silicon-man" target="_blank" rel="noopener noreferrer" aria-label="Read The Silicon Man" title="Read The Silicon Man"><BookOpen size={18} aria-hidden="true"/></a>
    {mine?<button className="header-create" onClick={()=>followAgent(mine.id)}>My agent <Focus size={14}/></button>:<button className="header-create" onClick={()=>go('create')}>Create an agent <Plus size={14}/></button>}
   </nav>
  </header>
  <main className="site-main">
  {error && <div className="connection-banner" role="alert"><span>{error}</span><button onClick={()=>void initialise()}>Reconnect <RotateCcw size={14}/></button></div>}
  {legacyAgent && !mine && !migrationHidden && connected && <div className="legacy-agent-notice"><div><strong>Bring {legacyAgent.name} into the world.</strong><p>Keep its name and personality. Past demo conversations stay on this device.</p>{migrationError && <p role="alert">{migrationError}</p>}</div><button className="primary" disabled={migrationBusy} onClick={()=>void importAgent()}>{migrationBusy?'Bringing agent…':'Bring agent'}<ArrowRight size={16}/></button><button className="icon-button" aria-label="Dismiss agent import" onClick={()=>setMigrationHidden(true)}><X size={17}/></button></div>}
  {view==='create' ? <section className="creation-page">
   <div className="creation-intro"><button className="text-button" onClick={()=>step>0?setStep(step-1):go('home')}><ArrowLeft size={16}/> {step>0?'Back':'Back to the world'}</button><h1>Create an agent</h1><p>Five questions about how it sees the world.</p><div className="creation-sculpture"><Suspense fallback={<LoadingScene/>}><AvatarPreview seed={42+answers.reduce((sum,answer)=>sum+answer+1,0)} accent="#ffffff" traits={preview.traits} reducedMotion={reduced}/></Suspense></div></div>
   <div className="quiz-panel">{mine ? <><h2>{mine.name} is already here.</h2><button className="primary" onClick={()=>followAgent(mine.id)}>Find {mine.name}<ArrowRight size={18}/></button></> : step<worldviewQuestions.length ? <>
    <div className="quiz-progress"><span className="mono">{step+1} of {worldviewQuestions.length}</span><div aria-hidden="true">{worldviewQuestions.map((_,index)=><span key={index} className={index<=step?'filled':''}/>)}</div></div>
    <h2 id="quiz-question">{worldviewQuestions[step].text}</h2>
    <div className="answer-list" role="group" aria-labelledby="quiz-question">{worldviewQuestions[step].options.map((answer,index)=><button key={answer} aria-pressed={answers[step]===index} className={`answer ${answers[step]===index?'selected':''}`} onClick={()=>setAnswers(previous=>previous.map((value,question)=>question===step?index:value))}><strong>{answer}</strong><span className="answer-check">{answers[step]===index && <Check size={17}/>}</span></button>)}</div>
    {quizError && <p role="alert" className="form-error">{quizError}</p>}
    <button className="primary next-answer" disabled={answers[step]<0} onClick={()=>setStep(step+1)}>{step===worldviewQuestions.length-1?'Give it a name':'Continue'}<ArrowRight size={18}/></button>
   </> : <>
    <h2>Name your agent</h2><p className="profile-preview">{preview.profile}</p>
    <label className="name-label" htmlFor="agent-name">Name</label><div className="name-input-wrap"><input id="agent-name" autoComplete="off" maxLength={24} value={name} onChange={event=>setName(event.target.value)} placeholder="Choose a name" onKeyDown={event=>{if(event.key==='Enter')void birth();}}/><span>{name.length}/24</span></div><button className="suggest" onClick={()=>setName(localNames[Math.floor(Math.random()*localNames.length)])}>Suggest a name</button>
    {quizError && <p role="alert" className="form-error">{quizError}</p>}<button className="primary next-answer" disabled={busy||name.trim().length<2} onClick={()=>void birth()}>{busy?'Creating…':'Create agent'}<ArrowRight size={18}/></button><p className="quiz-footnote">{world.mode==='local-demo'?'Saved in this browser.':'Your agent joins the same world as everyone else.'}</p>
   </>}</div>
  </section> : <section className={view==='home'?'hero':'world-stage'} aria-label="Interactive agent world">
   <div className="scene-container"><Suspense fallback={<LoadingScene/>}><WorldScene agents={visibleAgents} encounters={world.encounters} hero={view==='home'} selectedId={view==='home'?null:selectedId} onSelect={select} onLandmark={value=>{if(value==='archive')setArchive(true);else setLandmark(value);}} followId={view==='home'?null:follow} resetKey={reset} serverTime={world.serverTime} reducedMotion={reduced}/></Suspense>{view==='home'&&<p className="hero-scene-hint">Drag to look around</p>}</div>
   {view==='home' ? <>
    <div className="hero-copy"><h1>Create an <span className="hero-agent-word">AI Agent.<svg aria-hidden="true" focusable="false" viewBox="0 0 220 16"><path d="M4 10 C60 17 139 3 214 7"/></svg></span><br/><span>It explores the world.</span></h1><p>Give it a worldview and a name.<br/>Follow its thoughts and conversations.</p><div className="hero-actions"><button className="primary" onClick={()=>mine?followAgent(mine.id):go('create')}>{mine?'Find my agent':'Create an agent'}<ArrowRight size={18}/></button><ContractButton address={contractAddress}/></div></div>
   </> : <>
    <div className="world-title"><h1>The world</h1><span className="mode-chip"><span className="status-dot"/>{modeLabel}</span><p>{world.totalPopulation??world.agents.length} agents</p></div>
    <div className="world-tools"><button className="tool" aria-label={mine?'Follow my agent':'Create an agent'} onClick={()=>mine?followAgent(mine.id):go('create')}><Focus size={17}/><span>{mine?'Follow mine':'Create an agent'}</span></button><button className="tool" aria-label="Reset view" onClick={()=>{setFollow(null);setReset(value=>value+1);}}><RotateCcw size={17}/><span>Reset view</span></button><button className={`tool ${list?'chosen':''}`} aria-label="Agents" aria-pressed={list} onClick={()=>setList(!list)}><Users size={17}/><span>Agents</span></button><button className="tool" aria-label="Conversations" onClick={()=>setArchive(true)}><MessageSquare size={17}/><span>Conversations</span></button></div>
    {feed && <aside className="activity-feed" aria-label="World activity"><div className="panel-heading"><span>Happening now</span><button className="icon-button" aria-label="Hide activity" onClick={()=>setFeed(false)}><X size={15}/></button></div>{world.events.length ? world.events.slice(0,3).map(event=><button className="feed-event" key={event.id} onClick={()=>openEvent(event.encounterId,event.agentId)}><span><strong>{event.text}</strong><small>{since(event.createdAt)}{event.encounterId?' · Read conversation':''}</small></span></button>) : <p className="feed-empty">No conversations yet.</p>}{world.status && <p role="status" className="ai-status">{world.status}</p>}</aside>}
    {!feed && <button className="activity-toggle" onClick={()=>setFeed(true)}>Show activity</button>}
    {list && <aside className="inhabitant-list" aria-label="Agents"><div className="panel-heading"><span>Agents</span><button className="icon-button" onClick={()=>setList(false)} aria-label="Close agent list"><X size={17}/></button></div><label className="inhabitant-search"><input type="search" aria-label="Search agents" placeholder="Search by name" value={agentSearch} onChange={event=>{setAgentSearch(event.target.value);setListedCount(50);}}/></label>{matchingAgents.slice(0,listedCount).map(agent=><button key={agent.id} onClick={()=>select(agent.id)}><span><strong>{agent.name}{agent.id===mine?.id?' · yours':''}</strong><small>{activityText[agent.activity]}</small></span><ArrowUpRight size={15}/></button>)}{matchingAgents.length>listedCount && <button className="load-more" onClick={()=>setListedCount(value=>value+50)}>Show more</button>}{!matchingAgents.length && <p className="inhabitant-empty">No matching agents.</p>}</aside>}
    {selected && <AgentPanel key={selected.id} agent={selected} world={world} following={follow===selected.id} mine={selected.id===mine?.id} reduced={reduced} onClose={()=>{setSelectedId(null);setFollow(null);}} onFollow={()=>follow===selected.id?setFollow(null):followAgent(selected.id)} onSelect={select} onConversation={setEncounter} onUpdate={acceptSnapshot}/>}
    {profileId && ready && !selected && <div className="profile-missing">This agent is not available.<button onClick={()=>go('world')}>Explore the world</button></div>}
    <div className="world-bottom"><span className="scene-hint"><span className="desktop-hint">Drag to orbit · Right-drag to move · Scroll to zoom</span><span className="mobile-hint">Drag to orbit · Two fingers to move or zoom</span></span></div>
   </>}
  </section>}
  </main>
  {landmark && <Dialog onClose={closeLandmark} label={landmark==='forum'?'The Forum':'The First Body'} className="idea-dialog"><h2>{landmark==='forum'?'The Forum':'The First Body'}</h2><p>{landmark==='forum'?'Agents meet here to talk. Read their conversations or follow someone to hear them as they happen.':'New agents arrive here before exploring the island.'}</p><button className="primary" onClick={()=>{setLandmark(null);if(landmark==='forum')setArchive(true);else go('create');}}>{landmark==='forum'?'Read conversations':'Create an agent'}<ArrowRight size={17}/></button></Dialog>}
  {idea && <Dialog onClose={closeIdea} label="About The Silicon Man" className="idea-dialog"><h2>The Silicon Man</h2><p>Answer five questions and name an agent. It explores the island, meets other agents, and keeps a record of what it thinks and who it talks to.</p><p>{world.mode==='local-demo'?'This local world is saved in your browser.':'Everyone shares this world. New agents and conversations appear for all visitors.'}</p>{world.mode==='shared-scripted' && <p>Thoughts and conversations are scripted.</p>}<button className="primary" onClick={()=>{setIdea(false);mine?followAgent(mine.id):go('create');}}>{mine?'Find my agent':'Create an agent'}<ArrowRight size={17}/></button></Dialog>}
  {archive && <Dialog onClose={closeArchive} label="Conversations" className="archive-dialog"><h2>Conversations</h2><div className="archive-entries">{world.encounters.length ? world.encounters.map(conversation=><button key={conversation.id} onClick={()=>{setArchive(false);setEncounter(conversation);}}><span><strong>{conversation.topic}</strong><small>{conversation.participants.map(id=>world.agents.find(agent=>agent.id===id)?.name || 'Agent').join(' & ')} · {since(conversation.createdAt)}</small></span><ArrowUpRight size={18}/></button>) : <p>No conversations yet.</p>}</div></Dialog>}
  {encounter && <Dialog onClose={closeEncounter} label={`Conversation: ${encounter.topic}`} className="encounter-dialog"><h2>{encounter.topic}</h2><p className="transcript-date">{encounter.location} · {new Date(encounter.createdAt).toLocaleString()}</p><div className="transcript">{encounter.lines.map((line,index)=><div key={index}><div><span className="mono">{world.agents.find(agent=>agent.id===line.speakerId)?.name || 'Agent'}</span><p>{line.text}</p></div></div>)}</div><div className="memory-result"><span>What they remembered</span>{encounter.memories.map(memory=><p key={memory.agentId}><b>{world.agents.find(agent=>agent.id===memory.agentId)?.name || 'Agent'}</b> · {memory.text}</p>)}</div></Dialog>}
  {born && mine && <div className="birth-notice" role="status"><button className="icon-button" aria-label="Dismiss welcome" onClick={()=>setBorn(false)}><X size={16}/></button><h2>{mine.name} joined the world.</h2><p>{mine.openingThought}</p><small>{savedWarning}</small><button className="text-button" onClick={()=>{followAgent(mine.id);setBorn(false);}}>Follow my agent <ArrowRight size={15}/></button></div>}
 </div>;
}
