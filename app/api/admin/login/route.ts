import { z } from 'zod';
import { endpoint,readSubmission,response } from '@/lib/silicon/server';
import { adminCookie,adminMutation,loginToken } from '@/lib/silicon/admin';
export function POST(req:Request){return endpoint(async()=>{adminMutation(req);const {password}=z.object({password:z.string().min(1).max(1024)}).strict().parse(await readSubmission(req));const token=await loginToken(password);return response({ok:true},200,{'Set-Cookie':adminCookie(req,token)});});}
