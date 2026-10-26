import assert from "node:assert/strict";
import test from "node:test";
import { environment, harness, nodes, button, settle, empty, icons, label } from "./ui-lifecycle-harness.mjs";

function studyFixture(paused=false,savedSeconds=0) {
  const env=environment(),h=harness(env),clock=h.load("src/domain/study/session-time.ts");
  const ActivityRenderer=empty,checkpoints=[],durations=[],sideEffects=[];
  const session={id:"session",unitId:"unit",startedAt:"2026-10-24T10:00:00Z",finishedAt:null,durationSeconds:savedSeconds,cursor:0,paused,mode:"guided",plan:[{kind:"activity",id:"practice",title:"Practice",minutes:1}]};
  const course={id:"course",slug:"course",units:[{id:"unit",number:1,title:"Unit",lessons:[{activities:[{id:"practice",type:"writing"}]}]}]};
  const state={profile:{learningPreferences:{preferredSessionMinutes:15}},activeSessionId:session.id,sessions:[session],mistakes:{},writing:[],completedActivityIds:[]};
  const context={course,state,resources:{},vocabularyItems:[],ready:true,runtime:null,progressLoadStatus:"loaded",syncError:"",
    startSession(){sideEffects.push("start");},finishSession(){sideEffects.push("finish");},
    updateActiveSessionDuration(id,seconds){durations.push(seconds);session.durationSeconds=seconds;},
    async checkpointStudySession(id,input){checkpoints.push({...input});Object.assign(session,input);if(input.seconds!==undefined)session.durationSeconds=input.seconds;},
  };
  const {default:Page}=h.load("src/app/study/page.tsx",{
    "next/link":{default:empty},"next/navigation":{useSearchParams:()=>new URLSearchParams("duration=15&mode=guided")},"lucide-react":icons,
    "@/components/study-provider":{useStudy:()=>context},
    "@/domain/study/learning-action-availability":{learningActionAvailability:()=>({eligible:true}),unavailableLearningRequirements:()=>[]},
    "@/domain/study/study-planner":{buildStudyPlan:()=>[]},
    "@/domain/study/learning-profile":{buildLearningProfile:()=>({})},
    "@/domain/study/learning-recommendation-engine":{LearningRecommendationEngine:{recommend:()=>[]}},
    "@/lib/recommendation-link":{recommendationLink:()=>""},"@/domain/study/progress":{currentUnit:()=>course.units[0]},
    "@/components/activities/activity-renderer":{ActivityRenderer},
    "@/components/audio/speak-button":{SpeechPlaybackScope:{Provider:empty}},
    "@/components/review/review-queue":{ReviewQueue:empty},"@/components/study/focused-conversation":{FocusedConversation:empty},
    "@/lib/utils":{formatMinutes:(n)=>n+" min"},
    "@/domain/study/practice-history":{buildPracticeHistory:()=>[],sessionComparisons:()=>[]},
    "@/domain/study/session-time":clock,
  });
  const mount=h.mount(Page().props.children.type);env.advance(0,mount);
  return {env,h,mount,session,checkpoints,durations,sideEffects,ActivityRenderer,card:()=>nodes(mount.tree).find(n=>n.type===ActivityRenderer&&n.props.activity)};
}
test("Study short tab switch retains current card and does not write an automatic pause or hidden time",()=>{
  const f=studyFixture(),key=f.card().key;
  f.env.advance(1000,f.mount);f.env.visibility("hidden",f.mount);
  assert.equal(f.card().props.suspended,true);
  f.env.advance(60000,f.mount);f.env.visibility("visible",f.mount);f.env.advance(1000,f.mount);
  assert.equal(f.session.paused,false);assert.equal(f.card().key,key);
  assert.ok(f.checkpoints.every(row=>!Object.hasOwn(row,"paused")));
  assert.match(label(f.mount.tree),/00:02/);
  assert.deepEqual(f.sideEffects,[]);
});
test("Study five-minute inactivity freezes only the clock and resumes naturally on a real registered key event",()=>{
  const f=studyFixture();f.env.advance(300000,f.mount);
  assert.equal(f.session.paused,false);assert.equal(f.card().props.suspended,true);
  f.env.advance(600000,f.mount);assert.match(label(f.mount.tree),/05:00/);
  f.env.document.emit("keydown");f.mount.flush();f.env.advance(1000,f.mount);
  assert.match(label(f.mount.tree),/05:01/);assert.equal(f.card().props.suspended,false);
  assert.equal(f.session.cursor,0);assert.deepEqual(f.sideEffects,[]);
});
test("Study pagehide/pageshow does not count a suspended page and does not require resume",()=>{
  const f=studyFixture();f.env.advance(1000,f.mount);f.env.window.emit("pagehide");f.mount.flush();
  f.env.advance(60000,f.mount);f.env.window.emit("pageshow");f.mount.flush();f.env.advance(1000,f.mount);
  assert.match(label(f.mount.tree),/00:02/);assert.equal(f.session.paused,false);
  assert.ok(f.checkpoints.every(row=>!Object.hasOwn(row,"paused")));
});
test("Study manual pause keeps the keyed activity mounted but hidden/inert and stays paused across visibility and reload",async()=>{
  const f=studyFixture(),before=f.card();f.env.advance(1000,f.mount);
  button(f.mount,"Pausar sessão").props.onClick();await settle(f.mount);
  const paused=f.card();assert.equal(paused.type,before.type);assert.equal(paused.key,before.key);
  assert.ok(nodes(f.mount.tree).some(n=>n.props?.hidden===true&&n.props.inert===true&&nodes(n).includes(paused)));
  assert.equal(paused.props.suspended,true);assert.equal(f.session.paused,true);
  f.env.visibility("hidden",f.mount);f.env.advance(120000,f.mount);f.env.visibility("visible",f.mount);
  assert.equal(f.session.paused,true);
  f.mount.unmount();
  const reloaded=studyFixture(f.session.paused,f.session.durationSeconds);
  reloaded.env.advance(60000,reloaded.mount);assert.equal(reloaded.session.paused,true);
  assert.match(label(reloaded.mount.tree),/00:01/);
  button(reloaded.mount,"Retomar sessão").props.onClick();await settle(reloaded.mount);
  reloaded.env.advance(1000,reloaded.mount);assert.equal(reloaded.session.paused,false);
  assert.match(label(reloaded.mount.tree),/00:02/);
});
test("actual engagement clock fences visibility gaps, idle limit and throttled callbacks without changing pause state",()=>{
  const env=environment(),h=harness(env),{StudyActivityClock}=h.load("src/domain/study/session-time.ts");
  const typing=new StudyActivityClock(0,true);typing.interact(200);typing.interact(700);assert.equal(typing.takeElapsedMs(1000),1000);
  const c=new StudyActivityClock(0,true);assert.equal(c.takeElapsedMs(1000),1000);
  c.setVisible(false,1000);assert.equal(c.takeElapsedMs(120000),0);
  c.setVisible(true,120000);assert.equal(c.takeElapsedMs(121000),1000);
  c.interact(121000);assert.equal(c.takeElapsedMs(421000),2000);assert.equal(c.isActive(421000),false);
  assert.equal(c.takeElapsedMs(500000),0);c.interact(500000);assert.equal(c.takeElapsedMs(500200,500),200);
});

