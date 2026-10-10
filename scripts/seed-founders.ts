import {writeFileSync} from 'node:fs';
import {foundingAgents} from '../lib/silicon/domain';
const rows=foundingAgents(Date.UTC(2026,9,10,18)).map(a=>`insert into public.silicon_agents(id,data) values ('${a.id}','${JSON.stringify(a).replaceAll("'","''")}'::jsonb) on conflict(id) do nothing;`);
writeFileSync('supabase/seed.sql','-- Repeatable founding-character seed; run after migration.\n'+rows.join('\n')+'\n');
console.log('Wrote five idempotent founding characters to supabase/seed.sql.');
