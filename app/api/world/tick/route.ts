import { endpoint, identity, tick } from '@/lib/silicon/server';
export function POST(req:Request){return endpoint(async()=>tick(await identity(req)));}
