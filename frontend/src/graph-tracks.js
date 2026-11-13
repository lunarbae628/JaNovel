export function historyTracks(parents,target,map=false){
 const merge=parents.length>1,join=merge?Math.max(...parents.map(p=>p.y+(p.x===target.x?0:map?40:16))):target.y;
 return {incoming:parents.map(p=>({d:p.x===target.x?`M ${p.x} ${p.y} V ${join}`:map?`M ${p.x} ${p.y} C ${p.x} ${p.y+20}, ${target.x} ${p.y+20}, ${target.x} ${p.y+40} V ${join}`:`M ${p.x} ${p.y} L ${target.x} ${p.y+16} V ${join}`,color:merge?p.color:target.color})),shared:merge?{d:`M ${target.x} ${join} V ${target.y}`,color:target.color}:null};
}
