import assert from "node:assert/strict";
import type { checkpointBrowser } from "./checkpoint-browser.mjs";
type Browser=Awaited<ReturnType<typeof checkpointBrowser>>;
/** Deterministic Web Speech boundary in a real browser. No claim of physical voice quality. */
export const syntheticSpeechSetup = `(()=>{const events=new EventTarget();const state=window.__c2speech={voices:[],calls:[],active:[],maximum:0,cancels:0};class Utterance{constructor(text){this.text=text;this.lang='';}}Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:Utterance});Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),getVoices:()=>state.voices,cancel:()=>{state.cancels++;state.active=[];},speak:utterance=>{state.calls.push(utterance);state.active.push(utterance);state.maximum=Math.max(state.maximum,state.active.length);}}});})()`;
export async function runNarrationBrowser(browser:Browser, click:(text:string)=>Promise<void>, until:(expression:string,label:string)=>Promise<unknown>,mediaPath:string){
 const status="document.querySelector('[aria-label=\"Narração da aula\"]')";
 let checks=0;
 assert.equal(await browser.evaluate('window.__c2speech.calls.length'),0);checks++;
 if(await browser.evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Ouvir apresentação')")){
  await click('Ouvir apresentação');await until(`${status}?.textContent.includes('Narração indisponível')`,'legacy or missing voice textual fallback');assert.equal(await browser.evaluate('window.__c2speech.calls.length'),0);await click('Cancelar narração');checks++;
 }
 await click('Outro exemplo');await until("Boolean(document.querySelector('button[aria-label=\"Ouvir exemplo\"]'))",'curated support example');
 await click('Ouvir exemplo');await until(`${status}?.textContent.includes('Narração indisponível')`,'initially empty voice catalogue');assert.equal(await browser.evaluate('window.__c2speech.calls.length'),0);checks++;
 await browser.evaluate("window.__c2speech.voices=[{name:'Synthetic target',lang:'es-ES',voiceURI:'c2-es',localService:true,default:true},{name:'Synthetic support',lang:'pt-BR',voiceURI:'c2-pt',localService:true,default:false}]");
 await click('Retomar frase');await until("window.__c2speech.calls.length===1",'late compatible voice retry');assert.equal(await browser.evaluate('window.__c2speech.calls.at(-1).lang'),'es-ES');
 await click('Pausar narração');assert.equal(await browser.evaluate('window.__c2speech.active.length'),0);await browser.evaluate('window.__c2speech.calls[0].onend?.()');
 await until(`${status}?.textContent.includes('Narração pausada')`,'old callback ignored after pause');
 await click('Retomar frase');await until('window.__c2speech.calls.length===2','resume speech committed after UI click');assert.equal(await browser.evaluate('window.__c2speech.calls.length'),2);assert(await browser.evaluate('window.__c2speech.calls[0].text===window.__c2speech.calls[1].text'));checks++;
 await click('Ouvir tradução');await until("window.__c2speech.calls.at(-1).lang==='pt-BR'",'declared source language translation');assert.equal(await browser.evaluate('window.__c2speech.maximum'),1);checks++;
 // Actual HTML audio served from loopback. Only Web Speech remains synthetic.
 await browser.evaluate(`(()=>{const audio=document.createElement('audio');audio.src=${JSON.stringify(mediaPath)};audio.id='c2-native-audio';audio.addEventListener('playing',()=>{window.__c2MediaPlaying=true;});const button=document.createElement('button');button.id='c2-native-control';button.textContent='Reproduzir áudio sintético';button.style.cssText='position:fixed;right:8px;top:8px;z-index:2147483000;min-height:44px';button.onclick=()=>{void audio.play().catch(error=>window.__c2MediaError=String(error));};document.querySelector('.live-page').append(audio,button);})()`);
 await click('Reproduzir áudio sintético');await until("document.getElementById('c2-native-audio')?.paused===false&&window.__c2MediaPlaying===true",'actual HTML audio playing event');
 assert.equal(await browser.evaluate('window.__c2speech.active.length'),0,'Native media cancels previous speech owner');
 await click('Ouvir tradução');await until("document.getElementById('c2-native-audio')?.paused===true",'speech pauses actual HTML audio');
 assert.equal(await browser.evaluate('window.__c2speech.active.length'),1);assert.equal(await browser.evaluate('window.__c2MediaError??null'),null);checks++;
 await browser.evaluate("document.getElementById('c2-native-audio').remove();document.getElementById('c2-native-control').remove()");
 await browser.evaluate("window.__c2speech.calls.at(-1).onerror?.({error:'synthesis-failed'})");await until(`${status}?.textContent.includes('Narração indisponível')`,'speech error textual fallback');checks++;
 await click('Retomar frase');await browser.evaluate("Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'))");assert.equal(await browser.evaluate('window.__c2speech.active.length'),0);const count=await browser.evaluate('window.__c2speech.calls.length');await browser.evaluate("delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))");assert.equal(await browser.evaluate('window.__c2speech.calls.length'),count);checks++;
 for(const width of[390,360]){await browser.viewport(width,844);await browser.evaluate("document.querySelector('.page-tour-close')?.click()");assert.equal(await browser.evaluate('innerWidth'),width);assert(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await click('Retomar frase');assert(await browser.evaluate("document.activeElement?.textContent.includes('Retomar frase')"));await click('Pausar narração');await browser.screenshot(`ciclo2-narration-${width}.png`);checks++;}
 await click('Cancelar narração');await click('Retomar explicação');await browser.viewport(1280,900);assert.equal(await browser.evaluate('window.__c2speech.active.length'),0);
 console.log(JSON.stringify({ciclo2NarrationBrowser:checks,speechBoundary:'synthetic Web Speech API',actualBrowser:true,paidCalls:0,physicalVoicesTested:false}));return checks;
}
