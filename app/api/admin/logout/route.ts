import { endpoint,response } from '@/lib/silicon/server';
import { adminCookie,adminMutation } from '@/lib/silicon/admin';
export function POST(req:Request){return endpoint(async()=>{adminMutation(req);return response({ok:true},200,{'Set-Cookie':adminCookie(req,'')});});}
