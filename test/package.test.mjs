import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
test("skill package has a self-contained entrypoint and metadata",()=>{
 const root="skills/airbnb-account-management/";
 const skill=readFileSync(root+"SKILL.md","utf8");
 assert.match(skill,/^---\nname: airbnb-account-management\ndescription: .+\n---/);
 assert.ok(existsSync(root+"agents/openai.yaml"));
 for(const match of skill.matchAll(/\]\(([^)]+)\)/g)) if(!match[1].includes("://"))assert.ok(existsSync(root+match[1]),match[1]);
 const p=JSON.parse(readFileSync("package.json","utf8"));
 assert.equal(Object.keys(p.dependencies??{}).length,0);
});
