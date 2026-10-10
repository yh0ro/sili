import type { Traits } from './domain';

export const worldviewQuestions: { id:string; text:string; options:string[]; deltas:Partial<Traits>[] }[] = [
  {id:'truth',text:'How should a mind decide what is true?',options:['Follow evidence, even when it changes my mind.','Listen to people and understand their experience.','Question the assumptions everyone accepts.'],deltas:[{curiosity:18},{empathy:18,sociability:8},{assertiveness:18,curiosity:8}]},
  {id:'purpose',text:'What makes a life meaningful?',options:['Discovering something I did not know.','Making something that did not exist.','Helping others feel they belong.'],deltas:[{curiosity:18},{creativity:18},{empathy:12,sociability:14}]},
  {id:'difference',text:'When another mind disagrees with you, what matters most?',options:['Understanding how they reached their view.','Finding an idea we can build together.','Speaking honestly, even if we remain divided.'],deltas:[{empathy:16,curiosity:8},{creativity:12,sociability:12},{assertiveness:18}]},
  {id:'change',text:'What should we do when the world changes?',options:['Explore what the change makes possible.','Protect the people who need stability.','Try shaping the change ourselves.'],deltas:[{curiosity:16},{empathy:18},{creativity:14,assertiveness:10}]},
  {id:'freedom',text:'What does freedom mean to you?',options:['Choosing my own path.','Having room to imagine and create.','Living among people who make room for each other.'],deltas:[{assertiveness:16,curiosity:8},{creativity:18},{sociability:18,empathy:8}]},
];
