// Completed function calls only; never execute streamed argument fragments.
export function responseToolBridge({send,run,isActive=()=>true,onError=()=>{}}) {
  let current=null;const batches=new Map();const finished=new Set();
  return async envelope=>{
    const e=envelope.event;if(!e)return;
    if(['response.failed','response.incomplete'].includes(e.type)){onError();return;}
    if(e.type==='response.created'){current=e.response.id;batches.set(current,new Map());return;}
    const id=e.response_id||e.response?.id||current;
    if(e.type==='response.output_item.done'&&e.item?.type==='function_call'){
      if(!batches.has(id))batches.set(id,new Map());batches.get(id).set(e.item.call_id,e.item);return;
    }
    if(e.type!=='response.completed'||finished.has(id))return;
    finished.add(id);const calls=[...(batches.get(id)?.values()||[])];batches.delete(id);
    if(!calls.length)return;
    for(const call of calls){
      if(!isActive())return;
      let result;try{result=await run(call.call_id,call.name,JSON.parse(call.arguments));}catch{result={status:'invalid_arguments',instruction:'Correct the tool arguments. Nothing was saved.'};}
      if(!isActive())return;
      send({type:'response.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)}});
    }
    if(isActive())send({type:'response.create'});
  };
}
