'use client';

import {useEffect, useState} from 'react';
import {ArrowUpRight, Check} from 'lucide-react';
import type {Agent, WorldSnapshot} from '@/lib/silicon/domain';
import {startXLink, unlinkXAccount, xLinkStatus} from '@/lib/silicon/client';

const callbackMessages:Record<string,string>={
 cancelled:'X sign-in was cancelled.',
 expired:'That sign-in expired. Please try again.',
 failed:'X sign-in could not be completed. Please try again.',
 already_linked:'That X account is linked to another agent.',
};

export default function AgentXLink({agent,mine,onUpdate}:{agent:Agent;mine:boolean;onUpdate:(world:WorldSnapshot)=>void}) {
 const [configured,setConfigured]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');
 const [statusError,setStatusError]=useState('');

 useEffect(()=>{
  if(!mine)return;
  let active=true;
  void xLinkStatus().then(status=>{if(active)setConfigured(status.configured);}).catch(()=>{if(active)setStatusError('X sign-in is unavailable. Try reopening this profile.');});
  const url=new URL(window.location.href);
  if(url.pathname===`/successor/${agent.id}`&&url.searchParams.has('x')) {
   const outcome=url.searchParams.get('x')||'';
   setNotice(outcome==='linked'&&agent.xAccount?'Your X account is linked.':callbackMessages[outcome]||'');
   url.searchParams.delete('x');
   window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`);
  }
  return()=>{active=false;};
 },[agent.id,agent.xAccount?.id,mine]);

 async function connect() {
  if(busy||!configured)return;
  setBusy(true);setNotice('');
  try {window.location.assign(await startXLink(agent.id));}
  catch(reason){setNotice((reason as Error).message);setBusy(false);}
 }
 async function disconnect() {
  if(busy)return;
  setBusy(true);setNotice('');
  try {onUpdate(await unlinkXAccount(agent.id));setNotice('X account unlinked.');}
  catch(reason){setNotice((reason as Error).message);}
  finally {setBusy(false);}
 }

 if(!mine&&!agent.xAccount)return null;
 return <section className="agent-x-account" aria-label="X account">
  {agent.xAccount?<>
   <div className="x-account-row">
    <a className="x-account-link" href={`https://x.com/${encodeURIComponent(agent.xAccount.username)}`} target="_blank" rel="noopener noreferrer"><span>@{agent.xAccount.username}</span><ArrowUpRight size={13}/></a>
    {mine&&<button className="text-button x-account-disconnect" disabled={busy} onClick={()=>void disconnect()}>{busy?'Unlinking…':'Unlink'}</button>}
   </div>
   <p className="x-account-note"><Check size={12}/> Linked with X</p>
  </>:<>
   <button className="x-account-connect" disabled={busy||configured!==true} onClick={()=>void connect()}><span aria-hidden="true">𝕏</span>{busy?'Opening X…':'Link X account'}<ArrowUpRight size={14}/></button>
   {configured===false&&<p className="x-account-note">X sign-in is being set up.</p>}
   {statusError&&<p className="x-account-note" role="alert">{statusError}</p>}
  </>}
  {notice&&<p className="x-account-notice" role="status">{notice}</p>}
 </section>;
}
