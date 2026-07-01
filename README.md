<div align="center">

# 🌿 Branch of Thought

### Your AI chats are secretly trees. See the whole forest.

Edit a message in Claude or ChatGPT and it doesn't overwrite — it **forks**.
Branch of Thought maps every hidden branch as a live, git-style graph, right in a side panel.

![License](https://img.shields.io/badge/License-MIT-1c1c1a?style=flat-square)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-1c1c1a?style=flat-square&logo=googlechrome&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-supported-d97757?style=flat-square)
![ChatGPT](https://img.shields.io/badge/ChatGPT-supported-10a37f?style=flat-square)
![Build](https://img.shields.io/badge/build-none-1c1c1a?style=flat-square)

**English** · [한국어](#-한국어)

</div>

> 📸 _Drop a GIF here — a 5-second clip of the tree lighting up sells the whole thing._

---

## Why

Long research chats mean editing prompts constantly to steer the model. Half the time the answer I actually wanted was three edits back, on a branch I could no longer find. The web UI gives you a tiny `‹ 2/3 ›` arrow and nothing else. I wanted the whole tree — so here it is.

## What you get

- **The whole tree.** Every fork from every edit, with your current path lit up.
- **Click to read.** Full message in Markdown — *plus the turn that caused it* (answer ↔ question).
- **Click to re-route.** Send the highlighted path through any node and trace branches you'd abandoned.
- **Draggable.** Tidy the layout by hand; positions stick per conversation.
- **Skimmable.** Optional one-line node titles, written by Claude Haiku.
- **Exportable.** Interactive HTML, PNG, or SVG.

## Platforms

| | Status | Notes |
|---|---|---|
| **Claude** · claude.ai | ✅ | full branch tree |
| **ChatGPT** · chatgpt.com | ✅ | rebuilt from the `mapping` tree |

One normalizer folds both into the same shape, so everything downstream is platform-agnostic.

## Install · 60 seconds

Not on the Web Store, never will be. Grab it here:

```bash
git clone https://github.com/ijzereen/branch-of-thought
```

Then: `chrome://extensions` → **Developer mode** on → **Load unpacked** → pick the folder.
Open Claude or ChatGPT, click the toolbar icon, done.

## Controls

| | |
|---|---|
| Pan / zoom | drag empty space / scroll |
| Move a node | drag it · **↺** resets |
| Read a message | click a node |
| Fit to screen | **⤢** |
| Resize the reader | drag its top handle |
| Export | **⤓** → HTML / PNG / SVG |
| Settings | **⚙︎** |

> Just edited or sent a message? Refresh the tab — the graph reads the tree on page load.

## Titles by Haiku · optional

Node labels are raw text by default. Add an Anthropic API key (**⚙︎ → settings**) and each node gets a crisp one-line title instead.

Cheap by design: only the active path is summarized up front, the rest on hover. Messages never change, so each is summarized once and cached forever — a few cents on first open, free after. Key and summaries live in your browser.

## Privacy

Nothing leaves your machine. Branch of Thought reads responses your browser already fetched and builds the graph locally — no servers, no analytics, no telemetry. The one exception: if you turn on Haiku titles, message text goes to `api.anthropic.com` with *your* key.

## License

[MIT](LICENSE) — do whatever you want.

<br>

---

<div align="center">

# 🌿 한국어

### 당신의 AI 대화는 사실 나무입니다. 숲 전체를 보세요.

Claude나 ChatGPT에서 메시지를 편집하면 덮어써지는 게 아니라 **가지가 갈라집니다.**
Branch of Thought는 그 숨은 가지들을 git 그래프처럼, 사이드패널에서 실시간으로 그려줍니다.

[English](#-branch-of-thought) · **한국어**

</div>

---

## 왜

긴 리서치 채팅에선 모델을 유도하려고 프롬프트를 끝없이 고칩니다. 정작 원하던 답은 세 편집 전, 이제 못 찾는 가지 위에 있기 일쑤죠. 웹 UI가 주는 건 조그만 `‹ 2/3 ›` 화살표 하나뿐. 나무 전체가 보고 싶어서 만들었습니다.

## 뭘 해주냐면

- **나무 전체.** 편집마다 갈라진 모든 가지, 현재 경로는 밝게.
- **클릭해서 읽기.** 전문을 마크다운으로 — *그 turn을 만든 상대 메시지까지* (답변 ↔ 질문).
- **클릭해서 경로 전환.** 강조 경로를 아무 노드로나 돌려, 버려뒀던 가지도 추적.
- **드래그.** 손으로 배치 정리, 위치는 대화별로 유지.
- **훑어보기.** Claude Haiku가 달아주는 한 줄 노드 제목 (선택).
- **내보내기.** 인터랙티브 HTML, PNG, SVG.

## 플랫폼

| | 상태 | 비고 |
|---|---|---|
| **Claude** · claude.ai | ✅ | 브랜치 트리 완전 지원 |
| **ChatGPT** · chatgpt.com | ✅ | `mapping` 트리에서 복원 |

정규화기 하나가 둘을 같은 형태로 접어 넣어, 그 아래는 전부 플랫폼 무관하게 동작합니다.

## 설치 · 60초

웹스토어엔 없고, 앞으로도 없습니다. 여기서 받으세요:

```bash
git clone https://github.com/ijzereen/branch-of-thought
```

그다음: `chrome://extensions` → **개발자 모드** 켜기 → **압축해제된 확장 프로그램을 로드** → 폴더 선택.
Claude나 ChatGPT 열고 툴바 아이콘 클릭, 끝.

## 조작

| | |
|---|---|
| 이동 / 확대·축소 | 빈 곳 드래그 / 스크롤 |
| 노드 이동 | 드래그 · **↺** 초기화 |
| 메시지 읽기 | 노드 클릭 |
| 화면 맞춤 | **⤢** |
| 리더 크기 조절 | 상단 손잡이 드래그 |
| 내보내기 | **⤓** → HTML / PNG / SVG |
| 설정 | **⚙︎** |

> 방금 편집·전송했다면? 탭을 새로고침하세요 — 그래프는 페이지 로드 때 트리를 읽습니다.

## Haiku 제목 · 선택

기본 라벨은 원문 그대로입니다. Anthropic API 키를 넣으면(**⚙︎ → 설정**) 각 노드에 깔끔한 한 줄 제목이 붙어요.

저렴하게 설계: 처음엔 활성 경로만, 나머지는 마우스 올릴 때 요약. 메시지는 안 바뀌니 한 번만 요약하고 영구 캐시 — 첫 오픈에 몇 센트, 이후 무료. 키와 요약은 브라우저 안에만.

## 프라이버시

아무것도 기기를 벗어나지 않습니다. 브라우저가 이미 받은 응답만 읽어 로컬에서 그래프를 만들죠 — 서버도, 분석도, 텔레메트리도 없음. 유일한 예외: Haiku 제목을 켜면 *본인 키*로 `api.anthropic.com`에 메시지 텍스트가 갑니다.

## 라이선스

[MIT](LICENSE) — 마음대로 쓰세요.
