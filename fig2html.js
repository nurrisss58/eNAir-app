// Figma .fig (canvas.fig) -> HTML + CSS converter
const fs=require('fs'),path=require('path');
const kiwi=require('kiwi-schema'),fzstd=require('fzstd'),pako=require('pako');
const [,, canvasPath, imagesDir, outDir, pageName='Page 1']=process.argv;
const buf=fs.readFileSync(canvasPath);
let off=12;const chunks=[];
while(off<buf.length){const len=buf.readUInt32LE(off);off+=4;chunks.push(buf.slice(off,off+len));off+=len;}
const inf=c=>{try{return pako.inflateRaw(c)}catch(e){return fzstd.decompress(c)}};
const msg=kiwi.compileSchema(kiwi.decodeBinarySchema(inf(chunks[0]))).decodeMessage(inf(chunks[1]));
const nodes=msg.nodeChanges,blobs=msg.blobs;
const id=g=>g.sessionID+':'+g.localID;
const by={},kids={};
for(const n of nodes){by[id(n.guid)]=n;if(n.parentIndex)(kids[id(n.parentIndex.guid)]??=[]).push(n);}
for(const k in kids)kids[k].sort((a,b)=>a.parentIndex.position<b.parentIndex.position?-1:1);
const doc=nodes.find(n=>n.type==='DOCUMENT');
const page=(kids[id(doc.guid)]||[]).find(p=>p.name===pageName);
fs.mkdirSync(path.join(outDir,'images'),{recursive:true});

const f=n=>+(+n).toFixed(2);
const hex=u=>Buffer.from(u).toString('hex');
const rgba=(c,o=1)=>{const a=f((c.a??1)*o);return a>=1?`#${[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('')}`:`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${a})`};
const W={Thin:100,ExtraLight:200,Light:300,Regular:400,Medium:500,SemiBold:600,Bold:700,ExtraBold:800,Black:900};
const fonts=new Set();
const usedImages=new Set();
const slug=s=>(s||'node').toLowerCase().replace(/[^a-z0-9а-я]+/g,'-').replace(/^-|-$/g,'').slice(0,28)||'node';

function imgExt(h){const p=path.join(imagesDir,h);if(!fs.existsSync(p))return null;const b=fs.readFileSync(p).slice(0,12);
 let e='bin';if(b[0]===0x89&&b[1]===0x50)e='png';else if(b[0]===0xff&&b[1]===0xd8)e='jpg';else if(b.slice(0,4).toString()==='RIFF')e='webp';else if(b.slice(0,3).toString()==='GIF')e='gif';
 const dst=`images/${h}.${e}`;if(!usedImages.has(h)){fs.copyFileSync(p,path.join(outDir,dst));usedImages.add(h);}return dst;}

function gradient(p){const t=p.transform;const det=t.m00*t.m11-t.m01*t.m10;
 const inv=(gx,gy)=>{const x=(t.m11*(gx-t.m02)-t.m01*(gy-t.m12))/det,y=(-t.m10*(gx-t.m02)+t.m00*(gy-t.m12))/det;return[x,y]};
 const s=inv(0,.5),e=inv(1,.5);return{s,e,stops:p.stops};}
function paintCss(p,node){ // -> css background layer
 if(p.visible===false)return null;
 if(p.type==='SOLID'){const c=rgba(p.color,p.opacity);return{solid:c,layer:`linear-gradient(${c},${c})`};}
 if(p.type==='GRADIENT_LINEAR'){const g=gradient(p),w=node.size?.x||1,h=node.size?.y||1;
  const dx=(g.e[0]-g.s[0])*w,dy=(g.e[1]-g.s[1])*h;const ang=f(Math.atan2(dx,-dy)*180/Math.PI);
  return{layer:`linear-gradient(${ang}deg, ${g.stops.map(s=>rgba(s.color,p.opacity)+' '+f(s.position*100)+'%').join(', ')})`};}
 if(p.type==='IMAGE'){const h=hex(p.image.hash),src=imgExt(h);if(!src)return null;
  const m=p.imageScaleMode;const size=m==='FIT'?'contain':m==='STRETCH'?'100% 100%':m==='TILE'?'auto':'cover';
  return{layer:`url("${src}") center / ${size} ${m==='TILE'?'repeat':'no-repeat'}`};}
 return null;}

function blobPath(i){const b=blobs[i]?.bytes;if(!b)return'';const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);let o=0,d='';
 const fl=()=>{const v=dv.getFloat32(o,true);o+=4;return f(v)};
 while(o<b.length){const c=b[o++];if(c===0)d+='Z';else if(c===1)d+=`M${fl()} ${fl()}`;else if(c===2)d+=`L${fl()} ${fl()}`;
  else if(c===4)d+=`C${fl()} ${fl()} ${fl()} ${fl()} ${fl()} ${fl()}`;else if(c===3)d+=`Q${fl()} ${fl()} ${fl()} ${fl()}`;else break;}return d;}

