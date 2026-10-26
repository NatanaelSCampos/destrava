import assert from "node:assert/strict";
import test from "node:test";
import {environment,harness,button,nodes,label} from "./ui-lifecycle-harness.mjs";
import {fixture,clip} from "./recorder-fixture.mjs";
import {fakeIndexedDB} from "./indexeddb-fixture.mjs";
const scope=(ownerId="owner")=>({ownerId,courseId:"course",contentVersion:"1.0.0",source:"compiled",activityId:"speech",practiceMode:"lesson"});
const data=(revision,transcription="draft")=>({blob:new Blob(["audio-bytes"],{type:"audio/webm"}),transcription,updatedAt:1,revision});
function store(storage){const env=environment();env.globals.indexedDB=storage;return harness(env).load("src/lib/speaking-draft-store.ts");}
async function drain(mount){for(let i=0;i<90;i++){await Promise.resolve();mount?.flush();}}

test("scope key retains the response-draft tuple8 and isolates owner, edition, installation, artifact, version session and mode",async()=>{
  const storage=fakeIndexedDB(),api=store(storage),base={...scope(),source:"installed",installationId:"installation",artifactHash:"artifact",versionSessionId:"version-session"};
  assert.deepEqual(JSON.parse(api.speakingDraftKey(base).split("v1:")[1]),["owner","course","1.0.0","installed","installation","artifact","version-session","speech","lesson",null]);
  await api.writeSpeakingDraft(base,data("original"));
  for(const change of [{ownerId:"other"},{courseId:"other"},{contentVersion:"1.1.0"},{source:"compiled"},{installationId:"other"},{artifactHash:"other"},{versionSessionId:"other"},{activityId:"other"},{practiceMode:"own"},{numberPromptId:"number"}])
    assert.equal(await api.readSpeakingDraft({...base,...change}),null,JSON.stringify(change));
});
test("completed local blob and text reload from IndexedDB in a fresh component/module without capture or submission",async()=>{
  const storage=fakeIndexedDB(),first=fixture({}, {storage,owner:"owner"});await drain(first.mount);await clip(first);await drain(first.mount);
  assert.ok(storage.rows.size>0);const original=first.audio().props.src;first.mount.unmount();
  const reloaded=fixture({}, {storage,owner:"owner"});await drain(reloaded.mount);
  assert.equal(reloaded.textarea().props.value,"meu rascunho");assert.equal(reloaded.audio().props.src,original);assert.equal(reloaded.recorders.length,0);assert.deepEqual(reloaded.effects,[]);
  assert.match(label(reloaded.mount.tree),/Rascunho guardado neste navegador/);
});
test("pending hydration blocks UI and handlers; text-only edits after loading preserve the previous blob",async()=>{
  const storage=fakeIndexedDB(),api=store(storage),original=data("old","old text");await api.writeSpeakingDraft(scope(),original);
  storage.controls.holdReads=true;const f=fixture({}, {storage,owner:"owner"});await drain(f.mount);
  assert.equal(f.textarea().props.disabled,true);assert.equal(button(f.mount,"Gravar resposta").props.disabled,true);assert.equal(button(f.mount,"Salvar").props.disabled,true);
  assert.match(label(f.mount.tree),/Carregando rascunho/);
  f.textarea().props.onChange({target:{value:"early text"}});button(f.mount,"Gravar resposta").props.onClick();button(f.mount,"Salvar").props.onClick();f.mount.flush();await drain(f.mount);
  assert.equal(f.textarea().props.value,"");assert.equal(f.recorders.length,0);assert.deepEqual(f.effects,[]);
  storage.controls.release();await drain(f.mount);
  assert.equal(f.textarea().props.disabled,false);assert.equal(f.textarea().props.value,"old text");assert.ok(f.audio()?.props.src);
  const before=await f.draftStore.readSpeakingDraft(scope());assert.ok(before.blob);assert.equal(before.revision,"old");assert.equal(await before.blob.text(),await original.blob.text());
  f.textarea().props.onChange({target:{value:"new text"}});f.mount.flush();await drain(f.mount);
  const changed=await f.draftStore.readSpeakingDraft(scope());assert.equal(changed.transcription,"new text");assert.ok(changed.blob);assert.equal(await changed.blob.text(),await original.blob.text());
  button(f.mount,"Gravar novamente").props.onClick();await drain(f.mount);
  assert.equal(f.recorders.at(-1).state,"recording");const newCapture=await f.draftStore.readSpeakingDraft(scope());assert.equal(newCapture.blob,null);assert.equal(newCapture.transcription,"");
  f.mount.unmount();
});
test("the draft hook itself rejects partial updates before its owner-scoped read completes",async()=>{
  const storage=fakeIndexedDB(),api=store(storage),original=data("old","old text");await api.writeSpeakingDraft(scope(),original);
  storage.controls.holdReads=true;const env=environment();env.globals.indexedDB=storage;const h=harness(env),hook=h.load("src/lib/speaking-draft-store.ts"),ownerScope=scope();
  const mount=h.mount(()=>hook.useSpeakingDraft(ownerScope));await drain(mount);assert.equal(mount.tree.loaded,false);
  mount.tree.update({transcription:"early update"});await drain(mount);assert.equal(mount.tree.draft,null);
  storage.controls.release();await drain(mount);assert.equal(mount.tree.loaded,true);assert.equal(mount.tree.draft.transcription,"old text");assert.ok(mount.tree.draft.blob);
  mount.tree.update({transcription:"after load"});await drain(mount);const saved=await hook.readSpeakingDraft(ownerScope);assert.equal(saved.transcription,"after load");assert.ok(saved.blob);assert.equal(await saved.blob.text(),await original.blob.text());
});

