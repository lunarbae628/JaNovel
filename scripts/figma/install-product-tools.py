"""Install narrowly scoped JaNovel editing commands in the existing local plugin."""
from pathlib import Path
root = Path(__file__).resolve().parents[2]
plugin = root / '_workspace/talk-to-figma-mcp/src/cursor_mcp_plugin/code.js'
source = plugin.read_text()
if 'case "janovel_product_flows"' not in source:
    source = source.replace('switch (command) {', 'switch (command) {\n    case "janovel_product_flows": return await janovelProductFlows();', 1)
if 'case "janovel_wide_panel"' not in source:
    source = source.replace('switch (command) {', 'switch (command) {\n    case "janovel_wide_panel": return await janovelWidePanel(params);', 1)
if 'case "janovel_record_graph"' not in source:
    source = source.replace('switch (command) {', 'switch (command) {\n    case "janovel_record_graph": return await janovelRecordGraph(params);', 1)
for command, handler in {
    'janovel_panel_icon_inspect': 'janovelPanelIconInspect(params)',
    'janovel_panel_header_icons': 'janovelPanelHeaderIcons(params)',
    'janovel_design_audit': 'janovelDesignAudit(params)',
    'janovel_auth_oauth': 'janovelAuthOAuth(params)',
    'janovel_organize_design': 'janovelOrganizeDesign(params)',
    'janovel_design_inventory': 'janovelDesignInventory()',
    'janovel_auth_refine': 'janovelAuthRefine(params)',
    'janovel_auth_screens': 'janovelAuthScreens(params)',
    'janovel_workspace_handles': 'janovelWorkspaceHandles(params)',
    'janovel_compact_log_colors': 'janovelCompactLogColors(params)',
    'janovel_compact_log_concept': 'janovelCompactLogConcept(params)',
    'janovel_record_header_labels': 'janovelRecordHeaderLabels(params)',
    'janovel_graph_map': 'janovelGraphMap(params)',
    'janovel_graph_map_inspect': 'janovelGraphMapInspect(params)',
    'janovel_refine_icons': 'janovelRefineIcons(params)',
    'janovel_adopt_document_direction': 'janovelAdoptDocumentDirection(params)',
    'janovel_compact_assets': 'janovelCompactAssets(params)',
    'janovel_compact_panels': 'janovelCompactPanels(params)',
    'janovel_compact_scenes': 'janovelCompactScenes(params)',
    'janovel_compact_list': 'janovelCompactList()',
    'janovel_compact_concepts': 'janovelCompactConcepts(params)',
    'janovel_compact_verify': 'janovelCompactVerify(params)',
}.items():
    if f'case "{command}"' not in source:
        source = source.replace('switch (command) {', f'switch (command) {{\n    case "{command}": return await {handler};', 1)
marker = '// JANOVEL PRODUCT TOOLS'
if marker in source:
    source = source.split(marker)[0].rstrip() + '\n'
else:
    source = source.replace('switch (command) {', '''switch (command) {
    case "janovel_patch_nodes": return await janovelPatchNodes(params);
    case "janovel_clone_scene": return await janovelCloneScene(params);
    case "janovel_interactive_panel": return await janovelInteractivePanel(params);''', 1)
plugin.write_text(source + '\n' + marker + '\n' + (root / 'scripts/figma/product-tools.js').read_text() + '\n' + (root / 'scripts/figma/compact-concepts-tools.js').read_text() + '\n' + (root / 'scripts/figma/refine-icons-tools.js').read_text() + '\n' + (root / 'scripts/figma/graph-map-tools.js').read_text() + '\n' + (root / 'scripts/figma/compact-log-tools.js').read_text() + '\n' + (root / 'scripts/figma/auth-workspace-tools.js').read_text())
print(plugin)
