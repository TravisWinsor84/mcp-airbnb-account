import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createInterface } from "node:readline";
const client=new Client({name:"account-local-smoke",version:"1.0"});
await client.connect(new StdioClientTransport({command:process.execPath,args:["dist/index.js"],stderr:"inherit"}));
console.log(JSON.stringify({tools:(await client.listTools()).tools.map(t=>t.name)}));
if(process.argv.includes("--login")) {
 console.log(JSON.stringify(await client.callTool({name:"airbnb_account_login",arguments:{}})));
 console.log("Browser remains open. Enter status, observe, trips, wishlists, or quit.");
 for await(const line of createInterface({input:process.stdin})) {
   const command=line.trim();
   if(command==="quit")break;
   const name=command==="status"?"airbnb_account_status":command==="observe"?"airbnb_account_observe":"airbnb_account_open";
   console.log(JSON.stringify(await client.callTool({name,arguments:name==="airbnb_account_open"?{section:command}:{}})));
 }
}
await client.close();
