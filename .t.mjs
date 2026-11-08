import { chromium } from "@playwright/test";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 740 } });
p.on("console", m => m.type()==="error" && console.log("CONSOLE", m.text().slice(0,200)));
const B="http://localhost:3999";
await p.goto(B+"/delhi"); await p.click('button:has-text("Map")'); await p.waitForTimeout(4000);
console.log("pins", await p.$$eval(".maplibregl-marker", m=>m.slice(0,2).map(x=>x.outerHTML.slice(0,260))));
console.log("attrib", await p.$$eval(".maplibregl-ctrl-attrib", m=>m.map(x=>x.className)));
// focus clipping on toggle
await p.focus('button:has-text("List")');
await p.keyboard.press("Tab"); await p.keyboard.press("Shift+Tab");
const st = await p.evaluate(()=>{const e=document.activeElement; const cs=getComputedStyle(e); const par=getComputedStyle(e.parentElement); return {tag:e.textContent, outline:cs.outlineStyle+" "+cs.outlineWidth+" off "+cs.outlineOffset, parentOverflow: par.overflow}});
console.log("focus", JSON.stringify(st));
await p.locator('div[role=group][aria-label=View]').screenshot({path:"/tmp/toggle-focus.png"});
await p.goto(B+"/"); 
const dl = p.locator('nav[aria-label^="Dishes"] a').first(); await dl.focus(); await p.keyboard.press("Tab"); await p.keyboard.press("Shift+Tab");
await p.locator('nav[aria-label^="Dishes"]').first().screenshot({path:"/tmp/dishrow-focus.png"});
await b.close();
