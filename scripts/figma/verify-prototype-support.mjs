import {connect} from './talk-channel.mjs';
const c=await connect(process.argv[2]);
try {console.log(JSON.stringify(await c.call('janovel_inspect_reactions',{nodeIds:['5:532']})));}
finally {c.close();}
