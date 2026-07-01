# Branch of Thought

**See the hidden shape of your AI conversations.**

English · [한국어](#한국어)

---

Edit a message in Claude or ChatGPT and it isn't overwritten — it *forks*. The old exchange is still there, alive on a branch you can't see anymore. Do that a few times and your "conversation" is quietly a tree, and you're standing on one leaf of it with no map.

Branch of Thought draws the map. It's a Chrome side panel that reads the conversation your browser already loaded, rebuilds every branch, and shows the whole thing like a git graph: which turn you're on, where it split, and what's down the paths you walked away from.

> 📸 _Add a screenshot or short GIF here — it does most of the selling._

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

Both platforms are folded into one internal shape by a normalizer, so the graph, the detail view, and the exporters don't care where the data came from.

## Install

It's not on the Chrome Web Store and won't be — just grab it from here and load it unpacked:

1. `git clone https://github.com/ijzereen/branch-of-thought`
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

## License

[MIT](LICENSE). Do what you want with it.

---

# 한국어

**AI 대화의 숨은 구조를 눈으로.**

[English](#branch-of-thought) · 한국어

---

Claude나 ChatGPT에서 메시지를 편집하면 덮어써지는 게 아니라 **가지가 갈라집니다(fork).** 이전 대화는 사라지지 않고, 더는 보이지 않는 가지 위에 그대로 살아 있어요. 몇 번 편집하다 보면 당신의 "대화"는 어느새 한 그루 나무가 되고, 당신은 지도도 없이 그 잎사귀 하나 위에 서 있게 됩니다.

Branch of Thought는 그 지도를 그려줍니다. 브라우저가 이미 불러온 대화를 읽어 모든 가지를 복원하고, git 그래프처럼 전체를 보여줘요. 지금 어느 지점에 있는지, 어디서 갈라졌는지, 두고 온 길 끝엔 뭐가 있었는지까지.

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

두 플랫폼을 하나의 정규화기가 공통 형태로 접어 넣기 때문에, 그래프·상세·내보내기는 데이터 출처를 신경 쓰지 않습니다.

## 설치

크롬 웹스토어엔 없고 앞으로도 올릴 계획 없어요 — 여기서 받아서 압축 해제 상태로 로드하세요:

1. `git clone https://github.com/ijzereen/branch-of-thought`
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

기본 노드 라벨은 메시지 원문을 자른 것입니다. Anthropic API 키를 넣으면(**⚙︎ → 설정**) 각 노드에 짧은 AI 제목이 붙어요.

저렴하게 설계했습니다: 처음엔 활성 경로만 요약하고, 나머지 가지는 마우스를 올리는 순간 요약합니다. 메시지는 바뀌지 않으니 한 번만 요약하고 영구 캐시돼요. 대화를 처음 열 때 몇 센트, 그 뒤론 무료입니다.

키와 요약 결과는 브라우저(`chrome.storage.local`) 안에만 저장됩니다.

## 프라이버시

대화는 브라우저를 벗어나지 않습니다. 확장은 페이지가 이미 받은 API 응답만 읽어 로컬에서 그래프를 만들고, 레이아웃과 제목만 로컬 스토리지에 저장해요. 서버도, 분석 도구도, 텔레메트리도 없습니다.

유일한 예외는 선택 기능인 Haiku 요약으로, *본인의* 키를 써서 `api.anthropic.com`에만 메시지 텍스트를 보냅니다. 켰을 때만요.

## 라이선스

[MIT](LICENSE). 마음대로 쓰세요.
