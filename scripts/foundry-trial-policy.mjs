
const APP='http://127.0.0.1:3100',API='http://127.0.0.1:55421';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const keys=(b,allowed)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>allowed.includes(k));
export function foundryMutationAllowed(url,request,scope){
 if(![APP,API].includes(url.origin)||url.username||url.password)return false;
 const method=request.method;
 const headers=Object.fromEntries(Object.entries(request.headers??{}).map(([k,v])=>[k.toLowerCase(),v]));
 if(method==='OPTIONS'){
  if(url.origin!==API||headers.origin!==APP)return false;
  const expected={
   '/auth/v1/user':['GET',['apikey','authorization','x-client-info','x-supabase-api-version']],
   '/auth/v1/token':['POST',['apikey','authorization','content-type','x-client-info','x-supabase-api-version']],
   '/rest/v1/rpc/mfa_access_allowed':['POST',['apikey','authorization','content-profile','content-type','x-client-info']],
   '/rest/v1/rpc/claim_feature_announcements':['POST',['apikey','authorization','content-profile','content-type','x-client-info']]
  }[url.pathname];
  if(!expected||headers['access-control-request-method']!==expected[0])return false;
  return JSON.stringify((headers['access-control-request-headers']??'').split(',').map(x=>x.trim().toLowerCase()).sort())===JSON.stringify(expected[1].slice().sort());
 }
 if(method!=='POST'||(url.search&&!(url.origin===API&&url.pathname==='/auth/v1/token'&&url.search==='?grant_type=refresh_token'))||headers.origin!==APP)return false;
 let b;try{b=JSON.parse(request.postData??'');}catch{return false;}
 if(url.origin===API){
  if(url.pathname==='/rest/v1/rpc/mfa_access_allowed')return keys(b,[])&&Object.keys(b).length===0;
  if(url.pathname==='/auth/v1/token'&&url.search==='?grant_type=refresh_token')return keys(b,['refresh_token'])&&typeof b.refresh_token==='string'&&b.refresh_token.length>0;
  return false;
 }
 if(url.pathname==='/api/course-installations/progress'){
  if(!keys(b,['versionSessionId','expectedRevision','operationId','state'])||b.versionSessionId!==scope.sessionId||!uuid(b.operationId)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!b.state||b.state.courseId!==scope.courseId||b.state.languageCode!=='es')return false;
  if(!Array.isArray(scope.stateKeys)||!keys(b.state,[...scope.stateKeys,'adaptiveProgress'])||!Array.isArray(b.state.sessions)||b.state.sessions.length||b.state.activeSessionId!=null)return false;
  if(b.state.adaptiveProgress!==undefined&&(!Array.isArray(b.state.adaptiveProgress)||b.state.adaptiveProgress.length))return false;
  if(!Array.isArray(b.state.writing))return false;
  if(b.state.writing.some(row=>!keys(row,['id','activityId','sessionId','text','createdAt','feedback','interactiveReceipt'])||!scope.writingIds.includes(row.activityId)||row.sessionId!=null||row.feedback!=null))return false;
  for(const list of ['attempts','writing','speaking'])if(!Array.isArray(b.state[list])||b.state[list].some(row=>!scope.activityIds.includes(row.activityId)))return false;
  return Array.isArray(b.state.completedActivityIds)&&b.state.completedActivityIds.every(id=>scope.activityIds.includes(id))&&JSON.stringify(b).length<1024*1024;
 }
 if(url.pathname==='/api/grade')return keys(b,['courseId','activityId','answer','versionSessionId','evidenceId'])&&b.courseId===scope.courseId&&scope.closedIds.includes(b.activityId)&&b.versionSessionId===scope.sessionId&&typeof b.answer==='string'&&b.answer.length<=1000&&(!b.evidenceId||uuid(b.evidenceId));
 return false;
}
export function foundryExpectedBlock(url,request,notificationIds){
 if(url.origin!==API||url.pathname!=='/rest/v1/rpc/claim_feature_announcements'||request.method!=='POST')return false;
 try{const b=JSON.parse(request.postData);return keys(b,['p_ids'])&&Array.isArray(b.p_ids)&&JSON.stringify([...b.p_ids].sort())===JSON.stringify([...notificationIds].sort());}catch{return false;}
}