function recorderFixture() {
  const env=environment(),h=harness(env),tracks=[],recorders=[],effects=[],text=empty;
  let nextPermission=null;
  const media=()=>({getTracks:()=>[{stop(){tracks.push("stopped");}}]});
  class FakeRecorder {
    state="inactive";mimeType="audio/webm";
    constructor(stream){this.stream=stream;recorders.push(this);}
    start(){this.state="recording";}
    stop(){this.state="inactive";Promise.resolve().then(()=>{this.ondataavailable?.({data:new Blob(["technical-synthetic"])});this.onstop?.();});}
  }
  class Reader {
    readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result="data:audio/webm;base64,"+Buffer.from(bytes).toString("base64");this.onloadend?.();});}
  }
  env.window.MediaRecorder=FakeRecorder;
  Object.assign(env.globals,{MediaRecorder:FakeRecorder,FileReader:Reader,navigator:{mediaDevices:{getUserMedia:()=>nextPermission??Promise.resolve(media())}},fetch(){effects.push("network");throw Error("No network allowed");}});
  const draftStore=h.load("src/lib/speaking-draft-store.ts");
  const {SpeakingRecorder}=h.load("src/components/activities/speaking-recorder.tsx",{
    "@/lib/speaking-draft-store":draftStore,
    "lucide-react":icons,"@/components/study-provider":{useStudy:()=>({course:{id:"course"},language:{},state:{speaking:[],profile:{}},saveSpeaking(){effects.push("save");}})},
    "@/components/audio/speak-button":{SpeakButton:empty},"@/lib/audio-to-wav":{audioToWav:async(blob)=>blob},
    "@/engine/variants/speech":{resolveSpeechOperation:()=>({status:"unavailable"})},
    "@/engine/variants/resolution":{resolveLearningVariant:()=>({status:"resolved"})},
    "@/components/learning/text-presentation":{useTextPresentation:()=>()=>({}),LearningText:empty,LearningTextarea:text},
  });
  const activity={id:"speech",type:"speaking",guidance:[],referenceText:"",presentation:{}};
  const mount=h.mount(SpeakingRecorder,{activity,suspended:false,onSubmitSpeaking:async()=>effects.push("submit"),onSaved:()=>effects.push("saved")});
  return {env,h,mount,tracks,recorders,effects,activity,text,
    deferPermission(){let resolve;nextPermission=new Promise(r=>{resolve=r;});return ()=>resolve(media());},
    textarea:()=>nodes(mount.tree).find(n=>n.type===text&&n.props.id==="transcription-speech"),
    audio:()=>nodes(mount.tree).find(n=>n.type==="audio"),
  };
}
test("Speaking suspension stops capture and tracks, retains blob/transcription and never saves or evaluates automatically",async()=>{
  const f=recorderFixture();button(f.mount,"Gravar resposta").props.onClick();await settle(f.mount);
  assert.equal(f.recorders[0].state,"recording");
  f.mount.render({...f.mount.props,suspended:true});await settle(f.mount);
  assert.equal(f.recorders[0].state,"inactive");assert.ok(f.tracks.length>0);assert.ok(f.audio()?.props.src);
  f.textarea().props.onChange({target:{value:"minha transcrição"}});f.mount.flush();
  const clip=f.audio().props.src;
  f.mount.render({...f.mount.props,suspended:false});await settle(f.mount);
  assert.equal(f.textarea().props.value,"minha transcrição");assert.equal(f.audio().props.src,clip);
  assert.equal(f.recorders.length,1);assert.deepEqual(f.effects,[]);
});
test("Speaking pending microphone permission cannot start after suspension/unmount and preserves the prior draft",async()=>{
  const f=recorderFixture();button(f.mount,"Gravar resposta").props.onClick();await settle(f.mount);
  button(f.mount,"Parar gravação").props.onClick();await settle(f.mount);
  f.textarea().props.onChange({target:{value:"rascunho anterior"}});f.mount.flush();
  const clip=f.audio().props.src,grant=f.deferPermission();
  button(f.mount,"Gravar novamente").props.onClick();await settle(f.mount);
  f.mount.render({...f.mount.props,suspended:true});grant();await settle(f.mount);
  assert.equal(f.recorders.length,1);assert.equal(f.textarea().props.value,"rascunho anterior");assert.equal(f.audio().props.src,clip);
  assert.deepEqual(f.effects,[]);
  const next=recorderFixture(),grantAfter=next.deferPermission();
  button(next.mount,"Gravar resposta").props.onClick();next.mount.unmount();grantAfter();await settle(next.mount);
  assert.equal(next.recorders.length,0);assert.ok(next.tracks.length>0);assert.deepEqual(next.effects,[]);
});

