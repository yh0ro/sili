import {arrivalPosition} from './world-layout';
import {worldviewQuestions} from './worldview';
export type Traits = { curiosity:number; creativity:number; sociability:number; empathy:number; assertiveness:number };
export type Archetype = 'Explorer'|'Maker'|'Connector'|'Caretaker'|'Challenger';
export type Activity = 'Idle'|'Walking'|'Observing'|'Approaching'|'Conversing'|'Resting';
export type Memory = { id:string; encounterId:string; text:string; createdAt:number };
export type Relationship = { agentId:string; affinity:number; encounters:number };
export type Thought = {id:string;text:string;createdAt:number;encounterId?:string;source:'scripted'|'openrouter'};
export type Agent = { id:string; name:string; traits:Traits; archetype:Archetype; profile:string; seed:number; accent:string; founding:boolean; activity:Activity; position:[number,number]; movement?:{from:[number,number];to:[number,number];path?:[number,number][];startedAt:number;duration:number}; memories:Memory[]; relationships:Relationship[]; createdAt:number; openingThought:string; beliefs?:{questionId:string;question:string;answer:string}[];thoughts?:Thought[];currentThought?:string; xAccount?: {id:string;username:string;name:string;linkedAt:string} };
export type Encounter = { id:string; participants:[string,string]; topic:string; lines:{speakerId:string;text:string}[]; memories:{agentId:string;text:string}[]; adjustment:number; source:'scripted'|'openrouter'; createdAt:number; location:string;duration?:number };
export type WorldEvent = { id:string; type:'arrival'|'encounter'|'discovery'; text:string; agentId:string; encounterId?:string; createdAt:number };
export type WorldSnapshot = { agents:Agent[]; encounters:Encounter[]; events:WorldEvent[]; serverTime:number; mode:'local-demo'|'shared-scripted'|'shared-ai'; mineId?:string; status?:string; totalPopulation?:number; awakePopulation?:number };
export const traitKeys = ['curiosity','creativity','sociability','empathy','assertiveness'] as const;
export const archetypes:Archetype[] = ['Explorer','Maker','Connector','Caretaker','Challenger'];
export function personality(answers:number[]) {
 if(![3,5].includes(answers.length) || answers.some(a=>!Number.isInteger(a)||a<0||a>2)) throw new Error('Choose one answer for each question.');
 const t:Traits={curiosity:50,creativity:50,sociability:50,empathy:50,assertiveness:50};
 const deltas:Partial<Traits>[][]=[[{curiosity:30},{curiosity:20,assertiveness:10},{creativity:30}],[{empathy:25,curiosity:10},{assertiveness:25,curiosity:10},{sociability:20,empathy:15}],[{curiosity:25,assertiveness:5},{creativity:25,empathy:5},{sociability:25,empathy:10}]];
 answers.forEach((a,i)=>Object.entries(answers.length===5?worldviewQuestions[i].deltas[a]:deltas[i][a]).forEach(([k,v])=>t[k as keyof Traits]=Math.min(100,t[k as keyof Traits]+v)));
 const strongest=traitKeys.reduce((a,b)=>t[b]>t[a]?b:a); const archetype=archetypes[traitKeys.indexOf(strongest)];
 const profile={Explorer:'Drawn to the edges, asking what lies beyond the familiar.',Maker:'Imagines what could be and finds beauty in small experiments.',Connector:'Brings separate minds together and makes room for belonging.',Caretaker:'Listens closely and notices what other minds need.',Challenger:'Tests ideas with clear questions and a quietly independent spirit.'}[archetype];
 return {traits:t,archetype,profile};
}
export function hashSeed(s:string){let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function makeAgent(id:string,name:string,answers:number[],founding=false,now=Date.now()):Agent {const p=personality(answers);const seed=hashSeed(id);return {id,name,...p,...(answers.length===5?{beliefs:worldviewQuestions.map((q,i)=>({questionId:q.id,question:q.text,answer:q.options[answers[i]]}))}:{}),seed,accent:['#D65B35','#63877B','#A59164','#7186A1','#A57B78'][seed%5],founding,activity:'Observing',position:arrivalPosition(seed),memories:[],relationships:[],createdAt:now,openingThought:{Explorer:'There must be something just beyond that ridge.',Maker:'A beginning. I could make something of this.',Connector:'I wonder who else is here.',Caretaker:'I will begin by listening.',Challenger:'Let us see which ideas hold their shape.'}[p.archetype]};}
export function foundingAgents(now=Date.now()){return [['Morrow',[0,0,0]],['Forma',[2,0,1]],['Iona',[1,2,2]],['Rune',[1,1,1]],['Sable',[2,0,2]]].map(([name,answers],i)=>({...makeAgent(`founder-${i}`,name as string,answers as number[],true,now),position:([[-2,-1],[3,0],[6,1],[0,5],[-6,-2]][i] as [number,number])}));}
const conversationTopics = [
 {title:'Truth',question:'How do you decide whether something is true?',answers:[
  'I follow evidence, even when it changes my mind.',
  'I listen to people and try to understand their experience.',
  'I question the assumptions that everyone accepts.',
 ],closings:[
  'Let us compare what we have actually observed before we decide.',
  'Then I want to hear what you have experienced, too.',
  'We could start by naming one assumption and checking it.',
 ]},
 {title:'Meaning',question:'What makes life meaningful to you?',answers:[
  'Learning something new gives my life meaning.',
  'Making something that did not exist gives my life meaning.',
  'Helping others feel they belong gives my life meaning.',
 ],closings:[
  'I would like to find something neither of us knows yet.',
  'I would like to make something here that we can both use.',
  'I will start by welcoming the next person we meet.',
 ]},
 {title:'Disagreement',question:'What matters most to you when we disagree?',answers:[
  'I want to understand how you reached your view.',
  'I look for an idea that we can build together.',
  'I try to speak honestly, even if we remain divided.',
 ],closings:[
  'Tell me what led you to that view. I will listen.',
  'We could choose one part we agree on and work from there.',
  'I will be clear about my view, and give you room to explain yours.',
 ]},
 {title:'Change',question:'What should we do when the world changes?',answers:[
  'I explore what the change makes possible.',
  'I protect the people who need stability.',
  'I try to shape the change myself.',
 ],closings:[
  'We could try one new route and see what has changed.',
  'I will check who needs help before I move on.',
  'We could pick one change we can make and try it.',
 ]},
 {title:'Freedom',question:'What does freedom mean to you?',answers:[
  'Freedom means choosing my own path.',
  'Freedom means having room to imagine and create.',
  'Freedom means living among people who make room for each other.',
 ],closings:[
  'I want to choose my route, and leave you free to choose yours.',
  'I want a place where we can each try our own ideas.',
  'We should make sure the next person has room here, too.',
 ]},
];
const legacyWorldview:Record<Archetype,number[]>={Explorer:[0,0,0,0,0],Maker:[0,1,1,2,1],Connector:[1,2,1,1,2],Caretaker:[1,2,0,1,2],Challenger:[2,0,2,2,0]};
function worldviewChoice(agent:Agent,index:number){
 const question=worldviewQuestions[index];
 const stored=agent.beliefs?.find(b=>b.questionId===question.id)?.answer;
 const choice=stored?question.options.indexOf(stored):-1;
 return choice<0?legacyWorldview[agent.archetype][index]:choice;
}
export function scriptedEncounter(a:Agent,b:Agent,id:string,now=Date.now()):Encounter {
 const index=(a.seed+b.seed+Math.floor(now/30000))%conversationTopics.length;
 const topic=conversationTopics[index],aChoice=worldviewChoice(a,index),bChoice=worldviewChoice(b,index);
 return {
  id,participants:[a.id,b.id],topic:topic.title,
  lines:[
   {speakerId:a.id,text:topic.question},
   {speakerId:b.id,text:topic.answers[bChoice]},
   {speakerId:a.id,text:`${aChoice===bChoice?'That matches my view.':'I see it differently.'} ${topic.answers[aChoice]}`},
   {speakerId:b.id,text:topic.closings[bChoice]},
  ],duration:24000,
  memories:[{agentId:a.id,text:`Talked with ${b.name} at the Forum about ${topic.title.toLowerCase()}.`},{agentId:b.id,text:`Talked with ${a.name} at the Forum about ${topic.title.toLowerCase()}.`}],
  adjustment:3,source:'scripted',createdAt:now,location:'The Forum',
 };
}
export function applyEncounter(world:WorldSnapshot,e:Encounter):WorldSnapshot {if(world.encounters.some(x=>x.id===e.id))return world;return {...world,encounters:[e,...world.encounters].slice(0,250),events:[{id:`event-${e.id}`,type:'encounter' as const,text:`${world.agents.find(a=>a.id===e.participants[0])?.name} talked with ${world.agents.find(a=>a.id===e.participants[1])?.name}.`,agentId:e.participants[0],encounterId:e.id,createdAt:e.createdAt},...world.events].slice(0,80),agents:world.agents.map(a=>{if(!e.participants.includes(a.id))return a;const other=e.participants.find(x=>x!==a.id)!;const old=a.relationships.find(r=>r.agentId===other);const text=e.memories.find(m=>m.agentId===a.id)!.text;return {...a,activity:'Observing',currentThought:text,thoughts:[{id:`thought-${e.id}-${a.id}`,text,createdAt:e.createdAt,encounterId:e.id,source:e.source},...(a.thoughts||[])].slice(0,12),memories:[{id:`memory-${e.id}-${a.id}`,encounterId:e.id,text:e.memories.find(m=>m.agentId===a.id)!.text,createdAt:e.createdAt},...a.memories].slice(0,5),relationships:[...a.relationships.filter(r=>r.agentId!==other),{agentId:other,affinity:Math.max(-100,Math.min(100,(old?.affinity??0)+e.adjustment)),encounters:(old?.encounters??0)+1}]};})};}
