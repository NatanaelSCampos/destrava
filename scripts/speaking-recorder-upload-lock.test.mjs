import assert from 'node:assert/strict';
import test from 'node:test';
import {environment,harness,nodes,button,label,settle,empty,icons} from './ui-lifecycle-harness.mjs';

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(){
  const env=environment(),h=harness(env),uploads=[],saved=[],updates=[];
  let permissionRequests=0,mount;
  const gate=deferred();
  let draft={blob:new Blob(['actual draft audio'],{type:'audio/webm'}),transcription:'message A',revision:'revision-a'};
  const context={authUserId:'owner',course:{id:'course',contentVersion:'1.0.0'},language:{},runtime:null,state:{speaking:[],profile:{}},saveSpeaking(_activity,text,audio){uploads.push({text,audio});return gate.promise;}};
  const Textarea=()=>null;
  class Reader{readAsDataURL(){this.result='data:audio/webm;base64,YWN0dWFsIGRyYWZ0IGF1ZGlv';Promise.resolve().then(()=>this.onloadend?.());}}
  Object.assign(env.globals,{FileReader:Reader,navigator:{mediaDevices:{async getUserMedia(){permissionRequests++;throw Error('Unexpected microphone mutation during upload');}}}});
  const {SpeakingRecorder}=h.load('src/components/activities/speaking-recorder.tsx',{
    './practice-conversation':{PracticeConversation:({children})=>children},
    'lucide-react':icons,'@/components/study-provider':{useStudy:()=>context},
    '@/lib/speaking-draft-store':{useSpeakingDraft:()=>({draft,loaded:true,pending:false,reloadSafe:true,update(change){updates.push(change);draft={...draft,...change,revision:'revision-'+updates.length};},clearSaved:async()=>false})},
    '@/components/audio/speak-button':{SpeakButton:empty},'@/lib/audio-to-wav':{audioToWav:async blob=>blob},
    '@/engine/variants/speech':{resolveSpeechOperation:()=>({status:'unavailable'})},
    '@/engine/variants/resolution':{resolveLearningVariant:()=>({status:'resolved'})},
    '@/components/learning/text-presentation':{useTextPresentation:()=>()=>({}),LearningText:empty,LearningTextarea:Textarea},
  });
  mount=h.mount(SpeakingRecorder,{activity:{id:'speech',type:'speaking',guidance:[],presentation:{}},onSaved:result=>saved.push(result)});
  return{mount,gate,uploads,saved,updates,get permissionRequests(){return permissionRequests;},get draft(){return draft;},textarea:()=>nodes(mount.tree).find(n=>n.type===Textarea)};
}

test('pending upload locks transcription, retry capture and repeat submit until the actual ACK',async()=>{
  const f=fixture();await settle(f.mount);
  assert.equal(f.textarea().props.disabled,false);
  button(f.mount,'Salvar').props.onClick();f.mount.flush();await settle(f.mount);
  assert.equal(f.uploads.length,1);assert.equal(f.uploads[0].text,'message A');
  assert.equal(f.textarea().props.disabled,true);
  assert.equal(button(f.mount,'Gravar novamente').props.disabled,true);
  assert.equal(button(f.mount,'Salvar').props.disabled,true);
  assert.equal(f.saved.length,0);assert.doesNotMatch(label(f.mount.tree),/Prática oral salva/);
  // Invoke the current rendered handlers too: safety does not depend solely on native disabled behavior.
  f.textarea().props.onChange({target:{value:'message B'}});
  button(f.mount,'Gravar novamente').props.onClick();button(f.mount,'Salvar').props.onClick();
  f.mount.flush();await settle(f.mount);
  assert.equal(f.draft.transcription,'message A');assert.equal(f.updates.length,0);
  assert.equal(f.permissionRequests,0);assert.equal(f.uploads.length,1);
  f.gate.resolve('submission-a');await settle(f.mount);
  assert.equal(f.saved.length,1);assert.equal(f.saved[0].transcription,'message A');
  assert.match(label(f.mount.tree),/Prática oral salva/);
  assert.equal(f.textarea().props.disabled,false);
  assert.equal(button(f.mount,'Gravar novamente').props.disabled,false);
  f.textarea().props.onChange({target:{value:'message B'}});f.mount.render();
  assert.equal(f.draft.transcription,'message B');
  assert.doesNotMatch(label(f.mount.tree),/Prática oral salva/);
  assert.equal(button(f.mount,'Salvar').props.disabled,false);
  f.mount.unmount();
});

test('failed upload restores editing and retry without a saved ACK or discarded audio/text',async()=>{
  const f=fixture();await settle(f.mount);const original=f.draft;
  button(f.mount,'Salvar').props.onClick();f.mount.flush();await settle(f.mount);
  assert.equal(f.textarea().props.disabled,true);
  f.gate.reject(Error('Falha sintética no envio'));await settle(f.mount);
  assert.equal(f.draft,original);assert.equal(f.saved.length,0);
  assert.equal(f.textarea().props.disabled,false);
  assert.equal(button(f.mount,'Gravar novamente').props.disabled,false);
  assert.equal(button(f.mount,'Salvar').props.disabled,false);
  assert.match(label(f.mount.tree),/Falha sintética no envio/);
  assert.doesNotMatch(label(f.mount.tree),/Prática oral salva/);
  f.textarea().props.onChange({target:{value:'corrected message'}});f.mount.render();
  assert.equal(f.draft.transcription,'corrected message');assert.equal(f.draft.blob,original.blob);
  f.mount.unmount();
});
