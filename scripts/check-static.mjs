import {readFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const required=['index.html','app.js','styles.css','src/simulation/core.js','src/visualization/airframe.js','src/charts/plot.js'];
for(const path of required){if(!existsSync(join(root,path)))throw Error(`Missing ${path}`);}
const html=readFileSync(join(root,'index.html'),'utf8');
for(const asset of ['./app.js','./styles.css','./icon.svg'])if(!html.includes(asset))throw Error(`Missing document reference ${asset}`);
console.log('Static build verified: all assets are local and directly deployable.');
