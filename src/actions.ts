import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, lstatSync } from "node:fs";
import { join } from "node:path";
export const domains = new Set(["www.airbnb.com","www.airbnb.com.au","www.airbnb.co.uk","www.airbnb.ca","www.airbnb.co.nz","www.airbnb.fr","www.airbnb.de","www.airbnb.es","www.airbnb.it"]);
export function allowedUrl(value: string): URL {
  const u = new URL(value);
  if (u.protocol !== "https:" || !domains.has(u.hostname) || u.port || u.username || u.password) throw new Error("Only supported HTTPS Airbnb country domains are allowed");
  return u;
}
export function sensitiveField(label: string): boolean {
  return /password|passcode|verification|one.?time|otp|card.?number|security.?code|cvv|cvc|expiry|expiration|bank|routing|iban|passport|identity|tax.?id|social.?security/i.test(label);
}
export function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
export function privateDir(dir: string): void {
  mkdirSync(dir,{recursive:true,mode:0o700});
  if (lstatSync(dir).isSymbolicLink()) throw new Error("Session directory must not be a symbolic link");
  chmodSync(dir,0o700);
}
export type Kind = "navigate" | "wishlist" | "message" | "book" | "cancel" | "account_update";
export interface Pending {kind: Kind; summary: string; fingerprint: string; target: number;}
// Disk stores only a token tombstone, never a page, message, cookie or account value.
// Pending actions are deliberately process-local: restarting invalidates previews.
export class ActionStore {
  private pending = new Map<string, Pending & {expires: number}>();
  constructor(private dir: string, private now = Date.now) { privateDir(dir); }
  prepare(action: Pending) {
    const token=randomUUID(), expires=this.now()+5*60*1000;
    this.pending.set(token,{...action,expires});
    return {token,expiresAt:new Date(expires).toISOString(),summary:action.summary};
  }
  consume(token: string, current: string) {
    if (!/^[0-9a-f-]{36}$/.test(token)) throw new Error("Invalid preview token");
    const file=join(this.dir,token+".json");
    if (existsSync(file)) throw new Error("Action already consumed; inspect outcome, do not retry");
    const action=this.pending.get(token);
    if (!action) throw new Error("Preview expired or server restarted; prepare again");
    if (this.now()>action.expires) {this.pending.delete(token);throw new Error("Preview expired");}
    if (action.fingerprint!==current) throw new Error("Page changed; prepare a fresh preview");
    writeFileSync(file,JSON.stringify({status:"attempted",at:this.now()}),{mode:0o600,flag:"wx"});
    this.pending.delete(token);
    return action;
  }
  invalidate() { this.pending.clear(); }
}