function classroomFixture({mode="slides",phase="presenting",positionMs=0}={}) {
  const env=environment(),h=harness(env),clock=h.load("src/domain/study/session-time.ts");
  const evidence=h.load("src/domain/interactive-lesson/evidence.ts",{},true);
  const runtime=h.load("src/domain/interactive-lesson/runtime.ts",{"./evidence":evidence},true);
  const mediaController=h.load("src/domain/interactive-lesson/presentation-controller.ts",{},true);
  const playback=h.load("src/lib/speak-text.ts",{
    "@/lib/speech-voice-preference":{readVoicePreference:()=>null},
    "@/engine/variants/speech":{selectBrowserVoice:()=>({status:"unavailable"})},
  },true);
  const ActivityRenderer=()=>null,requests=[],narrationCalls=[];
  const presentation=phase==="checkpoint"?undefined:{mode,durationMs:600000,transcript:[],...(mode==="audio"?{mediaId:"audio"}:{})};
  const segment={id:"segment",type:phase==="checkpoint"?"checkpoint":"explanation",activityRef:"practice",required:true,allowInterruption:true,concepts:[],resumeAnchorsMs:[0],cues:[],presentation,explanation:"Fixture"};
  const definition={id:"definition",lessonId:"lesson",title:"Lesson",estimatedMinutes:10,segments:[segment]};
  const restored={...runtime.initialRuntime(definition),phase,positionMs,evidenceScope:{userId:"owner",courseId:"course",lessonId:"lesson",sessionId:"session",contentVersion:"1.0.0",definitionHash:"fixture"}};
  const activity={id:"practice",type:phase==="checkpoint"?"writing":"lesson_content"};
  const course={id:"course",slug:"course",sourceLanguage:"pt",units:[{lessons:[{id:"lesson",activities:[activity]}]}]};
  env.globals.fetch=async(url,options={})=>{
    requests.push({url,method:options.method??"GET",body:options.body?JSON.parse(options.body):null});
    assert.equal(url.startsWith("/api/interactive-lessons/session"),true,"Unexpected submission/provider route");
    const body=options.body?JSON.parse(options.body):null;
    return {ok:true,json:async()=>body?{revision:2,runtime:body.runtime}:{session:{revision:1,content_version:"1.0.0",runtime_state:structuredClone(restored)}}};
  };
  class Narrator {
    pause(){narrationCalls.push("pause");}
    cancel(){narrationCalls.push("cancel");}
    start(){narrationCalls.push("start");}
    resume(){narrationCalls.push("resume");}
  }
  const {InteractiveClassroom}=h.load("src/components/interactive-lesson/interactive-classroom.tsx",{
    "next/image":{default:empty},"next/link":{default:empty},"lucide-react":icons,
    "@/components/learning/text-presentation":{useTextPresentation:()=>()=>({}),LearningText:empty,LearningTextarea:empty},
    "@/engine/presentation/language":{presentationLanguage:()=> "synthetic"},
    "@/content/contracts":{lessonActionSchema:{safeParse:()=>({success:false})}},
    "@/components/activities/activity-renderer":{ActivityRenderer},
    "@/components/audio/speak-button":{SpeechPlaybackScope:{Provider:empty}},
    "@/lib/speak-text":playback,
    "@/content/language-variant":{textToSpeechLocale:()=>null},
    "@/engine/variants/resolution":{resolveLearningVariant:()=>({status:"resolved",variantId:"synthetic"})},
    "@/domain/interactive-lesson/narration-controller":{NarrationController:Narrator,narrationLine:()=>({}),transcriptNarration:()=>[],teachingNarration:()=>[]},
    "@/components/study-provider":{useStudy:()=>({course,language:{identity:{nativeName:"Synthetic"},speech:{support:{textToSpeech:false}}},authUserId:"owner",state:{profile:{}},
      submitAttempt(){throw Error("No attempt permitted");},captureInteractiveLessonOwner(){throw Error("No submission permitted");},applyInteractiveLessonReceipt(){throw Error("No receipt permitted");}})},
    "@/lib/feature-flags":{featureFlags:{AI_TUTOR:false}},
    "@/domain/study/session-time":clock,
    "@/domain/interactive-lesson/runtime":runtime,
    "@/domain/interactive-lesson/presentation-controller":mediaController,
    "./learning-board":{LearningBoard:empty},"./guided-study-activity":{GuidedStudyActivity:empty},
  });
  const mount=h.mount(InteractiveClassroom,{definition,courseId:"course",contentVersion:"1.0.0",media:{audio:{src:"/synthetic.webm",type:"audio"}},curatedExamples:[]});
  return {env,h,mount,requests,narrationCalls,ActivityRenderer,
    runtime:()=>mount.slots.find(slot=>slot?.current?.schemaVersion===2).current,
    card:()=>nodes(mount.tree).find(n=>n.type===ActivityRenderer),
  };
}
test("Classroom short switch freezes slide position without PAUSE and resumes the same stage naturally",async()=>{
  const f=classroomFixture();await settle(f.mount);f.env.advance(1000,f.mount);const at=f.runtime().positionMs;
  assert.ok(at>0);f.env.visibility("hidden",f.mount);f.env.advance(60000,f.mount);
  assert.equal(f.runtime().phase,"presenting");assert.equal(f.runtime().positionMs,at);
  f.env.visibility("visible",f.mount);f.env.advance(1000,f.mount);
  assert.equal(f.runtime().phase,"presenting");assert.ok(f.runtime().positionMs>at);
  assert.equal(f.runtime().segmentIndex,0);assert.deepEqual(f.runtime().completedSegmentIds,[]);
  assert.deepEqual(f.runtime().segmentEvidence,{});
});
test("Classroom prolonged inactivity and pagehide never manufacture a pause, completion or hidden advancement",async()=>{
  const f=classroomFixture();await settle(f.mount);f.env.advance(300000,f.mount);
  const at=f.runtime().positionMs;f.env.advance(600000,f.mount);
  assert.equal(f.runtime().positionMs,at);assert.equal(f.runtime().phase,"presenting");
  f.env.document.emit("keydown");f.mount.flush();f.env.advance(1000,f.mount);assert.ok(f.runtime().positionMs>at);
  const before=f.runtime().positionMs;f.env.window.emit("pagehide");f.mount.flush();f.env.advance(60000,f.mount);
  assert.equal(f.runtime().positionMs,before);f.env.window.emit("pageshow");f.mount.flush();f.env.advance(1000,f.mount);
  assert.ok(f.runtime().positionMs>before);assert.equal(f.runtime().phase,"presenting");
});
test("Classroom manual pause remains manual through tab changes and a restored load",async()=>{
  const f=classroomFixture();await settle(f.mount);f.env.advance(1000,f.mount);
  button(f.mount,"Pausar aula").props.onClick();f.mount.flush();
  const at=f.runtime().positionMs;assert.equal(f.runtime().phase,"paused");
  f.env.visibility("hidden",f.mount);f.env.advance(60000,f.mount);f.env.visibility("visible",f.mount);f.env.advance(1000,f.mount);
  assert.equal(f.runtime().phase,"paused");assert.equal(f.runtime().positionMs,at);
  f.mount.unmount();const loaded=classroomFixture({phase:"paused",positionMs:at});await settle(loaded.mount);
  loaded.env.advance(1000,loaded.mount);assert.equal(loaded.runtime().phase,"paused");assert.equal(loaded.runtime().positionMs,at);
  button(loaded.mount,"Reproduzir aula").props.onClick();loaded.mount.flush();loaded.env.advance(1000,loaded.mount);
  assert.equal(loaded.runtime().phase,"presenting");assert.ok(loaded.runtime().positionMs>at);
});
test("Classroom media can stop on hiding without changing learning phase and can replay with one native button action",async()=>{
  const f=classroomFixture({mode:"audio"});await settle(f.mount);
  const media=[...f.mount.media.values()][0];assert.equal(media.paused,false);
  f.env.visibility("hidden",f.mount);await settle(f.mount);
  assert.equal(media.paused,true);assert.equal(f.runtime().phase,"presenting");
  f.env.visibility("visible",f.mount);assert.equal(f.runtime().phase,"presenting");
  button(f.mount,"Reproduzir aula").props.onClick();await settle(f.mount);
  assert.equal(media.paused,false);assert.equal(f.runtime().phase,"presenting");
});
test("Classroom checkpoint keeps its keyed card and draft boundary when hidden, idle and visible again",async()=>{
  const f=classroomFixture({phase:"checkpoint"});await settle(f.mount);const card=f.card();
  assert.ok(card);f.env.visibility("hidden",f.mount);
  assert.equal(f.card().key,card.key);assert.equal(f.card().type,card.type);assert.equal(f.card().props.suspended,true);
  f.env.advance(360000,f.mount);f.env.visibility("visible",f.mount);
  assert.equal(f.card().key,card.key);assert.equal(f.card().props.suspended,false);
  assert.equal(f.runtime().phase,"checkpoint");assert.deepEqual(f.runtime().segmentEvidence,{});
});

