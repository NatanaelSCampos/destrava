export function fakeIndexedDB() {
  const rows=new Map(),held=[];
  const controls={quota:false,holdReads:false,opens:0,release(){this.holdReads=false;for(const run of held.splice(0))queueMicrotask(run);}};
  let created=false;
  const clone=value=>value===undefined?undefined:structuredClone(value);
  const db={objectStoreNames:{contains:()=>created},createObjectStore(){created=true;},close(){},transaction(){
    const tx={pending:0,failed:false,error:null};
    const request=(operation,hold=false)=>{const req={result:undefined,error:null};tx.pending++;
      const run=()=>{try{req.result=operation();req.onsuccess?.();}catch(error){req.error=error;tx.error=error;tx.failed=true;req.onerror?.();tx.onerror?.();}finally{tx.pending--;queueMicrotask(()=>{if(!tx.pending&&!tx.failed)tx.oncomplete?.();});}};
      if(hold&&controls.holdReads)held.push(run);else queueMicrotask(run);return req;};
    tx.objectStore=()=>({
      get(key){const captured=clone(rows.get(key));return request(()=>captured,true);},
      put(value,key){return request(()=>{if(controls.quota)throw Error("QuotaExceededError");rows.set(key,clone(value));});},
      delete(key){return request(()=>rows.delete(key));},
    });return tx;
  }};
  return {controls,rows,open(){controls.opens++;const req={result:db};queueMicrotask(()=>{if(!created)req.onupgradeneeded?.();req.onsuccess?.();});return req;}};
}
