import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";

export const root = process.env.DESTRAVA_TEST_SOURCE_ROOT;
const modules = process.env.DESTRAVA_TEST_NODE_MODULES;
if (!root || !modules) throw Error("Explicit own source root + readonly modules required");
const require = createRequire(import.meta.url);
const ts = require(resolve(modules, "typescript"));
export const React = require(resolve(modules, "react"));
const jsx = require(resolve(modules, "react/jsx-runtime"));
export const main = dirname(modules);
export function nodes(node) {
  if (!node || typeof node !== "object") return [];
  const children = node.props?.children;
  return [node, ...(Array.isArray(children) ? children : [children]).flatMap(nodes)];
}
export function label(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object") return "";
  const children = node.props?.children;
  return (Array.isArray(children) ? children : [children]).map(label).join("");
}
class Events {
  listeners = new Map();
  addEventListener = (name, fn) => { const set = this.listeners.get(name) ?? new Set(); set.add(fn); this.listeners.set(name, set); };
  removeEventListener = (name, fn) => this.listeners.get(name)?.delete(fn);
  emit(name) { for (const fn of [...(this.listeners.get(name) ?? [])]) fn({ type: name }); }
}
export function environment() {
  let now = 0, nextId = 0;
  const jobs = new Map(), document = new Events(), window = new Events();
  document.visibilityState = "visible";
  const add = (fn, delay, interval) => { const id = ++nextId; jobs.set(id, { fn, at: now + delay, interval }); return id; };
  window.setTimeout = (fn, delay) => add(fn, delay, 0);
  window.setInterval = (fn, delay) => add(fn, delay, delay);
  window.clearTimeout = window.clearInterval = (id) => jobs.delete(id);
  class HTMLMediaElement {
    currentTime = 0; duration = 600; playbackRate = 1; paused = true;
    getAttribute() { return ""; }
    pause() { this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
  }
  const globals = { window, document, performance: { now: () => now }, HTMLMediaElement, Blob, Buffer, crypto: globalThis.crypto };
  return {
    globals, window, document, jobs,
    get now() { return now; },
    advance(ms, mount) {
      const end = now + ms; let count = 0;
      while (true) {
        const entry = [...jobs].filter(([, job]) => job.at <= end).sort((a,b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!entry) break;
        assert.ok(++count < 20000, "Unbounded timer loop");
        const [id, job] = entry; now = job.at;
        if (job.interval) job.at += job.interval; else jobs.delete(id);
        job.fn(); mount?.flush();
      }
      now = end; mount?.flush();
    },
    visibility(value, mount) { document.visibilityState = value; document.emit("visibilitychange"); mount?.flush(); },
  };
}
export function harness(env) {
  let current;
  const hooks = {
    ...React,
    useState(initial) {
      const mount = current, index = mount.cursor++;
      if (!mount.slots[index]) {
        const slot = { value: typeof initial === "function" ? initial() : initial };
        slot.set = (next) => {
          if (!mount.alive) return;
          const value = typeof next === "function" ? next(slot.value) : next;
          if (!Object.is(slot.value, value)) { slot.value = value; mount.dirty = true; }
        };
        mount.slots[index] = slot;
      }
      const slot = mount.slots[index]; return [slot.value, slot.set];
    },
    useRef(initial) { const m=current,i=m.cursor++; return m.slots[i] ??= { current: initial }; },
    useMemo(create, deps) {
      const m=current,i=m.cursor++,old=m.slots[i];
      if (!old || !deps || !old.deps || deps.some((d,j)=>!Object.is(d,old.deps[j]))) m.slots[i]={value:create(),deps};
      return m.slots[i].value;
    },
    useCallback(fn,deps) { return hooks.useMemo(()=>fn,deps); },
    useEffect(create,deps) {
      const m=current,i=m.cursor++,old=m.slots[i];
      if (!old || !deps || !old.deps || deps.some((d,j)=>!Object.is(d,old.deps[j]))) m.effects.push({i,create,deps,cleanup:old?.cleanup});
    },
    useSyncExternalStore(subscribe,getSnapshot) {
      const [,setSnapshot]=hooks.useState(getSnapshot);
      hooks.useEffect(()=>subscribe(()=>setSnapshot(getSnapshot())),[subscribe,getSnapshot]);
      return getSnapshot();
    },
    useReducer(reducer,arg,initialize) {
      const [value,set] = hooks.useState(()=>initialize?initialize(arg):arg);
      const ref=hooks.useRef(reducer);ref.current=reducer;
      const dispatch=hooks.useCallback((event)=>set((state)=>ref.current(state,event)),[set]);
      return [value,dispatch];
    },
  };
  function load(file, imports={}, baseline=false) {
    const text=readFileSync(resolve(baseline?main:root,file),"utf8");
    const out=ts.transpileModule(text,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
    assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
    const loadedModule={exports:{}},bindings={react:hooks,"react/jsx-runtime":jsx,...imports};
    const globals=Object.keys(env.globals);
    new Function("require","module","exports",...globals,out.outputText)((id)=>{
      assert.ok(Object.hasOwn(bindings,id),"Unexpected source import "+id);return bindings[id];
    },loadedModule,loadedModule.exports,...globals.map(key=>env.globals[key]));
    return loadedModule.exports;
  }
  function mount(Component,props={}) {
    const m={slots:[],cursor:0,effects:[],alive:true,dirty:true,tree:null,props,media:new Map()};
    m.flush=()=>{
      let renders=0;
      while(m.dirty && m.alive){
        assert.ok(++renders<30,"Infinite rerender");m.dirty=false;m.cursor=0;m.effects=[];current=m;
        m.tree=Component(m.props);current=null;
        for(const node of nodes(m.tree)) {
          if(typeof node.type==="string" && ["audio","video"].includes(node.type)){
            const key=node.key??node.type;let element=m.media.get(key);
            if(!element){element=new env.globals.HTMLMediaElement();m.media.set(key,element);}
            if(typeof node.props.ref==="function")node.props.ref(element);
          } else if(node.props?.ref && typeof node.props.ref==="object")
            node.props.ref.current={querySelectorAll:()=>[]};
        }
        for(const effect of m.effects){effect.cleanup?.();const cleanup=effect.create();m.slots[effect.i]={deps:effect.deps,cleanup};}
      }
      return m.tree;
    };
    m.render=(next=m.props)=>{m.props=next;m.dirty=true;return m.flush();};
    m.unmount=()=>{m.alive=false;for(const slot of m.slots)slot?.cleanup?.();};
    m.flush();return m;
  }
  return {load,mount,hooks};
}
export async function settle(mount) { for(let i=0;i<18;i++){await Promise.resolve();mount.flush();} }
export const empty = ()=>null;
export const icons = new Proxy({}, { get:()=>empty });
export function button(mount,text) {
  const result=nodes(mount.tree).find(node=>node.type==="button"&&(node.props["aria-label"]===text||label(node).includes(text)));
  assert.ok(result,"Button absent: "+text);return result;
}
