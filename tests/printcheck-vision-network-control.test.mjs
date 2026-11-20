// M3.32: deterministic network control on synthetically supplied GET results.
// No real DNS, cookies, customer data or LAN requests.
import assert from 'node:assert/strict';
import test from 'node:test';
import {controlledOrderProbe,freshNetworkHealth,normalizeNetworkHealth,
 NETWORK_CIRCUIT_LIMIT} from '../vision/orders/approval-network-control.mjs';

const now=()=> '2026-11-20T08:00:00.000Z';
test('direct GET 404 and unchecked orders are not network errors',async()=>{
 let calls=0;
 let h=freshNetworkHealth();
 for(const status of ['ORDER_NOT_FOUND','TZ_NOT_APPROVED','TZ_APPROVED']){
  const r=await controlledOrderProbe(3200000,async()=>{
   calls++;return {status}}, {health:h,now,sleep:async()=>{}});
  assert.equal(r.halt,false);h=r.health;
 }
 assert.equal(calls,3);
 assert.equal(h.attempts,3);assert.equal(h.retries,0);
 assert.equal(h.consecutive_errors,0);assert.equal(h.state,'online');
});
test('HTTP 503 retries with finite backoff and persists recovered status',async()=>{
 const seen=[],out=[
  {status:'MANUAL_ORDER_HTTP_STATUS',http_status:503},
  {status:'MANUAL_ORDER_FETCH_FAILED'},
  {status:'TZ_APPROVED'}
 ];
 const r=await controlledOrderProbe(3200000,async()=>out.shift(),{
  now,sleep:async ms=>seen.push(ms)
 });
 assert.equal(r.result.status,'TZ_APPROVED');
 assert.deepEqual(seen,[400,800]);
 assert.equal(r.health.retries,2);
 assert.equal(r.health.attempts,3);
 assert.equal(r.health.consecutive_errors,0);
 assert.equal(r.health.last_success_at,now());
});
test('six consecutive transient failures open circuit instead of skipping entire queue',async()=>{
 let health=freshNetworkHealth();
 for(let i=1;i<=NETWORK_CIRCUIT_LIMIT;i++){
  const r=await controlledOrderProbe(3200000+i,
   async()=>({status:'MANUAL_ORDER_FETCH_FAILED'}),
   {health,sleep:async()=>{},now});
  health=r.health;
  assert.equal(r.halt,i===NETWORK_CIRCUIT_LIMIT);
 }
 assert.equal(health.consecutive_errors,6);
 assert.equal(health.transient_errors,6);
 assert.equal(health.attempts,6*4);
 assert.equal(health.retries,6*3);
 assert.equal(health.state,'circuit_open');
 const resume=await controlledOrderProbe(3200010,
  async()=>({status:'ORDER_NOT_FOUND'}),{health,now});
 assert.equal(resume.health.state,'online');
 assert.equal(resume.health.consecutive_errors,0);
});
test('auth and 429 halt immediately without retry or exposing HTML',async()=>{
 for(const [status,expected] of [
  ['MANUAL_ORDER_AUTH_REQUIRED','VISION_NETWORK_AUTH_REQUIRED'],
  ['MANUAL_ORDER_RATE_LIMITED','VISION_NETWORK_RATE_LIMITED']
 ]){
  let requests=0;
  const r=await controlledOrderProbe(3200000,async()=>{
   requests++;return {status,http_status:status.includes('AUTH')?403:429}
  },{sleep:async()=>{},now});
  assert.equal(r.halt,true);
  assert.equal(r.reason,expected);
  assert.equal(requests,1);
  assert.equal(r.health.retries,0);
 }
});
test('network metrics deserialize safely and reject invalid large counters',()=>{
 const restored=normalizeNetworkHealth({
  attempts:12,retries:2,transient_errors:-4,consecutive_errors:3,
  state:'degraded',last_error:'MANUAL_ORDER_FETCH_FAILED',
  last_http_status:503
 });
 assert.equal(restored.attempts,12);
 assert.equal(restored.transient_errors,0);
 assert.equal(restored.last_http_status,503);
 assert.equal(restored.state,'degraded');
});
