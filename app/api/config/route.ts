import { config, endpoint } from '@/lib/silicon/server';
import { contractAddress } from '@/lib/silicon/admin';
export function GET(){return endpoint(async()=>({...config(),contractAddress:await contractAddress()}));}
