import { config, response } from '@/lib/silicon/server';
export function GET(){return response({...config(),contractAddress:process.env.CONTRACT_ADDRESS?.trim()||'XXXXX'});}