test("actual ActivityRenderer forwards suspension only as a control signal to its mounted recorder",()=>{
  const env=environment(),h=harness(env),SpeakingRecorder=()=>null;
  const {ActivityRenderer}=h.load("src/components/activities/activity-renderer.tsx",{
    "lucide-react":icons,
    "@/components/study-provider":{useStudy:()=>({course:{},language:{speech:{support:{textToSpeech:false}}},state:{completedActivityIds:[],profile:{}},completeActivity(){throw Error("Suspension must not complete");}})},
    "@/lib/feature-flags":{featureFlags:{SPEAKING:true}},
    "./teaching-card":{TeachingCard:empty},"./deferred-recovery":{DeferredRecovery:empty},
    "./exercise-card":{ExerciseCard:empty},"./writing-editor":{WritingEditor:empty},
    "./flashcard-practice":{FlashcardPractice:empty},"./speaking-recorder":{SpeakingRecorder},
    "@/components/audio/speak-button":{SpeakButton:empty},
    "@/engine/variants/resolution":{resolveLearningVariant:()=>({status:"valid",diagnostics:[]})},
    "@/content/language-variant":{variantLabel:()=>""},
    "@/components/learning/text-presentation":{LearningText:empty},
  });
  const activity={id:"speech",type:"speaking",title:"Speech",prompt:"",minutes:1};
  const child=(suspended)=>nodes(ActivityRenderer({activity,suspended})).find(node=>node.type===SpeakingRecorder);
  const active=child(false),held=child(true);
  assert.equal(active.key,held.key);assert.equal(held.key,activity.id);
  assert.equal(active.props.suspended,false);assert.equal(held.props.suspended,true);
});
