import {environment,harness,nodes,button,settle,empty,icons} from "./ui-lifecycle-harness.mjs";

export function fixture(props={}, options={}) {
  const env=environment(),h=harness(env),streams=[],recorders=[],effects=[],text=()=>null;
  let pendingPermission=null, failure="", conversion=null;
  const media=()=>{const track={stops:0,stop(){this.stops++;}};const stream={track,getTracks:()=>[track]};streams.push(stream);return stream;};
  class FakeRecorder {
    state="inactive";mimeType="audio/webm";
    constructor(stream){if(failure==="constructor")throw Error("constructor failed");this.stream=stream;recorders.push(this);}
    start(){if(failure==="start-before")throw Error("start failed");this.state="recording";if(failure==="start-after")throw Error("start failed after acquiring");}
    stop(){this.state="inactive";Promise.resolve().then(()=>{this.ondataavailable?.({data:new Blob(["synthetic-bytes"])});this.onstop?.();});}
  }
  class Reader {readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result="data:audio/webm;base64,"+Buffer.from(bytes).toString("base64");this.onloadend?.();});}}
  env.window.MediaRecorder=FakeRecorder;
  if(options.storage)env.globals.indexedDB=options.storage;
  const draftStore=h.load("src/lib/speaking-draft-store.ts");
  const context={authUserId:options.owner??null,course:{id:"course",contentVersion:"1.0.0"},language:{},runtime:null,state:{speaking:[],profile:{}},saveSpeaking(){effects.push("save");}};
  Object.assign(env.globals,{MediaRecorder:FakeRecorder,FileReader:Reader,navigator:{mediaDevices:{getUserMedia:()=>pendingPermission??Promise.resolve(media())}},fetch(){effects.push("fetch");throw Error("No network");}});
  const {SpeakingRecorder}=h.load("src/components/activities/speaking-recorder.tsx",{
    "lucide-react":icons,"@/components/study-provider":{useStudy:()=>context},
    "@/lib/speaking-draft-store":draftStore,
    "@/components/audio/speak-button":{SpeakButton:empty},"@/lib/audio-to-wav":{audioToWav:async(blob)=>conversion??blob},
    "@/engine/variants/speech":{resolveSpeechOperation:()=>({status:"unavailable"})},
    "@/engine/variants/resolution":{resolveLearningVariant:()=>({status:"resolved"})},
    "@/components/learning/text-presentation":{useTextPresentation:()=>()=>({}),LearningText:empty,LearningTextarea:text},
  });
  const activity={id:"speech",type:"speaking",guidance:[],referenceText:"",presentation:{}};
  const mount=h.mount(SpeakingRecorder,{activity,onSubmitSpeaking:async()=>effects.push("submit"),onSaved:()=>effects.push("saved"),...props});
  return {env,h,mount,streams,recorders,effects,context,draftStore,
    failure(value){failure=value;},
    permission(){let grant;pendingPermission=new Promise(r=>grant=r);return()=>grant(media());},
    conversion(){let release;conversion=new Promise(r=>release=r);return()=>release(new Blob(["wav"]));},
    audio:()=>nodes(mount.tree).find(n=>n.type==="audio"),
    textarea:()=>nodes(mount.tree).find(n=>n.type===text&&n.props.id==="transcription-speech"),
  };
}
export async function clip(f){button(f.mount,"Gravar resposta").props.onClick();await settle(f.mount);button(f.mount,"Parar").props.onClick();await settle(f.mount);f.textarea().props.onChange({target:{value:"meu rascunho"}});f.mount.flush();return f.audio().props.src;}
export function hide(f,event){if(event==="visibilitychange")f.env.visibility("hidden",f.mount);else{f.env.window.emit("pagehide");f.mount.flush();}}
export function show(f,event){if(event==="visibilitychange")f.env.visibility("visible",f.mount);else{f.env.window.emit("pageshow");f.mount.flush();}}
