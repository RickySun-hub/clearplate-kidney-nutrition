// Keep exact fragments; sort by session timeline rather than network arrival order.
export function liveTurns(fragments, startedAt) {
  const ordered=[...fragments].sort((a,b)=>a.start-b.start || a.order-b.order);
  const turns=[];
  for(const f of ordered) {
    const last=turns.at(-1);
    if(last && last.role===f.role && last.content.length+f.text.length<=2000) last.content+=f.text;
    else turns.push({role:f.role,content:f.text,source:f.role==='user'?'voice':'assistant',at:new Date(startedAt+f.start).toISOString()});
  }
  return turns;
}
export function liveGreeting(meal, resume=false, mode='log') {
  if(!resume && mode==='choose')return "Hi there! Would you like to log something you ate, or find something to cook?";
  if(!resume && mode==='cook')return "Hi there! What ingredients do you have, and what would you like to cook?";
  return resume ? "Hi there, welcome back. Let's pick up where we left off. What else would you like to add?" : `Hi there! Let's talk about your ${meal.toLowerCase()} today. What did you have?`;
}
