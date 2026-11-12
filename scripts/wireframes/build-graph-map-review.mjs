// Isolated design review build. Reads installed dependencies without editing the Docsa source tree.
import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';import{createRequire}from'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const modules=process.env.GRAPH_REVIEW_MODULES||path.resolve(root,'../Docsa_FE/frontend/node_modules');
const require=createRequire(import.meta.url),esbuild=require(require.resolve('esbuild',{paths:[modules]}));
const output=path.join(root,'_workspace/2026-11-10-graph-map');fs.mkdirSync(output,{recursive:true});
esbuild.buildSync({entryPoints:[path.join(root,'scripts/wireframes/graph-map-preview.jsx')],bundle:true,outfile:path.join(output,'app.js'),nodePaths:[modules],loader:{'.css':'css','.svg':'text'},define:{'process.env.NODE_ENV':'"production"'},minify:true});
fs.copyFileSync(path.join(root,'scripts/wireframes/graph-map-preview.html'),path.join(output,'index.html'));
console.log(output);
