import { writeFileSync, existsSync } from "node:fs";
const root=new URL("../apps/site/dist/",import.meta.url);
if(!existsSync(new URL("index.html",root)))throw new Error("Build the Astro site first.");
writeFileSync(new URL("vercel.json",root),JSON.stringify({framework:null,buildCommand:"",installCommand:"",outputDirectory:"."},null,2)+"\n");
writeFileSync(new URL(".vercelignore",root),".vercel\n");
console.log("Static deployment prepared in apps/site/dist. Link it to the separate site project before deploying.");
