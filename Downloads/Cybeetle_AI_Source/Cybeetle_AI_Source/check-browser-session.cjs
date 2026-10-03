const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/browser-shell.js', 'utf8');
const lifecycle = source.slice(source.indexOf('let sessionCreation='), source.indexOf('\nfunction showBrowserError'));
let creates = 0, checks = 0;
const sockets = [], timers = new Map();
const context = vm.createContext({
  session: null, connection: 'connecting', privateMode: true, streamTimer: null,
  frameSocket: null, eventSocket: null,
  renderBrowser() {}, showBrowserError() {},
  checkConnection: async () => { checks++; context.connection = 'connected'; },
  browser: async () => { creates++; await new Promise(resolve => setImmediate(resolve)); return {session:{id:'test'}}; },
  api: async () => ({session:{id:'test'},viewUrl:'ws://localhost/view',eventsUrl:'ws://localhost/events'}),
  setTimeout: (fn, ms) => { const id = Symbol(); timers.set(id,{fn,ms}); return id; },
  clearTimeout: id => timers.delete(id),
  WebSocket: class { constructor(url) { this.url=url; sockets.push(this); } close(){this.closed=true;this.onclose?.();} },
});
vm.runInContext(lifecycle, context);
(async () => {
  await Promise.all([context.SessionManager(),context.SessionManager()]);
  assert.equal(creates,1,'Concurrent actions must share session creation');
  assert.equal(checks,1,'Initial connection is checked before creation');
  assert.equal(sockets.length,2);
  sockets[0].onclose();
  assert.equal(context.connection,'error');
  assert(sockets.every(s => s.closed),'Both old streams must close');
  const retry=[...timers.values()].find(t=>t.ms===2000);
  assert(retry,'Unexpected closure schedules reconnection');
  await retry.fn();
  assert.equal(sockets.length,4);
  sockets[2].onopen();
  assert.equal(context.connection,'connected');
  context.disconnectStreams();
  assert.equal(timers.size,0,'Intentional shutdown must cancel reconnection');
  console.log('Passed: concurrent session creation, connection readiness, stream reconnect and intentional shutdown.');
})().catch(e=>{console.error(e);process.exitCode=1;});
