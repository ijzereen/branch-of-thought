<div align="center">

# Branch of Thought

**Your AI chats are secretly trees. See the whole forest.**

Edit a message in Claude or ChatGPT and nothing gets overwritten — it **forks**.
Branch of Thought draws every hidden branch as a live, git-style graph in a side panel.

![License](https://img.shields.io/badge/License-MIT-1c1c1a?style=flat-square)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-1c1c1a?style=flat-square&logo=googlechrome&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-supported-d97757?style=flat-square)
![ChatGPT](https://img.shields.io/badge/ChatGPT-supported-10a37f?style=flat-square)
![Build](https://img.shields.io/badge/build-none-1c1c1a?style=flat-square)

**English** · [한국어](#한국어)

</div>

> _Drop a GIF here. A 5-second clip of the tree lighting up does the rest._

---

## The gist

You edit prompts to steer the model. Every edit forks the conversation. A dozen forks in, your "chat" is a tree and you're stuck on one leaf with no map. This is the map.

## What you get

- **The whole tree** — every fork, current path lit up.
- **Click to read** — full message in Markdown, plus the turn that caused it (answer ↔ question).
- **Click to re-route** — push the active path through any node, walk the branches you left behind.
- **Drag to arrange** — your layout sticks, per conversation.
- **Haiku titles** — optional one-liners so you skim, not squint.
- **Export** — interactive HTML, PNG, or SVG.

## Platforms

| | Status | Notes |
|---|---|---|
| **Claude** · claude.ai | Yes | full branch tree |
| **ChatGPT** · chatgpt.com | Yes | rebuilt from the `mapping` tree |

One normalizer folds both into the same shape, so everything downstream is platform-agnostic.

## Install · 60 seconds

Not on the Web Store, never will be. Grab it here:

```bash
git clone https://github.com/ijzereen/branch-of-thought
```

Then `chrome://extensions` → **Developer mode** on → **Load unpacked** → pick the folder.
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

Labels are raw text by default. Add an Anthropic API key (**⚙︎ → settings**) and every node gets a crisp one-liner instead.

Cheap on purpose: the active path is summarized up front, the rest on hover. Messages never change, so each is summarized once and cached forever — a few cents on first open, free after. Key and summaries live in your browser.

## Privacy

Nothing leaves your machine. Branch of Thought reads responses your browser already fetched and builds the graph locally — no servers, no analytics, no telemetry. The one exception: turn on Haiku titles and message text goes to `api.anthropic.com` with *your* key.

## License

[MIT](LICENSE) — do whatever you want.

<br>

---

<div align="center">

# 한국어

**당신의 AI 대화는 사실 나무입니다. 숲 전체를 보세요.**

Claude나 ChatGPT에서 메시지를 편집하면 덮어써지는 게 아니라 **가지가 갈라집니다.**
Branch of Thought는 그 숨은 가지를 git 그래프처럼, 사이드패널에서 실시간으로 그려줍니다.

[English](#branch-of-thought) · **한국어**

</div>

---

## 한 줄 요약

프롬프트를 고쳐가며 모델을 유도하죠. 편집할 때마다 대화는 갈라집니다. 열 번쯤 갈라지면 당신의 "채팅"은 나무가 되고, 지도도 없이 잎사귀 하나에 갇혀요. 이게 그 지도입니다.

## 뭘 해주냐면

- **나무 전체** — 모든 가지, 현재 경로는 밝게.
- **클릭해서 읽기** — 전문을 마크다운으로, 그 turn을 만든 상대 메시지까지 (답변 ↔ 질문).
- **클릭해서 경로 전환** — 활성 경로를 아무 노드로나 돌려, 버려뒀던 가지를 걷기.
- **드래그로 정리** — 배치는 대화별로 유지.
- **Haiku 제목** — 훑어볼 수 있게 달아주는 한 줄 제목 (선택).
- **내보내기** — 인터랙티브 HTML, PNG, SVG.

## 플랫폼

| | 상태 | 비고 |
|---|---|---|
| **Claude** · claude.ai | 지원 | 브랜치 트리 완전 지원 |
| **ChatGPT** · chatgpt.com | 지원 | `mapping` 트리에서 복원 |

정규화기 하나가 둘을 같은 형태로 접어 넣어, 그 아래는 전부 플랫폼 무관하게 동작합니다.

## 설치 · 60초

웹스토어엔 없고, 앞으로도 없습니다. 여기서 받으세요:

```bash
git clone https://github.com/ijzereen/branch-of-thought
```

그다음 `chrome://extensions` → **개발자 모드** 켜기 → **압축해제된 확장 프로그램을 로드** → 폴더 선택.
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

기본 라벨은 원문 그대로예요. Anthropic API 키를 넣으면(**⚙︎ → 설정**) 각 노드에 깔끔한 한 줄 제목이 붙습니다.

일부러 저렴하게: 처음엔 활성 경로만, 나머지는 마우스 올릴 때 요약. 메시지는 안 바뀌니 한 번만 요약하고 영구 캐시 — 첫 오픈에 몇 센트, 이후 무료. 키와 요약은 브라우저 안에만.

## 프라이버시

아무것도 기기를 벗어나지 않습니다. 브라우저가 이미 받은 응답만 읽어 로컬에서 그래프를 만들죠 — 서버도, 분석도, 텔레메트리도 없음. 유일한 예외: Haiku 제목을 켜면 *본인 키*로 `api.anthropic.com`에 메시지 텍스트가 갑니다.

## 라이선스

[MIT](LICENSE) — 마음대로 쓰세요.

<br>

---

## Star History

<a href="https://www.star-history.com/?repos=ijzereen%2Fbranch-of-thought&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=ijzereen/branch-of-thought&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=ijzereen/branch-of-thought&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=ijzereen/branch-of-thought&type=date&legend=top-left" />
 </picture>
</a>
