const assert = require('node:assert/strict');
const {WebSocket} = require('./browser-worker/node_modules/ws');
const base = 'http://localhost:5173';
(async()=>{
  const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});
  const cookie=login.headers.get('set-cookie')?.split(';')[0];
  assert(cookie,'Local development sign-in must be available');
  const headers={Cookie:cookie,Origin:base,'Content-Type':'application/json'};
  async function request(path,body){
    const r=await fetch(base+path,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});
    const d=await r.json();assert(r.ok,d.error);return d;
  }
  assert.equal((await request('/api/browser')).browser,'connected');
  let sid;
  try{
    sid=(await request('/api/browser',{operation:'create',data:{private:true}})).session.id;
    const action=(operation,data={})=>request('/api/browser',{operation,sessionId:sid,data});
    await action('navigate',{url:'https://example.com',actor:'user'});
    const page=(await action('snapshot')).page;
    assert.equal(new URL(page.url).hostname,'example.com');
    assert(page.text.length>0,'The loaded page must have readable content');
    const streams=await request('/api/browser?sessionId='+sid);
    await Promise.all(['view','events'].map(channel=>new Promise((resolve,reject)=>{
      const ws=new WebSocket(streams[channel==='view'?'viewUrl':'eventsUrl'],{origin:base});
      const timeout=setTimeout(()=>{ws.terminate();reject(Error(channel+' timed out'));},10000);
      ws.on('error',e=>{clearTimeout(timeout);reject(e)});
      ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type===(channel==='view'?'frame':'session')){
        if(channel==='view')assert(m.data.length>100);
        clearTimeout(timeout);ws.close();resolve();
      }});
    })));
    await action('newTab',{actor:'user'});
    const state=await request('/api/browser?sessionId='+sid);
    assert.equal(state.session.tabs.length,2);
    console.log('Passed: local sign-in, health, session creation, public navigation, DOM snapshot, live JPEG frames, events, and tabs.');
  }finally{if(sid)await request('/api/browser',{operation:'close',sessionId:sid});}
})().catch(e=>{console.error(e);process.exitCode=1;});
