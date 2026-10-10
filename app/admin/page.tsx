'use client';

import {useEffect,useState} from 'react';

export default function Admin() {
 const [loggedIn,setLoggedIn]=useState(false),[password,setPassword]=useState(''),[address,setAddress]=useState(''),[saved,setSaved]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[checking,setChecking]=useState(true);
 async function api(path:string,body?:unknown) {
  const response=await fetch(`/api/admin/${path}`,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'same-origin',
   ...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await response.json() as {address:string;error?:string};
  if(!response.ok){if(response.status===401)setLoggedIn(false);throw new Error(response.status===401?'Incorrect password or expired session.':data.error||'Unable to save.');}
  return data;
 }
 useEffect(()=>{let active=true;void fetch('/api/admin/address',{cache:'no-store'}).then(async response=>{if(response.ok){const data=await response.json() as {address:string;error?:string};if(active){setLoggedIn(true);setAddress(data.address);setSaved(data.address);}}}).catch(()=>{if(active)setMessage('Unable to connect. Refresh to retry.');}).finally(()=>{if(active)setChecking(false);});return()=>{active=false;};},[]);
 async function login(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage('');try{await api('login',{password});setPassword('');const data=await api('address');setAddress(data.address);setSaved(data.address);setLoggedIn(true);}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 async function save(event:React.FormEvent){event.preventDefault();setBusy(true);setMessage('');try{const data=await api('address',{address});setAddress(data.address);setSaved(data.address);setMessage('Saved. The public CA button updates within 5 seconds.');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 async function logout(){setBusy(true);try{await api('logout',{});setLoggedIn(false);setAddress('');setSaved('');setMessage('');}catch(error){setMessage((error as Error).message);}finally{setBusy(false);}}
 return <main className="admin-page"><section className="admin-card"><a href="/" className="admin-home">← The Silicon Man</a><h1>Contract address</h1><p>Update the public CA instantly.</p>
  {checking?<p>Checking session…</p>:loggedIn?<><p className="admin-current">Current CA <code>{saved}</code></p><form onSubmit={save}><label htmlFor="address">New contract address</label><input id="address" autoComplete="off" spellCheck={false} value={address} onChange={event=>setAddress(event.target.value)} maxLength={128} required/><button className="primary" disabled={busy}>{busy?'Saving…':'Save address'}</button></form><button className="text-button" onClick={logout} disabled={busy}>Log out</button></>:<form onSubmit={login}><label htmlFor="password">Admin password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/><button className="primary" disabled={busy}>{busy?'Signing in…':'Log in'}</button></form>}
  <p role="status" className="admin-message">{message}</p></section></main>;
}
