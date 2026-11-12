// Use the existing Talk to Figma relay; only native plugin commands are sent.
import fs from 'node:fs';
export async function connect(channel, receiptPath) {
  const socket = new WebSocket('ws://127.0.0.1:3055');
  const pending = new Map();
  const receipt = receiptPath && fs.existsSync(receiptPath)
    ? JSON.parse(fs.readFileSync(receiptPath, 'utf8'))
    : {channel, operations: [], screens: {}};
  function save() {
    if (!receiptPath) return;
    fs.mkdirSync(new URL('.', `file://${receiptPath}`).pathname, {recursive: true});
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  }
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    const message = data.message;
    if (!message || !pending.has(message.id)) return;
    if (!('result' in message) && !message.error) return;
    const item = pending.get(message.id);
    clearTimeout(item.timer);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(String(message.error)));
    else item.resolve(message.result);
  };
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Relay connection timeout')), 10000);
    socket.onopen = () => {clearTimeout(timer); resolve();};
    socket.onerror = () => {clearTimeout(timer); reject(new Error('Relay connection failed'));};
  });
  function send(type, command, params) {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${command} response timeout; inspect canvas before retrying`));
      }, 20000);
      pending.set(id, {resolve, reject, timer});
      socket.send(JSON.stringify({type, channel, id, message: {id, command, params: {...params, commandId: id}}}));
    });
  }
  await send('join', 'join', {channel});
  async function call(command, params = {}) {
    const wireParams = command === 'set_fill_color' && !params.color
      ? {nodeId: params.nodeId, color: {r: params.r, g: params.g, b: params.b, a: params.a ?? 1}}
      : params;
    const result = await send('message', command, wireParams);
    receipt.operations.push({command, params, result: result?.id ? {id: result.id} : undefined});
    save();
    return result;
  }
  return {call, receipt, save, close: () => socket.close()};
}

if (import.meta.main) {
  const client = await connect(process.argv[2]);
  try {
    const doc = await client.call('get_document_info');
    console.log(JSON.stringify({page: doc.name, children: doc.children?.map(n => ({id: n.id, name: n.name}))}));
  } finally {client.close();}
}
