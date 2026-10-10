import {xEndpoint,xStart} from '@/lib/silicon/x';
export function POST(req:Request){return xEndpoint(()=>xStart(req));}
