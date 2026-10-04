import {copyFile,mkdir} from 'node:fs/promises';
import {build} from 'esbuild';
await mkdir('dist/vendor',{recursive:true});
await copyFile('node_modules/gsap/dist/gsap.min.js','dist/vendor/gsap.min.js');
await copyFile('node_modules/gsap/README.md','dist/vendor/GSAP-README.txt');
await build({entryPoints:['src/orbit-hero.js'],outfile:'dist/orbit-hero.js',bundle:true,format:'esm',minify:true,target:['es2022'],legalComments:'external'});
await copyFile('node_modules/three/LICENSE','dist/vendor/THREE-LICENSE.txt');
console.log('Bundled 3D hero and local animation runtime. Static site built in dist.');
