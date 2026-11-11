const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const { pathToFileURL } = require('node:url');
function fixture(t) {
 let window, handler; const actions=[];
 class Window extends EventEmitter {
  constructor(options) { super(); window=this; this.options=options; this.webContents=new EventEmitter(); Object.assign(this.webContents,{ mainFrame:{url:''},send(){},setWindowOpenHandler:f=>this.open=f,session:{setPermissionRequestHandler:f=>this.permission=f,setPermissionCheckHandler:f=>this.check=f,webRequest:{onBeforeRequest:f=>this.request=f}} }); }
  async loadFile(file) { this.webContents.mainFrame.url=pathToFileURL(file).href; }
  isDestroyed(){return this.destroyed===true;} show(){} focus(){} setTitle(){} setVisibleOnAllWorkspaces(){} destroy(){this.destroyed=true; this.emit('closed');}
 }
 const filename=path.resolve(__dirname,'../dist/desktop-preferences.js'),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,__dirname:path.dirname(filename),process,require:name=>name==='electron'?{BrowserWindow:Window,ipcMain:{handle:(_key,f)=>handler=f,removeHandler(){handler=null;}}}:name.startsWith('.')?require(path.resolve(path.dirname(filename),name)):require(name)});
 const controller=module.exports.createDesktopPreferences({read:()=>({language:'ko',opacity:1,update:{currentVersion:'0.1.5',automatic:true,status:'current',canRestart:false}}),action:async value=>actions.push(value)}); controller.show();
 t.after(()=>controller.dispose());
 return { controller,get window(){return window;},actions,invoke:(payload,event={sender:window.webContents,senderFrame:window.webContents.mainFrame})=>handler(event,payload) };
}
test('native settings are local-only and accept only bounded fixed preference actions',async t=>{
 const f=fixture(t); await Promise.resolve();
 assert.equal((await f.invoke('read')).opacity,1);
 await assert.rejects(f.invoke('read',{sender:{},senderFrame:f.window.webContents.mainFrame}),/UNTRUSTED/);
 await assert.rejects(f.invoke('read',{sender:f.window.webContents,senderFrame:{url:'https://heymoa.app'}}),/UNTRUSTED/);
 for(const value of [{action:'opacity',value:.1},{action:'opacity',value:NaN},{action:'opacity',value:.8,url:'https://evil.test'},{action:'automatic',value:'true'},'delete']) await assert.rejects(f.invoke(value),/INVALID/);
 await f.invoke({action:'opacity',value:.2}); await f.invoke({action:'automatic',value:false}); await f.invoke('check'); await f.invoke('restart');
 assert.equal(f.actions.length,4);
 assert.equal(f.window.options.webPreferences.sandbox,true); assert.equal(f.window.options.webPreferences.nodeIntegration,false);
 assert.equal(f.window.check(),false); let cancel; f.window.request({url:'https://heymoa.app'},value=>cancel=value.cancel); assert.equal(cancel,true); assert.equal(f.window.open().action,'deny');
});
