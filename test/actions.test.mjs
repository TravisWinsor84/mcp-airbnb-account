import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ActionStore, allowedUrl, sensitiveField } from "../dist/actions.js";
test("URL validation rejects lookalikes, credentials and non-HTTPS",()=>{
 for(const url of ["https://airbnb.com.evil.test/","https://evilairbnb.com","http://www.airbnb.com","https://me:secret@www.airbnb.com"]) assert.throws(()=>allowedUrl(url));
 assert.equal(allowedUrl("https://www.airbnb.com.au/trips").pathname,"/trips");
});
test("credentials and payment fields remain manual",()=>{
 for(const label of ["Password","Card number","CVV","One-time code","Verification code"]) assert.equal(sensitiveField(label),true);
 assert.equal(sensitiveField("First name"),false);
});
test("preview tokens are bound, expire, consume before side effect, and survive restart",()=>{
 const dir=mkdtempSync(join(tmpdir(),"airbnb-action-test-"));
 try {
  let store=new ActionStore(dir,()=>1000);
  const p=store.prepare({kind:"message",summary:"Hello",fingerprint:"a",target:1});
  assert.throws(()=>store.consume(p.token,"b"),/changed/);
  store.consume(p.token,"a");
  store=new ActionStore(dir,()=>1001);
  assert.throws(()=>store.consume(p.token,"a"),/consumed/);
  const q=store.prepare({kind:"book",summary:"exact review",fingerprint:"a",target:2});
  store=new ActionStore(dir,()=>999999);
  assert.throws(()=>store.consume(q.token,"a"),/expired/);
 }finally {rmSync(dir,{recursive:true,force:true});}
});
