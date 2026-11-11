const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
test('local settings control opacity, automatic updates and guarded restart without a hosted settings page',async t=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../dist/preferences.html'),'utf8'),{runScripts:'outside-only'}); t.after(()=>dom.window.close());
 let listener; const calls=[]; let view={language:'ko',opacity:1,update:{currentVersion:'0.1.5',automatic:true,status:'current',canRestart:false}};
 dom.window.heymoaPreferences={action:async value=>{calls.push(value);if(value.action==='opacity')view.opacity=value.value;if(value.action==='automatic')view.update.automatic=value.value;return view;},subscribe:f=>{listener=f;return()=>{};}};
 dom.window.eval(fs.readFileSync(path.join(__dirname,'../dist/preferences-renderer.js'),'utf8')); await new Promise(setImmediate);
 const $=id=>dom.window.document.getElementById(id);
 assert.equal($('automatic').checked,true); $('opacity').value='75';$('opacity').dispatchEvent(new dom.window.Event('change'));await new Promise(setImmediate);
 assert.equal(calls.at(-1).action,'opacity');assert.equal(calls.at(-1).value,.75);
 view={...view,update:{...view.update,status:'ready',version:'0.1.6',canRestart:false}};listener(view);
 assert.equal($('restart').disabled,true);$('restart').click();assert.equal(calls.at(-1).action,'opacity');assert.equal($('blocked').hidden,false);
 view={...view,language:'en',update:{...view.update,canRestart:true}};listener(view);
 assert.equal($('restart').textContent,'Restart to update');assert.equal($('blocked').hidden,true);$('restart').click();await new Promise(setImmediate);assert.equal(calls.at(-1),'restart');
});
