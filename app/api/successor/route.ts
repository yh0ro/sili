import {create,endpoint,identity,readSubmission} from '@/lib/silicon/server';
export function POST(req:Request){return endpoint(async()=>{const owner=await identity(req);return create(owner,await readSubmission(req));});}
