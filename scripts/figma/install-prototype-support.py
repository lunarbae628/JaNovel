"""Add narrowly scoped reaction editing to the existing local Figma plugin."""
from pathlib import Path

root = Path(__file__).resolve().parents[2]
plugin = root / '_workspace/talk-to-figma-mcp/src/cursor_mcp_plugin/code.js'
source = plugin.read_text()
marker = '// JANOVEL PROTOTYPE SUPPORT'
if marker not in source:
    backup = plugin.with_suffix('.before-prototype.js')
    if not backup.exists():
        backup.write_text(source)
    source = source.replace('switch (command) {', '''switch (command) {
    case "janovel_set_reactions":
      return await janovelSetReactions(params);
    case "janovel_inspect_reactions":
      return await janovelInspectReactions(params);''', 1)
    source += r'''
// JANOVEL PROTOTYPE SUPPORT
async function janovelCheckFile() {
  if (figma.fileKey && figma.fileKey !== 'ArLSPAcNklUKhcpk8V4zyf') {
    throw new Error('This extension only edits the JaNovel design file');
  }
  const writer = await figma.getNodeByIdAsync('5:530');
  if (!writer || writer.name !== '작성 · Desktop') throw new Error('JaNovel writer not found');
}
async function janovelSetReactions(params) {
  await janovelCheckFile();
  const links = params && params.links;
  if (!Array.isArray(links)) throw new Error('links array required');
  const changed = [];
  // Resolve every source first: a typo must not half-apply a batch.
  const sources = [];
  for (const item of links) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node || typeof node.setReactionsAsync !== 'function') throw new Error('Invalid reaction node: '+item.nodeId);
    for (const reaction of item.reactions || []) {
      for (const action of reaction.actions || []) {
        if (action.type === 'NODE' && action.destinationId && !(await figma.getNodeByIdAsync(action.destinationId))) {
          throw new Error('Unknown destination: '+action.destinationId);
        }
      }
    }
    sources.push(node);
  }
  for (let i = 0; i < links.length; i++) {
    await sources[i].setReactionsAsync(links[i].reactions || []);
    changed.push(sources[i].id);
  }
  return {mutatedNodeIds:changed,count:changed.length};
}
async function janovelInspectReactions(params) {
  await janovelCheckFile();
  const results = [];
  for (const id of params.nodeIds || []) {
    const root = await figma.getNodeByIdAsync(id);
    if (!root) throw new Error('Unknown root: '+id);
    const descendants = 'findAll' in root ? root.findAll(() => true) : [];
    const controls = [];
    for (const node of [root,...descendants]) {
      if (!('reactions' in node)) continue;
      if (node.reactions.length) controls.push({id:node.id,name:node.name,reactions:node.reactions});
    }
    results.push({id:root.id,name:root.name,controls});
  }
  return results;
}
'''
    plugin.write_text(source)
print(plugin)
