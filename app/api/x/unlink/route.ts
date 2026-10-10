import {xEndpoint,xUnlink} from '@/lib/silicon/x';
export function POST(req:Request){return xEndpoint(()=>xUnlink(req));}
