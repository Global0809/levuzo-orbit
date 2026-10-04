import {readFile,stat,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const html=await readFile('dist/index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const match of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(match[1]),`Missing anchor ${match[1]}`);
const assets=new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(p=>!p.startsWith('#')&&!/^(https?:|data:)/.test(p)));
for(const asset of assets)assert.ok((await stat(`dist/${asset.replace(/^\//,'')}`)).isFile(),`Missing ${asset}`);
assert.ok(!/<input[^>]+(?:card|cc-number|cvc|cvv)/i.test(html),'No raw card collection');
assert.ok(!/juken|blue planet|only 23|countdown/i.test(html),'No old-brand or fabricated scarcity');
assert.equal((html.match(/<h1[\s>]/g)||[]).length,1);
assert.ok(!/<(?:img|picture)\b/i.test(html),'Product presentation must use live 3D only');
assert.equal((html.match(/data-orbit-scene=/g)||[]).length,4,'Four live product scenes');
assert.ok(!/id="(?:orbit-field|movement)"|href="#(?:orbit-field|movement)"/.test(html),'Removed third scene has no dead links');
for(const filename of ['app.js','checkout.js','motion.js']){
  assert.ok(!/<img\b|media\/[^'"`]+\.(?:png|jpg|webp)/i.test(await readFile(`dist/${filename}`,'utf8')),`No dynamic photos in ${filename}`);
}
const publishedFiles=await readdir('dist',{recursive:true});
assert.ok(!publishedFiles.some(file=>/\.(?:png|jpe?g|webp|gif|avif)$/i.test(file)),'No raster photo assets in the published site');
const sandbox={window:{}};vm.runInNewContext(await readFile('dist/checkout-config.js','utf8'),sandbox);
const config=sandbox.window.LevuzoCheckoutConfig;
assert.equal(config.enabled,false,'Checkout must remain disabled until a real merchant link is supplied');
assert.deepEqual(Object.keys(config.links),[]);
const app=await readFile('dist/app.js','utf8');
assert.ok(app.includes('price:249,standard:999'));
assert.ok(app.includes("['Aluminum'].includes(item.material)&&['Blue light'].includes(item.size)"));
const themeBaseline=JSON.parse(await readFile('scripts/theme-baseline.json','utf8'));
for(const [file,hash] of Object.entries(themeBaseline)){
  assert.equal(createHash('sha256').update(await readFile(`dist/${file}`)).digest('hex'),hash,`${file} must preserve the original theme exactly`);
}
console.log(`Verified ${assets.size} local resources, anchors, four 3D scenes, $249/$999 pricing, disabled checkout and five unchanged theme stylesheets.`);