test("a live owner or edition switch hides the former draft and stops its microphone without inheriting its blob",async()=>{
  const storage=fakeIndexedDB(),f=fixture({}, {storage,owner:"owner"});await drain(f.mount);await clip(f);await drain(f.mount);
  button(f.mount,"Gravar novamente").props.onClick();await drain(f.mount);assert.equal(f.recorders.at(-1).state,"recording");
  f.context.authUserId="other";f.mount.render();await drain(f.mount);
  assert.equal(f.recorders.at(-1).state,"inactive");assert.equal(f.textarea().props.value,"");assert.equal(f.audio(),undefined);
  f.textarea().props.onChange({target:{value:"other draft"}});f.mount.flush();await drain(f.mount);
  f.context.course.contentVersion="1.1.0";f.mount.render();await drain(f.mount);assert.equal(f.textarea().props.value,"");assert.equal(f.audio(),undefined);assert.deepEqual(f.effects,[]);
});
test("quota failure retains the current response with an honest warning; absence of owner performs no IndexedDB access",async()=>{
  const storage=fakeIndexedDB();storage.controls.quota=true;const f=fixture({}, {storage,owner:"owner"});await drain(f.mount);
  f.textarea().props.onChange({target:{value:"keep me"}});f.mount.flush();await drain(f.mount);
  assert.equal(f.textarea().props.value,"keep me");assert.match(label(f.mount.tree),/Mantenha esta aba aberta/);assert.equal(storage.rows.size,0);
  const anonymousStorage=fakeIndexedDB(),anonymous=fixture({}, {storage:anonymousStorage});anonymous.textarea().props.onChange({target:{value:"anonymous"}});anonymous.mount.flush();await drain(anonymous.mount);
  assert.equal(anonymous.textarea().props.value,"anonymous");assert.equal(anonymousStorage.controls.opens,0);assert.equal(await anonymous.draftStore.readSpeakingDraft(scope(null)),null);assert.equal(anonymousStorage.controls.opens,0);
});
test("revision comparison deletes only the explicitly saved draft and preserves a newer write",async()=>{
  const storage=fakeIndexedDB(),api=store(storage);await api.writeSpeakingDraft(scope(),data("old"));await api.writeSpeakingDraft(scope(),data("new","new text"));
  assert.equal(await api.deleteSpeakingDraft(scope(),"old"),false);assert.equal((await api.readSpeakingDraft(scope())).revision,"new");
  assert.equal(await api.deleteSpeakingDraft(scope(),"new"),true);assert.equal(await api.readSpeakingDraft(scope()),null);
});
test("a confirmed guided save cannot clear a newer response typed while its submission was pending",async()=>{
  const storage=fakeIndexedDB();let finish;const submitted=new Promise(resolve=>finish=resolve);
  const f=fixture({onSubmitSpeaking:async()=>submitted},{storage,owner:"owner"});await drain(f.mount);await clip(f);await drain(f.mount);
  button(f.mount,"Salvar").props.onClick();await drain(f.mount);f.textarea().props.onChange({target:{value:"newer after submit"}});f.mount.flush();await drain(f.mount);
  finish();await drain(f.mount);assert.equal(f.textarea().props.value,"newer after submit");assert.equal((await f.draftStore.readSpeakingDraft(scope())).transcription,"newer after submit");
  assert.equal(nodes(f.mount.tree).some(node=>node.props?.className==="inline-success"),false);
});
