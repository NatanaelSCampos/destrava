import {execFileSync} from 'node:child_process';
export function validateCdpListeners(rows,pid=null){
 if(!Array.isArray(rows))throw Error('F2C CDP metadata');
 if(pid===null){if(rows.length)throw Error('F2C CDP occupied');return false;}
 if(!Number.isInteger(pid)||pid<=0)throw Error('F2C CDP process');
 for(const r of rows)if(!r||r.LocalPort!==9447||!['127.0.0.1','::1'].includes(r.LocalAddress)||r.OwningProcess!==pid)throw Error('F2C CDP ownership');
 return rows.length>0;
}
export function validateCdpTarget(value){
 const u=new URL(value);if(u.protocol!=='ws:'||u.hostname!=='127.0.0.1'||u.port!=='9447'||u.username||u.password||u.search||u.hash||!/^\/devtools\/page\/[a-f0-9-]+$/i.test(u.pathname))throw Error('F2C CDP target');return u.href;
}
export function readCdpListeners(){
 if(process.platform!=='win32')throw Error('F2C CDP requires validated Windows launcher');
 const raw=execFileSync('powershell',['-NoProfile','-Command',"$ErrorActionPreference='Stop';$rows=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -eq 9447} | Select-Object LocalPort,LocalAddress,OwningProcess);ConvertTo-Json -InputObject $rows -Compress"],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
 return JSON.parse(raw.replace(/^\uFEFF/,''));
}
