import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
import {test} from "node:test";
const require=createRequire(import.meta.url);
const ts=require("typescript");
const {renderToStaticMarkup}=require("react-dom/server");
const React=require("react");
const source=fs.readFileSync("src/components/study-sync-notice.tsx","utf8");
const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function render(overrides={}){
 const context={course:{id:"test-course"},syncError:'insert or update on table "user_activity_progress" violates foreign key constraint "user_activity_progress_activity_id_fkey"',pendingProgress:[{}],hasRecoveredProgress:false,progressLoadStatus:"loaded",retryProgressSync:()=>{},...overrides};
 const sandboxModule={exports:{}};
 vm.runInNewContext(js,{module:sandboxModule,exports:sandboxModule.exports,require:id=>id==="./study-provider"?{useStudy:()=>context}:require(id)});
 return renderToStaticMarkup(React.createElement(sandboxModule.exports.StudySyncNotice));
}
test("SQL details never enter the learner error banner",()=>{
 const html=render();assert.match(html,/role="alert"/);assert.match(html,/Tentar sincronizar/);assert.match(html,/Mantenha esta página aberta/);assert.doesNotMatch(html,/user_activity_progress|foreign key|constraint|insert or update/i);
});
test("load failure offers a plain explanation and the load retry",()=>{
 const html=render({progressLoadStatus:"failed"});assert.match(html,/Não foi possível carregar seu progresso/);assert.match(html,/Tentar carregar novamente/);assert.doesNotMatch(html,/foreign key|constraint/);
});
test("recovery notice remains distinct and successful synchronization hides the notice",()=>{
 assert.match(render({syncError:"",hasRecoveredProgress:true}),/role="status"/);
 assert.equal(render({syncError:"",hasRecoveredProgress:false}),"");
});
