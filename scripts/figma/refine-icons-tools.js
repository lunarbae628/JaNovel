// Changes only the existing JaNovel icon masters; button IDs and reactions stay intact.
async function janovelRefineIcons(params){
 await janovelCheckFile();const resolved=[];
 for(const item of params.icons||[]){const [component]=await janovelProductNodes([item.id]);if(component.type!=='COMPONENT'||!component.name.startsWith('JaNovel/Icon/'))throw Error('Expected JaNovel icon component '+item.id);resolved.push({item,component});}
 const result=[];
 for(const {item,component}of resolved){
  const before=component.findAll(n=>n.type==='VECTOR'&&n.strokes.length).map(n=>({id:n.id,weight:n.strokeWeight}));
  if(params.apply){
   if(typeof item.svg!=='string'||!item.svg.trim().startsWith('<svg')||!item.source)throw Error('Official source SVG and identity required');
   const svgText=item.svg.replace(/currentColor/g,'#656B76').replace(/width="24"/,'width="18"').replace(/height="24"/,'height="18"');
   const previous=[...component.children],glyph=figma.createNodeFromSvg(svgText);component.appendChild(glyph);glyph.name=item.source;glyph.x=glyph.y=0;
   // resize() can leave a vector stroke at its old thickness. Set the final desktop weight explicitly.
   for(const vector of glyph.findAll(n=>n.type==='VECTOR'&&n.strokes.length)){vector.strokeWeight=1.25;vector.strokes=janovelInk('#656B76');}
   for(const node of previous)node.remove();component.description='Action '+item.role+'; Lucide '+item.source+' official SVG; ISC license; 18px glyph, final 1.25px stroke.';
   component.setPluginData('janovelIconSource',item.source);component.setPluginData('janovelIconRevision','2026-11-10');
  }
  result.push({id:component.id,name:component.name,source:component.getPluginData('janovelIconSource'),before,after:component.findAll(n=>n.type==='VECTOR'&&n.strokes.length).map(n=>({id:n.id,weight:n.strokeWeight})),width:component.width,height:component.height});
 }
 return {icons:result};
}
async function janovelAdoptDocumentDirection(params){
 const roots=await janovelProductNodes(params.ids),result=[];
 for(const root of roots){await janovelProductFonts(root);const header=root.children.find(n=>n.name==='회사 헤더');if(!header)continue;
  const apply=header.findOne(n=>n.type==='INSTANCE'&&n.children.some(x=>x.type==='TEXT'&&x.characters.includes('지원하러')));
  if(apply){apply.fills=janovelInk('#274690');apply.strokes=[];for(const text of apply.findAll(n=>n.type==='TEXT'))text.fills=janovelInk('#FFFFFF');}
  const center=root.findOne(n=>n.name==='작성·비교'),heads=center?.findOne(n=>n.name==='기록과 비교 대상');if(heads){heads.fills=janovelInk('#F3F4F6');heads.cornerRadius=6;for(const group of heads.children.filter(n=>n.name.startsWith('비교 헤더 /'))){group.paddingLeft=group.paddingRight=8;}}
  root.setPluginData('janovelDirection','A+comparison-strip+blue-apply');result.push({id:root.id,apply:apply?.id,heads:heads?.id});
 }
 return {scenes:result};
}
