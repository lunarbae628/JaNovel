from pathlib import Path
root=Path(__file__).resolve().parents[2]
work=Path(__file__).resolve().parent
editor=(work/'editor-source.html').read_text()
css=editor.split('<style>')[1].split('</style>')[0].replace('#essay-workspace','.application-editor')
js=editor.split('<script>')[1].split('</script>')[0]
js=js.replace("(()=>{\nconst root=document.getElementById('essay-workspace');",'function mountEditor(root,context){',1)
js=js.rsplit('})();',1)[0]+'}\n'
js=js.replace('<span class="p-company">예시기업</span><span class="p-job">백엔드 개발</span>', '<span class="p-company">${esc(context.company)}</span><span class="p-job">${esc(context.role)}</span>')
# A per-application editor instance owns its own question histories; keep existing mock behavior.
result=(work/'hub.html').read_text()+'\n<style>\n'+css+'\n'+(work/'registration.css').read_text()+'\n</style>\n<script>\n(()=>{\n'+js+'\n'+(work/'hub.js').read_text()+'\n'+(work/'registration.js').read_text()+'\nrenderHome();\nif(hub.dataset.entry===\'editor\')openEditor(\'mono\');\nif(hub.dataset.entry===\'registration\')showRegistration();\nif(hub.dataset.entry===\'review\'){reg.sample=true;reg.data=structuredClone(samplePosting);reg.step=\'review\';showRegistration();}\n})();\n</script>\n'
(root/'docs/design/wireframes/application-overview.html').write_text(result)
(root/'docs/design/wireframes/application-editor.html').write_text(result.replace('<div id="application-overview"','<div id="application-overview" data-entry="editor"',1))
(root/'docs/design/wireframes/essay-workbench.html').write_text(result.replace('<div id="application-overview"','<div id="application-overview" data-entry="editor"',1))
(root/'docs/design/wireframes/posting-registration.html').write_text(result.replace('<div id="application-overview"','<div id="application-overview" data-entry="registration"',1))
(root/'docs/design/wireframes/posting-review.html').write_text(result.replace('<div id="application-overview"','<div id="application-overview" data-entry="review"',1))
print('Built application-overview.html')
