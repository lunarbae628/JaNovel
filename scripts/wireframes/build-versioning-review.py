"""Build focused review entries from the existing disposable editor prototype."""
from pathlib import Path

project = Path(__file__).resolve().parents[2]
source = (Path(__file__).parent / 'editor-source.html').read_text()
seed = """
const reviewQuestion=current();
reviewQuestion.versions[1].label='v3';
reviewQuestion.versions[1].name='직무 연결';
reviewQuestion.versions[2].label='v3-A';
reviewQuestion.versions[2].name='다른 도입';
reviewQuestion.nextVersion=4;
"""
entries = {
    'branch-review': "reviewQuestion.view='history';reviewQuestion.left=1;openRecord(reviewQuestion,'branch');",
    'merge-review': "startMerge(reviewQuestion);",
}
for name, initial_state in entries.items():
    fragment = source.replace(
        "render();\n})();\n</script>",
        seed + initial_state + "\nrender();\n})();\n</script>",
        1,
    )
    assert fragment != source, 'Editor entry point changed; update this generator.'
    # Keep the preview independent of any concurrently open editor.
    fragment = fragment.replace('essay-workspace', 'janovel-' + name)
    (project / 'docs/design/wireframes' / (name + '.html')).write_text(fragment)
print('Built branch-review.html and merge-review.html')
