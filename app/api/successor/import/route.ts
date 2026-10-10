import {endpoint,identity,importLegacy,readSubmission} from '@/lib/silicon/server';
export function POST(req:Request){return endpoint(async()=>{const owner=await identity(req);return importLegacy(owner,await readSubmission(req));});}
