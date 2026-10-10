'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function ContractButton({address}:{address:string}) {
 const [status,setStatus]=useState<'idle'|'copied'|'error'>('idle');
 useEffect(()=>setStatus('idle'),[address]);
 async function copy() {
  try { await navigator.clipboard.writeText(address);setStatus('copied'); }
  catch { setStatus('error'); }
 }
 return <div className="contract-control">
  <button className="contract-button" disabled={!address} onClick={copy} aria-label={address?'Copy contract address':'Contract address coming soon'} title={address||'Contract address coming soon'}>
   <span className="contract-label">{status==='copied'?'Copied!':'CA'}</span>
   <span className="contract-address">{address?(address.length>16?`${address.slice(0,6)}…${address.slice(-5)}`:address):'Coming soon'}</span>
   {status==='copied'?<Check size={17}/>:<Copy size={17}/>}</button>
  <span className="contract-feedback" role="status">{status==='copied'?'Contract address copied.':status==='error'?'Copy unavailable. Select the address below.':''}</span>
  {status==='error'&&<input className="contract-fallback" aria-label="Contract address" readOnly value={address} onFocus={event=>event.currentTarget.select()}/>}
 </div>;
}
