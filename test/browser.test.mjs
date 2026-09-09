import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { capture, verifyOutcome } from "../dist/browser.js";
test("real browser fixture captures controls and distinguishes receipt from mere navigation",async()=>{
 const browser=await chromium.launch({headless:true});
 try{
 const page=await browser.newPage();
 await page.setContent('<main><h1>Confirm and pay</h1><p>Total AUD 500</p><button>Confirm and pay</button><input aria-label="First name"><input type="password" aria-label="Password"></main>');
 const snap=await capture(page);
 assert.ok(snap.text.includes("AUD 500"));
 assert.ok(snap.controls.some(c=>c.label==="Confirm and pay"));
 assert.ok(!snap.controls.some(c=>c.label==="Password"));
 assert.equal((await verifyOutcome(page,"book",snap)).status,"unknown_outcome");
 await page.setContent('<main><h1>Reservation confirmed</h1><div data-testid="confirmation-code">HM12345678</div></main>');
 assert.equal((await verifyOutcome(page,"book",snap)).status,"verified");
 await page.setContent('<main><h1>Something went wrong</h1></main>');
 assert.equal((await verifyOutcome(page,"cancel",snap)).status,"unknown_outcome");
 await page.setContent('<main><h1>Your reservation is cancelled</h1></main>');
 assert.equal((await verifyOutcome(page,"cancel",snap)).status,"verified");
 } finally{await browser.close();}
});
