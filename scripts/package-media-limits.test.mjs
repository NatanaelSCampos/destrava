import test from 'node:test';
import assert from 'node:assert/strict';
import {packageLimits,externalPackageManifestSchema,packageAssetSchema} from '../src/content/package-contract.ts';
import {validateExternalPackageFiles} from '../src/engine/import/validate-package.ts';
const asset=i=>({path:`assets/phrase-${i}.mp3`,bytes:1000,sha256:'a'.repeat(64),mediaType:'audio/mpeg'});
test('bounded rich-course inventory accepts measured614 and maximum768 but rejects769',()=>{
 assert.equal(packageLimits.files,1024);assert.equal(packageLimits.assets,768);
 for(const n of [100,614,768])assert(externalPackageManifestSchema.shape.assets.safeParse(Array.from({length:n},(_,i)=>asset(i))).success);
 assert(!externalPackageManifestSchema.shape.assets.safeParse(Array.from({length:769},(_,i)=>asset(i))).success);
});
test('byte, activity and JSON budgets remain fixed',()=>{
 assert.equal(packageLimits.totalBytes,32*1024*1024);assert.equal(packageLimits.jsonBytes,1024*1024);
 assert.equal(packageLimits.assetBytes,16*1024*1024);assert.equal(packageLimits.activities,2000);
 assert(!packageAssetSchema.safeParse({...asset(0),bytes:packageLimits.assetBytes+1}).success);
});
for(const path of ['../escape.mp3','assets/../../escape.mp3','https://example.test/audio.mp3','D:/audio.mp3','assets/CON.mp3'])test('larger inventory does not permit '+path,()=>assert(!packageAssetSchema.safeParse({...asset(0),path}).success));
test('reader rejects count beyond1024 and keeps614 below count limit',()=>{
 const files=n=>new Map(Array.from({length:n},(_,i)=>['assets/p'+i+'.mp3',new Uint8Array(1)]));
 assert(validateExternalPackageFiles(files(1025)).report.diagnostics.some(d=>d.code==='PACKAGE_SIZE_LIMIT'));
 assert(!validateExternalPackageFiles(files(614)).report.diagnostics.some(d=>d.code==='PACKAGE_SIZE_LIMIT'));
});
test('reader still rejects aggregate bytes above32MiB',()=>{
 const bytes=new Uint8Array(8*1024*1024),files=new Map(Array.from({length:5},(_,i)=>['assets/p'+i+'.mp3',bytes]));
 assert(validateExternalPackageFiles(files).report.diagnostics.some(d=>d.code==='PACKAGE_SIZE_LIMIT'));
});