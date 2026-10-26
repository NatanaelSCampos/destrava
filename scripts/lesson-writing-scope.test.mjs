import test from 'node:test';
import assert from 'node:assert/strict';
import { lessonWritingScopeKey as key } from '../src/lib/lesson-writing-scope.ts';
const scope={userId:'owner',courseId:'course',contentVersion:'2.1.0',source:'installed',installationId:'install',artifactHash:'hash',versionSessionId:'session',unitId:'unit',lessonId:'lesson'};
for(const field of ['userId','courseId','contentVersion','source','installationId','artifactHash','versionSessionId','unitId','lessonId'])
  test('draft boundary separates '+field,()=>assert.notEqual(key(scope),key({...scope,[field]:field==='source'?'compiled':'other'})));
test('logout and anonymous cannot inherit owner scope',()=>assert.notEqual(key(scope),key({...scope,userId:null})));
test('delimiter collision cannot merge contexts',()=>assert.notEqual(key({...scope,unitId:'a:b',lessonId:'c'}),key({...scope,unitId:'a',lessonId:'b:c'})));
test('literal null text and missing installation cannot collide',()=>assert.notEqual(key({...scope,installationId:'null'}),key({...scope,installationId:undefined})));
test('Unicode identities stay distinct without normalization',()=>assert.notEqual(key({...scope,lessonId:'\u00e9'}),key({...scope,lessonId:'e\u0301'})));
test('same context has stable key',()=>assert.equal(key(scope),key({...scope})));
