import {readFileSync,writeFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const dist=resolve(root,"dist");
let html=readFileSync(resolve(dist,"index.html"),"utf8");
const script=/<script type="module"[^>]* src="([^"]+)"[^>]*><\/script>/;
const css=/<link rel="stylesheet"[^>]* href="([^"]+)"[^>]*\/?\s*>/;
const js=html.match(script);
const sheet=html.match(css);
if(!js||!sheet)throw new Error("Expected exactly one Vite JS and CSS asset");
function asset(path,extension){
  if(!new RegExp("^\\./assets/[A-Za-z0-9_-]+\\."+extension+"$").test(path))
    throw new Error("Unexpected bundle asset path");
  return readFileSync(resolve(dist,path.slice(2)),"utf8");
}
const javascript=asset(js[1],"js").replace(/<\/script/gi,"<\\/script");
const stylesheet=asset(sheet[1],"css").replace(/<\/style/gi,"<\\/style");
// Callback replacements preserve literal dollar-token sequences in minified React.
// A string replacement would expand its contents and corrupt the HTML.
html=html.replace(js[0],()=>"<script type=\"module\">"+javascript+"</script>")
  .replace(sheet[0],()=>"<style>"+stylesheet+"</style>");
// Never scan inside the inlined JS/CSS: React's own runtime may contain
// markup-like string fragments which are not actual external asset tags.
const withoutInline=html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"");
if(/<script[^>]+src=|<link[^>]+href=|<iframe\b/i.test(withoutInline))
  throw new Error("Standalone preview still references external assets");
writeFileSync(resolve(dist,"preview.html"),html,"utf8");
process.stdout.write("WEB_CANDIDATE_STANDALONE_PREVIEW_GENERATED\n");