let css=[];let counter=0;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function effects(n,st){const sh=[];let bf=null,fl=null;
 for(const e of n.effects||[]){if(e.visible===false)continue;
  if(e.type==='DROP_SHADOW'||e.type==='INNER_SHADOW')sh.push(`${e.type==='INNER_SHADOW'?'inset ':''}${f(e.offset.x)}px ${f(e.offset.y)}px ${f(e.radius)}px ${f(e.spread||0)}px ${rgba(e.color)}`);
  else if(e.type==='BACKGROUND_BLUR')bf=`blur(${f(e.radius/2)}px)`;else if(e.type==='LAYER_BLUR')fl=`blur(${f(e.radius/2)}px)`;}
 return{sh,bf,fl};}

function nodeToHtml(n,parent,depth){
 if(n.visible===false)return'';
 const cls=slug(n.name)+'-'+(++counter);const st=[];const pad='  '.repeat(depth);
 const pAuto=parent&&parent.stackMode&&parent.stackMode!=='NONE';
 const absolute=!pAuto||n.stackPositioning==='ABSOLUTE';
 const t=n.transform,rot=Math.abs(t.m01)>1e-3||Math.abs(t.m00-1)>1e-3;
 const w=n.size?.x,h=n.size?.y;
 let hugW=false,hugH=false,growW=false,growH=false,stretchW=false,stretchH=false;
 const isStack=n.stackMode&&n.stackMode!=='NONE',horiz=n.stackMode==='HORIZONTAL';
 if(n.type==='FRAME'&&isStack){const hug=v=>v&&v.startsWith('RESIZE_TO_FIT');
  if(horiz){hugW=hug(n.stackPrimarySizing);hugH=hug(n.stackCounterSizing);}else{hugH=hug(n.stackPrimarySizing);hugW=hug(n.stackCounterSizing);}}
 if(n.type==='TEXT'){const a=n.textAutoResize;if(a==='WIDTH_AND_HEIGHT'){hugW=hugH=true}else if(a==='HEIGHT'){hugH=true}}
 if(pAuto&&!absolute){const phor=parent.stackMode==='HORIZONTAL';
  if(n.stackChildPrimaryGrow>0){phor?growW=true:growH=true}
  if(n.stackChildAlignSelf==='STRETCH'){phor?stretchH=true:stretchW=true}}
 // position
 if(absolute){st.push('position:absolute',`left:${f(t.m02)}px`,`top:${f(t.m12)}px`);}
 else st.push('position:relative');
 if(rot){st.push(`transform:matrix(${f(t.m00)},${f(t.m10)},${f(t.m01)},${f(t.m11)},0,0)`,'transform-origin:0 0');}
 const noW=hugW||growW||stretchW,noH=hugH||growH||stretchH;
 if(n.type!=='LINE'){ if(!noW&&w!=null)st.push(`width:${f(w)}px`); if(!noH&&h!=null)st.push(`height:${f(h)}px`);}
 else st.push(`width:${f(w)}px`);
 if(growW)st.push('flex:1 1 0','min-width:0');if(growH)st.push('flex:1 1 0','min-height:0');
 if(stretchW||stretchH)st.push('align-self:stretch');
 if(pAuto&&!absolute&&!growW&&!growH)st.push('flex-shrink:0');
 if(n.opacity!=null&&n.opacity<1)st.push(`opacity:${f(n.opacity)}`);
 // radius
 const r=[n.rectangleTopLeftCornerRadius,n.rectangleTopRightCornerRadius,n.rectangleBottomRightCornerRadius,n.rectangleBottomLeftCornerRadius].map(v=>v??n.cornerRadius??0);
 if(n.type==='ELLIPSE')st.push('border-radius:50%');
 else if(r.some(v=>v))st.push(r.every(v=>v===r[0])?`border-radius:${f(r[0])}px`:`border-radius:${r.map(v=>f(v)+'px').join(' ')}`);
 const fx=effects(n,st);
 // strokes
 const sp=(n.strokePaints||[]).find(p=>p.visible!==false&&p.type==='SOLID');
 const sw=n.strokeWeight||0;
 let html='';
 if(n.type==='TEXT'){
  const base=n.fontName,fs=n.fontSize;fonts.add(base.family+'|'+(W[base.style.replace(/ /g,'')]||400));
  st.push(`font-family:'${base.family}',sans-serif`,`font-size:${f(fs)}px`,`font-weight:${W[base.style.replace(/ /g,'')]||400}`);
  if(/Italic/.test(base.style))st.push('font-style:italic');
  const lh=n.derivedTextData?.baselines?.[0]?.lineHeight;
  if(n.lineHeight?.units==='PIXELS')st.push(`line-height:${f(n.lineHeight.value)}px`);else if(lh)st.push(`line-height:${f(lh)}px`);
  const ls=n.letterSpacing;if(ls&&ls.value)st.push(`letter-spacing:${ls.units==='PERCENT'?f(ls.value/100)+'em':f(ls.value)+'px'}`);
  const ta=n.textAlignHorizontal;if(ta&&ta!=='LEFT')st.push(`text-align:${ta==='JUSTIFIED'?'justify':ta.toLowerCase()}`);
  if(n.textCase==='UPPER')st.push('text-transform:uppercase');else if(n.textCase==='LOWER')st.push('text-transform:lowercase');else if(n.textCase==='TITLE')st.push('text-transform:capitalize');
  if(n.textDecoration==='UNDERLINE')st.push('text-decoration:underline');
  st.push(hugW?'white-space:nowrap':'white-space:pre-wrap');
  const fp=(n.fillPaints||[]).map(p=>paintCss(p,n)).filter(Boolean);
  const col=fp.find(p=>p.solid);
  if(col)st.push(`color:${col.solid}`);
  else if(fp[0]){st.push(`background:${fp[0].layer}`,'-webkit-background-clip:text','background-clip:text','color:transparent');}
  const chars=n.textData.characters,ids=n.textData.characterStyleIDs,ov={};
  (n.textData.styleOverrideTable||[]).forEach(o=>ov[o.styleID]=o);
  if(ids&&ids.some(i=>i)){let out='',i=0;while(i<chars.length){let j=i;while(j<chars.length&&(ids[j]||0)===(ids[i]||0))j++;
    const seg=esc(chars.slice(i,j)).replace(/\n/g,'<br>');const o=ov[ids[i]||0];
    if(o){const s=[];if(o.fontName){s.push(`font-weight:${W[o.fontName.style.replace(/ /g,'')]||400}`);fonts.add(o.fontName.family+'|'+(W[o.fontName.style.replace(/ /g,'')]||400));if(o.fontName.family!==base.family)s.push(`font-family:'${o.fontName.family}',sans-serif`)}
      const c=(o.fillPaints||[]).find(p=>p.type==='SOLID');if(c)s.push(`color:${rgba(c.color,c.opacity)}`);if(o.fontSize)s.push(`font-size:${f(o.fontSize)}px`);
      out+=`<span style="${s.join(';')}">${seg}</span>`}else out+=seg;i=j;}
    html=`${pad}<div class="${cls}">${out}</div>\n`;}
  else html=`${pad}<div class="${cls}">${esc(chars).replace(/\n/g,'<br>')}</div>\n`;
  if(fx.sh.length&&!fp.length)st.push(`text-shadow:${fx.sh[0].replace('inset ','')}`);
  css.push(`.${cls}{${st.join(';')}}`);return html;}
 if(n.type==='LINE'){st.push(`height:0`,`border-top:${f(sw)}px ${n.dashPattern?.length?'dashed':'solid'} ${sp?rgba(sp.color,sp.opacity):'transparent'}`);
  css.push(`.${cls}{${st.join(';')}}`);return`${pad}<div class="${cls}"></div>\n`;}
 if(n.type==='VECTOR'||n.type==='BRUSH'){
  const fg=(n.fillGeometry||[]).map(g=>({d:blobPath(g.commandsBlob),eo:g.windingRule==='ODD'}));
  const sg=(n.strokeGeometry||[]).map(g=>({d:blobPath(g.commandsBlob)}));
  const fpaint=(n.fillPaints||[]).find(p=>p.visible!==false&&(p.type==='SOLID'||p.type==='GRADIENT_LINEAR'));
  const fcol=fpaint?(fpaint.type==='SOLID'?rgba(fpaint.color,fpaint.opacity):rgba(fpaint.stops[0].color,fpaint.opacity)):'none';
  const scol=sp?rgba(sp.color,sp.opacity):'none';
  let inner=fg.map(g=>`<path d="${g.d}" fill="${fcol}"${g.eo?' fill-rule="evenodd"':''}/>`).join('')+sg.map(g=>`<path d="${g.d}" fill="${scol}"/>`).join('');
  st.push('overflow:visible');if(fx.fl)st.push(`filter:${fx.fl}`);
  css.push(`.${cls}{${st.join(';')}}`);
  return `${pad}<svg class="${cls}" viewBox="0 0 ${f(w)} ${f(h)}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>\n`;}
 // FRAME / RECTANGLE / ELLIPSE
 const paints=(n.fillPaints||[]).map(p=>paintCss(p,n)).filter(Boolean);
 if(paints.length===1&&paints[0].solid)st.push(`background:${paints[0].solid}`);
 else if(paints.length)st.push(`background:${paints.map(p=>p.layer).reverse().join(', ')}`);
 if(sp&&sw){const dash=n.dashPattern?.length?'dashed':'solid';const col=rgba(sp.color,sp.opacity);
  if(n.borderStrokeWeightsIndependent){const b={top:n.borderTopWeight||0,right:n.borderRightWeight||0,bottom:n.borderBottomWeight||0,left:n.borderLeftWeight||0};
   for(const k in b)if(b[k])st.push(`border-${k}:${f(b[k])}px ${dash} ${col}`);st.push('box-sizing:border-box');}
  else if(n.strokeAlign==='INSIDE'||n.type==='FRAME'&&false){st.push(`border:${f(sw)}px ${dash} ${col}`,'box-sizing:border-box');}
  else fx.sh.push(`0 0 0 ${f(n.strokeAlign==='OUTSIDE'?sw:sw/2)}px ${col}`);}
 if(fx.sh.length)st.push(`box-shadow:${fx.sh.join(', ')}`);
 if(fx.bf)st.push(`backdrop-filter:${fx.bf}`,`-webkit-backdrop-filter:${fx.bf}`);
 if(fx.fl)st.push(`filter:${fx.fl}`);
 if(n.type==='FRAME'){
  if(!n.frameMaskDisabled)st.push('overflow:hidden');
  if(isStack){st.push('display:flex',`flex-direction:${horiz?'row':'column'}`);
   const pa={CENTER:'center',MAX:'flex-end',SPACE_EVENLY:'space-between',SPACE_BETWEEN:'space-between'}[n.stackPrimaryAlignItems];
   const ca={CENTER:'center',MAX:'flex-end',BASELINE:'baseline'}[n.stackCounterAlignItems];
   if(pa)st.push(`justify-content:${pa}`);st.push(`align-items:${ca||'flex-start'}`);
   if(n.stackSpacing)st.push(`gap:${f(n.stackSpacing)}px`);
   if(n.stackWrap==='WRAP'){st.push('flex-wrap:wrap');if(n.stackCounterSpacing)st.push(`row-gap:${f(n.stackCounterSpacing)}px`);}
   const P=[n.stackVerticalPadding,n.stackPaddingRight,n.stackPaddingBottom,n.stackHorizontalPadding].map(v=>v||0);
   if(P.some(v=>v))st.push(`padding:${P.map(v=>f(v)+'px').join(' ')}`);
   st.push('box-sizing:border-box');}
 }
 css.push(`.${cls}{${st.join(';')}}`);
 const ch=(kids[id(n.guid)]||[]).map(c=>nodeToHtml(c,n,depth+1)).join('');
 return `${pad}<div class="${cls}">\n${ch}${pad}</div>\n`;
}

