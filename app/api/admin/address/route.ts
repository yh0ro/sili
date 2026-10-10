import { endpoint,readSubmission } from '@/lib/silicon/server';
import { addressSchema,adminMutation,contractAddress,requireAdmin,saveAddress } from '@/lib/silicon/admin';
export function GET(req:Request){return endpoint(async()=>{await requireAdmin(req);return {address:await contractAddress()};});}
export function POST(req:Request){return endpoint(async()=>{adminMutation(req);await requireAdmin(req);const {address}=addressSchema.parse(await readSubmission(req));return {address:await saveAddress(address)};});}
