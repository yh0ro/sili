import Experience from '@/components/silicon/Experience';
export default async function Successor({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Experience initialView="world" profileId={id}/>;}
