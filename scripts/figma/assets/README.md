# Figma icon sources

`lucide-icons.json` contains the official SVG sources for the eleven icons used in the compact JaNovel workbench controls.

- Source: https://github.com/lucide-icons/lucide/tree/main/icons
- License: [Lucide ISC license](https://github.com/lucide-icons/lucide/blob/main/LICENSE)
- The Figma import retains the SVG view box, sets its display size to 18px and resolves `currentColor` to the neutral control color.

`refined-icons.json` records official replacement SVGs, source URLs, and blob SHAs fetched on 2026-11-10. The action mapping is:

| Existing component key | Current Lucide glyph | Meaning |
|---|---|---|
| git-merge | merge | Two drafts converge into one |
| git-branch | split | One draft branches into two |
| pencil-line | pencil | Return to writing |
| panel-left-close / panel-right-open | chevron-left | Move the corresponding panel left |
| panel-left-open / panel-right-close | chevron-right | Move the corresponding panel right |

Camera, comparison chevron, maximize and minimize retain their official glyphs. All eleven masters use a final 1.25px vector stroke at an 18px display size. Set the vector stroke explicitly after import: resizing a 24px SVG frame to 18px had left its stroke at 2px in this file. Existing component IDs and outer button reactions are retained.

Merge and split are rotated 180 degrees around the SVG center so their arrows follow the graph's downward direction. The official path data is unchanged.

The original component keys remain stable for existing instances. Their descriptions and `janovelIconSource` metadata identify the replacement glyph. The complete upstream license, including notices for Feather-derived icons, is retained in `LICENSE-lucide.txt`.

Keep the source SVG paths intact; do not redraw these icons using guessed primitives.

The graph header uses one expand/collapse-width icon beside the panel chevron; the redundant ‘기록’ caption is removed. Header buttons use 32px hit areas. Panel chevrons retain their original paths but use a `4 4 16 16` view box so their visible height matches the 18px maximize/minimize glyphs. The final visible stroke stays 1.25px. Expansion, width reset, and panel folding retain separate accessible names and tooltips.

## OAuth 로그인

- Google: [공식 로그인 브랜드 가이드](https://developers.google.com/identity/branding-guidelines)의 `signin-assets.zip`에서 Light/Square/아이콘형 @2x PNG를 사용한다. 원본 파일은 `google-signin-official.png`에 보관한다. 브랜드 심볼의 색·형태는 수정하지 않고 버튼 바깥 여백만 클리핑한다.
- Kakao: [공식 버튼 리소스](https://developers.kakao.com/tool/resource/login)의 `login-complete-ko.svg`에서 말풍선 경로를 그대로 사용한다. `kakao-signin-symbol.svg`는 심볼의 원래 경로와 비율을 유지한다. 배경은 `#FEE500`이다.
- `oauth-assets.json`은 로컬 동작 시안과 Figma 네이티브 요소에 같은 공식 심볼을 넣기 위한 데이터다. 실제 OAuth 인증은 연결하지 않았다.
