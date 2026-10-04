import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.webp':'image/webp'};
http.createServer(async(req,res)=>{try{let uri=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const target=path.resolve(root,'.'+(uri==='/'?'/index.html':uri));if(!target.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const body=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).listen(5182,'127.0.0.1',()=>console.log('Levuzo preview ready: http://127.0.0.1:5182'));