// emit each top-level frame as its own page
const frames=(kids[id(page.guid)]||[]).filter(n=>n.type==='FRAME');
const names={};const index=[];
for(const fr of frames){
 css=[];counter=0;fonts.clear?.();
 let base=slug(fr.name);names[base]=(names[base]||0)+1;if(names[base]>1)base+='-'+names[base];
 const body=nodeToHtml({...fr,transform:{m00:1,m01:0,m02:0,m10:0,m11:1,m12:0},stackPositioning:undefined},null,2);
 const fam={};[...fonts].forEach(x=>{const[a,b]=x.split('|');(fam[a]??=new Set()).add(b)});
 const link=Object.entries(fam).map(([a,ws])=>`family=${a.replace(/ /g,'+')}:wght@${[...ws].sort().join(';')}`).join('&');
 const html=`<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${esc(fr.name)}</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?${link}&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="${base}.css">\n</head>\n<body>\n${body}</body>\n</html>\n`;
 const reset=`*{margin:0;padding:0}\nbody{background:#fff;-webkit-font-smoothing:antialiased}\nbody>div{margin:0 auto}\nimg,svg{display:block}\n`;
 fs.writeFileSync(path.join(outDir,base+'.html'),html);
 fs.writeFileSync(path.join(outDir,base+'.css'),reset+css.join('\n')+'\n');
 index.push({base,name:fr.name,w:fr.size.x,h:fr.size.y});
 console.log(base,fr.size.x+'x'+fr.size.y,css.length,'rules');
}
fs.writeFileSync(path.join(outDir,'index.html'),`<!DOCTYPE html><html><head><meta charset="utf-8"><title>enair — pages</title><style>body{font:16px system-ui;max-width:640px;margin:40px auto;padding:0 16px}li{margin:8px 0}small{color:#667}</style></head><body><h1>enair</h1><ul>${index.map(i=>`<li><a href="${i.base}.html">${esc(i.name)}</a> <small>${i.w}×${i.h}</small></li>`).join('')}</ul></body></html>`);
