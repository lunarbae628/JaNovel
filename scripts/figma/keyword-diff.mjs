// Preserve original UTF-16 offsets so Figma ranges never drop or reorder text.
export function keywordDiff(a,b){
 const A=a.match(/\s+|[^\s]+/gu)||[],B=b.match(/\s+|[^\s]+/gu)||[];
 const dp=Array.from({length:A.length+1},()=>new Uint16Array(B.length+1));
 for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)dp[i][j]=A[i]===B[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 const left=[],right=[];let i=0,j=0,x=0,y=0;
 while(i<A.length||j<B.length){if(i<A.length&&j<B.length&&A[i]===B[j]){x+=A[i++].length;y+=B[j++].length;}else if(i<A.length&&(j===B.length||dp[i+1][j]>=dp[i][j+1])){if(A[i].trim())left.push({start:x,end:x+A[i].length});x+=A[i++].length;}else{if(B[j].trim())right.push({start:y,end:y+B[j].length});y+=B[j++].length;}}
 return {left,right};
}
