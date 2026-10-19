export function chartDays(daily,start,end,key){
 if(!start||!end||start>end)return [];
 const last=Date.parse(end+'T00:00:00Z'),first=Math.max(Date.parse(start+'T00:00:00Z'),last-30*86400000);
 if(!Number.isFinite(last)||!Number.isFinite(first))return [];
 const byDate=new Map(daily.map(day=>[day.date,day]));const points=[];
 for(let stamp=first;stamp<=last;stamp+=86400000){const date=new Date(stamp).toISOString().slice(0,10),v=byDate.get(date)?.nutrients[key];points.push({date,value:v?.knownCount?v.knownSubtotal:null,complete:Boolean(v?.complete),known:v?.knownCount||0,count:v?.itemCount||0});}
 return points;
}
export function completeSegments(points){const result=[];let segment=[];for(const p of points){if(p.complete&&p.value!==null)segment.push(p);else{if(segment.length)result.push(segment);segment=[];}}if(segment.length)result.push(segment);return result;}
export function comparisonScale(value,max){return Math.max(1,Number.isFinite(value)?value:0,Number.isFinite(max)?max:0)*1.15;}
