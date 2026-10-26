import test from 'node:test';import assert from 'node:assert/strict';
import {findLanguageSpecificReferences as scan} from './architecture-language-check.ts';
const file='src/lib/installed-local-profile.ts';const identity="env.DESTRAVA_LOCAL_PROJECT === 'espanhol-plataform'";
test('exact infrastructure equality is allowed',()=>assert.deepEqual(scan(file,identity),[]));
for(const [name,f,s]of [
 ['wrong file','src/domain/study/policy.ts',identity],['wrong operator',file,identity.replace('===','==')],
 ['not equal',file,identity.replace('===','!==')],['wrong property',file,identity.replace('DESTRAVA_LOCAL_PROJECT','language')],
 ['wrong object',file,identity.replace('env.','course.')],['wrong project',file,identity.replace('espanhol-plataform','espanhol-other')],
 ['case',file,identity.replace('espanhol','Espanhol')],['template',file,'env.DESTRAVA_LOCAL_PROJECT === `espanhol-plataform`'],
 ['comment',file,'// '+identity],['code string',file,JSON.stringify(identity)],
 ['same line coupling',file,identity+'; spanishResources();'],['same line locale',file,identity+'; speak("en-US");'],
 ['next line coupling',file,identity+';\nconst lang="es-ES";'],['reverse comparison',file,"'espanhol-plataform' === env.DESTRAVA_LOCAL_PROJECT"],
 ['syntax failure',file,identity+'; const ='],['literal in return',file,"function course(){ return 'espanhol-plataform'; }"]
])test(name,()=>assert(scan(f,s).length>0));
test('all matches on an allowed line are examined',()=>assert.equal(scan(file,identity+'; spanishResources(); English();').length,1));
test('several offending lines survive',()=>assert.equal(scan(file,identity+';\nspanishResources();\nEnglish();').length,2));
test('valid generic code remains valid',()=>assert.deepEqual(scan('src/domain/example.ts','const language=course.languageCode;'),[]));
test('optional chain is not the exact infrastructure comparison', () => { assert.equal(scan('src/lib/installed-local-profile.ts', `env?.DESTRAVA_LOCAL_PROJECT === 'espanhol-plataform'`).length, 1); });
