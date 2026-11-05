import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {pathToFileURL} from "node:url";

test("Preview loading icons visibly rotate in a real browser",{skip:!process.env.OFFICE_PREVIEW_TEST_BROWSER,timeout:30000},async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),"preview-animation-"));
  let browser,socket;
  try{
    const office=await fs.readFile(new URL("../app/office-document-preview.tsx",import.meta.url),"utf8");
    const session=await fs.readFile(new URL("../app/v2/document-preview-session.tsx",import.meta.url),"utf8");
    const css=await fs.readFile(new URL("../app/v2/work-view-v2.css",import.meta.url),"utf8");
    const classes=[office,session].map(source=>{
      const match=source.match(/<RefreshCw size=\{24\} className="([^"]+)" aria-hidden="true"/);
      assert.ok(match,"Both loading stages must specify the shared spinner");
      return match[1];
    });
    const html=path.join(directory,"spinner.html");
    await fs.writeFile(html,'<!doctype html><style>'+css+'</style>'+classes.map((name,index)=>'<svg id="icon'+index+'" class="'+name+'" width="24" height="24" viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15-6L21 3v7h-7l3-3" fill="none" stroke="black"/></svg>').join(""));
    browser=spawn(process.env.OFFICE_PREVIEW_TEST_BROWSER,["--headless","--no-sandbox","--disable-dev-shm-usage","--no-first-run","--remote-debugging-port=0","--user-data-dir="+path.join(directory,"profile"),"about:blank"],{stdio:["ignore","ignore","pipe"]});
    const endpoint=await new Promise((resolve,reject)=>{
      let output="";const timeout=setTimeout(()=>reject(new Error("Browser startup timed out: "+output.slice(-1000))),12000);
      browser.once("error",error=>{clearTimeout(timeout);reject(error)});
      browser.once("exit",code=>{clearTimeout(timeout);reject(new Error("Browser exited: "+code+" "+output.slice(-1000)))});
      browser.stderr.on("data",chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timeout);resolve(match[1])}});
    });
    socket=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true})});
    let sequence=0;const pending=new Map();
    socket.addEventListener("message",event=>{const message=JSON.parse(event.data);const job=pending.get(message.id);if(job){pending.delete(message.id);message.error?job.reject(new Error(JSON.stringify(message.error))):job.resolve(message.result)}});
    const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}))});
    const {targetId}=await send("Target.createTarget",{url:pathToFileURL(html).href});
    const {sessionId}=await send("Target.attachToTarget",{targetId,flatten:true});
    const snapshot=async()=>{
      const result=await send("Runtime.evaluate",{expression:'JSON.stringify([0,1].map(i=>{const e=document.getElementById("icon"+i);if(!e)return null;const s=getComputedStyle(e);return {name:s.animationName,play:s.animationPlayState,transform:s.transform}}))',returnByValue:true},sessionId);
      return result.result.value?JSON.parse(result.result.value):null;
    };
    let before;
    for(let attempt=0;attempt<30;attempt++){before=await snapshot();if(before?.every(Boolean))break;await new Promise(resolve=>setTimeout(resolve,100))}
    assert.ok(before?.every(Boolean),"Loading SVGs must be rendered");
    await new Promise(resolve=>setTimeout(resolve,350));
    const after=await snapshot();
    for(let index=0;index<2;index++){
      assert.equal(after[index].name,"wv2-spin");
      assert.equal(after[index].play,"running");
      assert.notEqual(after[index].transform,"none");
      assert.notEqual(before[index].transform,after[index].transform,"The actual rotation matrix must change");
    }
  }finally{
    socket?.close();
    if(browser&&browser.exitCode===null){browser.kill();await new Promise(resolve=>{browser.once("exit",resolve);setTimeout(resolve,2000)})}
    const target=path.resolve(directory),root=path.resolve(os.tmpdir());
    assert.ok(target.startsWith(root+path.sep));
    await fs.rm(target,{recursive:true,force:true});
  }
});
