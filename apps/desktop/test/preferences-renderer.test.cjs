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

test('every settings label and update state follows Korean and English, including multiline help', async t => {
 const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../dist/preferences.html'), 'utf8'), { runScripts: 'outside-only' }); t.after(() => dom.window.close());
 let receive;
 dom.window.heymoaPreferences = { action: () => new Promise(() => {}), subscribe: f => { receive = f; return () => {}; } };
 dom.window.eval(fs.readFileSync(path.join(__dirname, '../dist/preferences-renderer.js'), 'utf8'));
 for (const language of ['en', 'ko', 'en']) {
  for (const status of ['idle', 'checking', 'current', 'available', 'downloading', 'ready', 'installing', 'error', 'unavailable']) {
   receive({ language, opacity: .9, update: { currentVersion: '0.1.6', version: '0.1.7', percent: 42, automatic: false, status, canRestart: false } });
   assert.equal(dom.window.document.documentElement.lang, language);
   const visibleText = [...dom.window.document.querySelectorAll('[data-i18n],#version,#status')].filter(n => !n.hidden).map(n => n.textContent).join(' ');
   if (language === 'en') assert.doesNotMatch(visibleText, /[가-힣]/, status);
   else assert.match(visibleText, /데스크톱 설정/);
   assert.equal(dom.window.document.querySelector('#automatic').checked, false);
   assert.equal(dom.window.document.querySelector('#opacity-value').textContent, '90%');
  }
 }
});


test('a visible save error switches language without losing the saved choices', async t => {
 const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../dist/preferences.html'), 'utf8'), { runScripts: 'outside-only' }); t.after(() => dom.window.close());
 let receive;
 const view = { language: 'ko', opacity: .9, update: { currentVersion: '0.1.6', automatic: false, status: 'current', canRestart: false } };
 dom.window.heymoaPreferences = { action: async value => { if (value !== 'read') throw new Error('save failed'); return view; }, subscribe: f => { receive = f; return () => {}; } };
 dom.window.eval(fs.readFileSync(path.join(__dirname, '../dist/preferences-renderer.js'), 'utf8')); await new Promise(setImmediate);
 dom.window.document.querySelector('#check').click(); await new Promise(setImmediate);
 assert.match(dom.window.document.querySelector('#error').textContent, /저장하지 못/);
 receive({ ...view, language: 'en' });
 assert.equal(dom.window.document.querySelector('#error').textContent, 'Could not save settings. Try again.');
 assert.equal(dom.window.document.querySelector('#automatic').checked, false);
});


test('Chromium renders translated settings and long update states within the native content width', async t => {
 const { chromium } = require('@playwright/test');
 const browser = await chromium.launch({ headless: true }); t.after(() => browser.close());
 const page = await browser.newPage({ viewport: { width: 400, height: 550 } });
 await page.addInitScript(() => { window.heymoaPreferences = { action: () => new Promise(() => {}), subscribe: f => { window.receiveSettings = f; return () => {}; } }; });
 await page.goto(require('node:url').pathToFileURL(path.join(__dirname, '../dist/preferences.html')).href);
 for (const language of ['ko', 'en']) {
  for (const status of ['current', 'available', 'downloading', 'ready', 'error']) {
   await page.evaluate(({ language, status }) => window.receiveSettings({ language, opacity: .95, update: { currentVersion: '0.1.6', version: '0.1.7', percent: 42, automatic: false, status, canRestart: false } }), { language, status });
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
   assert.equal(await page.locator('#opacity').getAttribute('max'), '100');
   if (status === 'ready') { assert.equal(await page.locator('#restart').isDisabled(), true); assert.equal(await page.locator('#blocked').isVisible(), true); }
   if (language === 'en') assert.doesNotMatch(await page.locator('body').innerText(), /[가-힣]/);
   if (status === 'current') {
    const captures = path.resolve(__dirname, '../../../output/playwright'); fs.mkdirSync(captures, { recursive: true });
    await page.screenshot({ path: path.join(captures, `app-1567-settings-${language}.png`), fullPage: true });
   }
  }
 }
});
