import assert from "node:assert/strict";
import test from "node:test";
import {button,settle} from "./ui-lifecycle-harness.mjs";
import {fixture,clip,hide,show} from "./recorder-fixture.mjs";

test("default recorder suspends locally on visibilitychange and preserves audio/text without automatic submit or restart",async()=>{
  const f=fixture();assert.equal(Object.hasOwn(f.mount.props,"suspended"),false);
  button(f.mount,"Gravar resposta").props.onClick();await settle(f.mount);
  f.textarea().props.onChange({target:{value:"texto atual"}});f.mount.flush();
  hide(f,"visibilitychange");await settle(f.mount);
  assert.equal(f.recorders[0].state,"inactive");assert.ok(f.streams[0].track.stops>0);const src=f.audio().props.src;
  assert.equal(button(f.mount,"Gravar novamente").props.disabled,true);
  show(f,"visibilitychange");await settle(f.mount);f.env.advance(21000,f.mount);
  assert.equal(f.recorders.length,1);assert.equal(f.audio().props.src,src);assert.equal(f.textarea().props.value,"texto atual");assert.deepEqual(f.effects,[]);
});
test("pagehide stops a regular recorder; pageshow respects manual suspension and never restarts",async()=>{
  const f=fixture();button(f.mount,"Gravar resposta").props.onClick();await settle(f.mount);
  hide(f,"pagehide");await settle(f.mount);assert.equal(f.recorders[0].state,"inactive");assert.ok(f.streams[0].track.stops>0);
  f.mount.render({...f.mount.props,suspended:true});show(f,"pagehide");await settle(f.mount);
  assert.equal(button(f.mount,"Gravar novamente").props.disabled,true);button(f.mount,"Gravar novamente").props.onClick();await settle(f.mount);
  assert.equal(f.recorders.length,1);assert.deepEqual(f.effects,[]);
  f.mount.render({...f.mount.props,suspended:false});await settle(f.mount);assert.equal(f.recorders.length,1);
});
test("both native hide paths invalidate pending permission even after returning, preserving the previous draft",async()=>{
  for(const event of ["visibilitychange","pagehide"]){const f=fixture(),src=await clip(f),grant=f.permission();button(f.mount,"Gravar novamente").props.onClick();await settle(f.mount);hide(f,event);show(f,event);grant();await settle(f.mount);
    assert.equal(f.recorders.length,1,event);assert.ok(f.streams.at(-1).track.stops>0,event);assert.equal(f.audio().props.src,src);assert.equal(f.textarea().props.value,"meu rascunho");assert.deepEqual(f.effects,[]);}
});
test("constructor and start failures release their own acquired stream without discarding the previous draft",async()=>{
  for(const failure of ["constructor","start-before","start-after"]){const f=fixture(),src=await clip(f);f.failure(failure);button(f.mount,"Gravar novamente").props.onClick();await settle(f.mount);
    assert.ok(f.streams.at(-1).track.stops>0,failure);assert.equal(f.audio().props.src,src,failure);assert.equal(f.textarea().props.value,"meu rascunho",failure);assert.deepEqual(f.effects,[]);assert.equal(button(f.mount,"Gravar novamente").props.disabled,false);}
});
test("unmount invalidates permission and removes all native visibility/page lifecycle listeners",async()=>{
  const f=fixture(),grant=f.permission();button(f.mount,"Gravar resposta").props.onClick();f.mount.unmount();grant();await settle(f.mount);
  assert.equal(f.recorders.length,0);assert.ok(f.streams[0].track.stops>0);for(const target of [f.env.document,f.env.window])for(const listeners of target.listeners.values())assert.equal(listeners.size,0);assert.deepEqual(f.effects,[]);
});
test("an initially hidden document cannot acquire a microphone, including direct invocation of its native handler",async()=>{
  const f=fixture();f.env.document.visibilityState="hidden";button(f.mount,"Gravar resposta").props.onClick();await settle(f.mount);assert.equal(f.streams.length,0);assert.equal(f.recorders.length,0);assert.deepEqual(f.effects,[]);
});
test("the existing twenty-second bound releases the microphone and still requires an explicit new capture",async()=>{
  const f=fixture();button(f.mount,"Gravar resposta").props.onClick();await settle(f.mount);f.env.advance(20000,f.mount);await settle(f.mount);
  assert.equal(f.recorders[0].state,"inactive");assert.ok(f.streams[0].track.stops>0);assert.ok(f.audio().props.src);f.env.advance(20000,f.mount);assert.equal(f.recorders.length,1);assert.deepEqual(f.effects,[]);
});
test("hiding during explicit audio conversion invalidates the pending guided submit even after returning",async()=>{
  for(const returnFirst of [false,true]){const f=fixture();await clip(f);const release=f.conversion();button(f.mount,"Salvar").props.onClick();await settle(f.mount);hide(f,"pagehide");if(returnFirst)show(f,"pagehide");release();await settle(f.mount);assert.deepEqual(f.effects,[]);assert.equal(f.textarea().props.value,"meu rascunho");}
});
