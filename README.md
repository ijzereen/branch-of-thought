# Branch of Thought

**See the hidden shape of your AI conversations.**

English · [한국어](#한국어)

---

Edit a message in Claude or ChatGPT and it isn't overwritten — it *forks*. The old exchange is still there, alive on a branch you can't see anymore. Do that a few times and your "conversation" is quietly a tree, and you're standing on one leaf of it with no map.

Branch of Thought draws the map. It's a Chrome side panel that reads the conversation your browser already loaded, rebuilds every branch, and shows the whole thing like a git graph: which turn you're on, where it split, and what's down the paths you walked away from.

> 📸 _Add a screenshot or short GIF here — it does most of the selling._

The name is a wink at [Chain-of-Thought](https://arxiv.org/abs/2201.11903), [Tree-of-Thoughts](https://arxiv.org/abs/2305.10601), and [Graph-of-Thoughts](https://arxiv.org/abs/2308.09687). Your thoughts branch. Now you can look at them.

## Why

I do long research chats and I edit prompts constantly to steer the model. More than once the answer I actually wanted was three edits back, sitting on a branch I could no longer find. The web UI gives you a tiny `‹ 2/3 ›` arrow and nothing else. I wanted the whole tree, so I built it.

## What it does

- Rebuilds the full branch tree and highlights the path you're currently on.
- Click a node to read the full message (rendered as Markdown) **plus the turn that caused it** — click an answer, see its question; click a question, see the answer before it.
- Click a node to re-route the highlighted path *through it*, so you can trace any branch, not just the live one.
- Drag nodes to tidy the layout. It remembers where you put them, per conversation.
- Optional short titles on each node, written by Claude Haiku, so you can skim the tree instead of reading raw text off every dot.
- Export the graph as a self-contained interactive HTML file, a PNG, or an SVG.

## Supported platforms

| Platform | Status | Notes |
|---|---|---|
| **Claude** — claude.ai | ✅ works | full branch tree |
| **ChatGPT** — chatgpt.com | ✅ works | rebuilt from the `mapping` tree, system/tool nodes folded out |
| **Gemini** — gemini.google.com | ❌ not yet | obfuscated backend, see [Limitations](#limitations) |

Every platform is folded into one internal shape by a normalizer, so the graph, the detail view, and the exporters don't care where the data came from. Adding a platform is one function.

## Install

No store listing yet — load it unpacked:

1. `git clone https://github.com/<your-username>/branch-of-thought`
2. Go to `chrome://extensions`
3. Turn on **Developer mode** (top-right)
4. **Load unpacked** → select the cloned folder
5. Open Claude or ChatGPT and click the toolbar icon to open the side panel

## Using it

Open a conversation and the graph shows up. If you just edited or sent a message, refresh the page (⌘R / Ctrl-R) — the extension reads the tree when the page loads it, so a brand-new turn won't appear until the next load.

| Action | How |
|---|---|
| Pan / zoom | drag empty space / scroll |
| Fit to screen | **⤢** |
| Move a node | drag it |
| Reset layout | **↺** |
| Select a node (re-route path + read message) | click it |
| Resize the detail popup | drag its top handle, or **⤢** on it |
| Export | **⤓** → HTML / PNG / SVG |
| Settings | **⚙︎** |

## Node titles with Haiku (optional)

Out of the box, node labels are just the message text, trimmed. Drop in an Anthropic API key (**⚙︎ → settings**) and each node gets a short AI-written title instead.

It's built to be cheap: only the active path is summarized up front, and other branches are summarized the moment you hover them. Messages never change, so each one is summarized exactly once and cached forever. You pay a few cents the first time you open a conversation and nothing after.

Your key and the summaries stay in your browser (`chrome.storage.local`).

## Privacy

Your conversations never leave the browser. The extension only reads API responses the page already fetched, builds the graph locally, and keeps layout and titles in local storage. No servers, no analytics, no telemetry.

The single exception is the optional Haiku summarization, which sends message text to `api.anthropic.com` using *your* key — and only if you turn it on.

## How it works

1. A `MAIN`-world content script wraps `fetch` and `XMLHttpRequest` and watches for conversation responses.
2. A per-platform normalizer turns each one into a common shape: `chat_messages` linked by `parent_message_uuid`, plus a `current_leaf_message_uuid`.
3. The side panel builds the tree from that, lays it out, and renders it as SVG.

Nothing is re-fetched or sent anywhere. The panel only ever sees what your browser already downloaded.

## Troubleshooting

- **Empty on a long chat?** It's almost always just zoomed way out — press **⤢**. (The auto-fit tries to open at a readable zoom, but very deep trees can still surprise it.)
- **Nothing at all?** Open the console — both the page's and the side panel's — and look for `[Branch of Thought]` lines. `captured: N messages` means it saw the data; `rendered N nodes` means it drew it. Neither? Refresh the conversation.

## Limitations

- **New messages need a refresh.** The graph updates when the page loads the tree, not on every streamed token.
- **Share links are snapshots.** A `/share/...` page usually holds only the visible path, so it renders as a straight line. Use the real conversation to see branches.
- **"Jump to message" is best-effort.** It scrolls the page to a message when it can find it in the DOM; branches that aren't rendered can't be scrolled to.
- **Gemini isn't supported.** It talks to its backend over `batchexecute` — an obfuscated RPC that returns nested arrays with no stable field names. Parsing it reliably is its own reverse-engineering project, and it would break every time Google reshuffles the payload. PRs welcome if you're feeling brave.

## Roadmap

- Collapse / expand branches for very large trees
- "Check out" a branch — actually switch the live conversation onto it
- Node search
- Gemini, if someone cracks the format

## Contributing

Plain JavaScript. No build step, no dependencies. Edit the files, hit reload on `chrome://extensions`, and you're testing. Adding a platform means writing one normalizer in `src/interceptor.js` that returns the common shape — everything downstream is platform-agnostic. Issues and PRs welcome.

## License

[MIT](LICENSE). Do what you want with it.

---

# 한국어

**AI 대화의 숨은 구조를 눈으로.**

[English](#branch-of-thought) · 한국어

---

Claude나 ChatGPT에서 메시지를 편집하면 덮어써지는 게 아니라 **가지가 갈라집니다(fork).** 이전 대화는 사라지지 않고, 더는 보이지 않는 가지 위에 그대로 살아 있어요. 몇 번 편집하다 보면 당신의 "대화"는 어느새 한 그루 나무가 되고, 당신은 지도도 없이 그 잎사귀 하나 위에 서 있게 됩니다.

Branch of Thought는 그 지도를 그려줍니다. 브라우저가 이미 불러온 대화를 읽어 모든 가지를 복원하고, git 그래프처럼 전체를 보여줘요. 지금 어느 지점에 있는지, 어디서 갈라졌는지, 두고 온 길 끝엔 뭐가 있었는지까지.

이름은 [Chain-of-Thought](https://arxiv.org/abs/2201.11903), [Tree-of-Thoughts](https://arxiv.org/abs/2305.10601), [Graph-of-Thoughts](https://arxiv.org/abs/2308.09687)에 대한 오마주예요. 생각은 가지를 칩니다. 이제 그걸 들여다볼 수 있고요.

## 왜 만들었나

긴 리서치 채팅을 하면서 모델을 유도하려고 프롬프트를 수없이 고칩니다. 정작 원했던 답이 세 편집 전, 이제는 찾을 수 없는 가지 위에 있던 적이 한두 번이 아니었어요. 웹 UI가 주는 건 조그만 `‹ 2/3 ›` 화살표 하나가 전부죠. 나무 전체가 보고 싶어서 직접 만들었습니다.

## 기능

- 전체 브랜치 트리를 복원하고 지금 있는 경로를 강조합니다.
- 노드를 클릭하면 전문을 **마크다운으로** 보여주고, **그 turn을 만든 상대 메시지**도 함께 뜹니다 — 답변을 누르면 질문이, 질문을 누르면 직전 답변이.
- 노드를 클릭하면 활성 경로가 *그 노드를 지나가도록* 다시 그려져, 살아 있는 경로뿐 아니라 아무 가지나 따라갈 수 있어요.
- 노드를 드래그해 정리할 수 있고, 옮긴 위치는 대화별로 기억됩니다.
- (선택) Claude Haiku가 각 노드에 짧은 제목을 달아줘, 점마다 원문을 읽지 않고 훑어볼 수 있어요.
- 그래프를 그 자체로 동작하는 인터랙티브 HTML / PNG / SVG로 내보냅니다.

## 지원 플랫폼

| 플랫폼 | 상태 | 비고 |
|---|---|---|
| **Claude** — claude.ai | ✅ 지원 | 브랜치 트리 완전 지원 |
| **ChatGPT** — chatgpt.com | ✅ 지원 | `mapping` 트리에서 복원, 시스템/툴 노드는 정리 |
| **Gemini** — gemini.google.com | ❌ 미지원 | 난독화된 백엔드, [한계](#한계) 참고 |

모든 플랫폼을 하나의 정규화기가 공통 형태로 접어 넣기 때문에, 그래프·상세·내보내기는 데이터 출처를 신경 쓰지 않습니다. 플랫폼 추가는 함수 하나면 됩니다.

## 설치

아직 스토어 등록 전이라, 압축 해제 상태로 로드하세요:

1. `git clone https://github.com/<your-username>/branch-of-thought`
2. `chrome://extensions` 접속
3. 우측 상단 **개발자 모드** 켜기
4. **압축해제된 확장 프로그램을 로드** → 클론한 폴더 선택
5. Claude나 ChatGPT를 열고 툴바 아이콘을 눌러 사이드패널 열기

## 사용법

대화를 열면 그래프가 나타납니다. 방금 편집하거나 메시지를 보냈다면 페이지를 새로고침(⌘R)하세요 — 확장은 페이지가 트리를 불러올 때 읽으므로, 새 메시지는 다음 로드 때 반영됩니다.

| 동작 | 방법 |
|---|---|
| 이동 / 확대·축소 | 빈 곳 드래그 / 스크롤 |
| 화면 맞춤 | **⤢** |
| 노드 이동 | 드래그 |
| 레이아웃 초기화 | **↺** |
| 노드 선택(경로 재설정 + 전문 보기) | 클릭 |
| 상세 팝업 크기 조절 | 상단 손잡이 드래그 또는 팝업의 **⤢** |
| 내보내기 | **⤓** → HTML / PNG / SVG |
| 설정 | **⚙︎** |

## Haiku 제목 요약 (선택)

기본 노드 라벨은 메시지 원문을 자른 것입니다. Anthropic API 키를 넣으면(**⤢ → 설정**) 각 노드에 짧은 AI 제목이 붙어요.

저렴하게 설계했습니다: 처음엔 활성 경로만 요약하고, 나머지 가지는 마우스를 올리는 순간 요약합니다. 메시지는 바뀌지 않으니 한 번만 요약하고 영구 캐시돼요. 대화를 처음 열 때 몇 센트, 그 뒤론 무료입니다.

키와 요약 결과는 브라우저(`chrome.storage.local`) 안에만 저장됩니다.

## 프라이버시

대화는 브라우저를 벗어나지 않습니다. 확장은 페이지가 이미 받은 API 응답만 읽어 로컬에서 그래프를 만들고, 레이아웃과 제목만 로컬 스토리지에 저장해요. 서버도, 분석 도구도, 텔레메트리도 없습니다.

유일한 예외는 선택 기능인 Haiku 요약으로, *본인의* 키를 써서 `api.anthropic.com`에만 메시지 텍스트를 보냅니다. 켰을 때만요.

## 동작 원리

1. `MAIN` 월드 콘텐츠 스크립트가 `fetch`와 `XMLHttpRequest`를 감싸 대화 응답을 감시합니다.
2. 플랫폼별 정규화기가 이를 공통 형태로 변환합니다: `parent_message_uuid`로 연결된 `chat_messages` + `current_leaf_message_uuid`.
3. 사이드패널이 그걸로 트리를 만들고 배치해 SVG로 렌더링합니다.

무엇도 다시 받거나 어디로 보내지 않아요. 패널은 브라우저가 이미 내려받은 것만 봅니다.

## 문제 해결

- **긴 대화에서 비어 보인다?** 대개 너무 축소돼서 그래요 — **⤢** 를 누르세요. (초기 뷰가 읽을 수 있는 배율로 열려고 하지만, 아주 깊은 트리는 여전히 놀랄 수 있어요.)
- **아예 안 뜬다?** 콘솔(페이지와 사이드패널 둘 다)에서 `[Branch of Thought]` 로그를 보세요. `captured: N messages` = 데이터를 잡음, `rendered N nodes` = 그림. 둘 다 없으면 대화를 새로고침하세요.

## 한계

- **새 메시지는 새로고침이 필요합니다.** 그래프는 페이지가 트리를 불러올 때 갱신되지, 토큰 스트리밍마다 갱신되지 않아요.
- **공유 링크는 스냅샷입니다.** `/share/...` 페이지는 보통 보이는 경로 하나만 담겨서 직선으로 그려집니다. 가지를 보려면 실제 대화를 쓰세요.
- **"메시지로 이동"은 best-effort입니다.** DOM에서 찾을 수 있을 때만 스크롤하며, 렌더링되지 않은 가지로는 이동할 수 없습니다.
- **Gemini는 미지원입니다.** `batchexecute`라는, 안정적 필드명이 없는 중첩 배열을 반환하는 난독화 RPC로 통신해요. 안정적으로 파싱하는 건 그 자체로 리버스 엔지니어링 프로젝트고, 구글이 형식을 바꿀 때마다 깨질 겁니다. 용감하시다면 PR 환영해요.

## 로드맵

- 아주 큰 트리를 위한 가지 접기/펼치기
- 브랜치 "체크아웃" — 실제 대화를 그 가지로 전환
- 노드 검색
- 형식이 풀린다면 Gemini

## 기여

순수 JavaScript입니다. 빌드 단계도, 의존성도 없어요. 파일을 고치고 `chrome://extensions`에서 새로고침하면 바로 테스트됩니다. 플랫폼 추가는 `src/interceptor.js`에 공통 형태를 반환하는 정규화기 하나를 쓰면 끝 — 그 아래는 전부 플랫폼 독립적입니다. 이슈와 PR 환영합니다.

## 라이선스

[MIT](LICENSE). 마음대로 쓰세요.
