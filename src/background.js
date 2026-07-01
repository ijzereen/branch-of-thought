// Service worker: opens the side panel, caches conversation trees per tab, and
// generates short node titles via the Anthropic API (Haiku) with a permanent
// per-message cache so each message is summarized at most once, ever.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

// tabId -> { conversation, url, pageUrl, receivedAt }
const latestByTab = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "CLAUDE_TREE" && sender.tab) {
    latestByTab.set(sender.tab.id, {
      conversation: msg.conversation,
      url: msg.url,
      pageUrl: msg.pageUrl,
      receivedAt: Date.now(),
    });
    chrome.runtime
      .sendMessage({
        type: "CLAUDE_TREE_FOR_TAB",
        tabId: sender.tab.id,
        ...latestByTab.get(sender.tab.id),
      })
      .catch(() => {});
    return;
  }

  if (msg && msg.type === "GET_LATEST") {
    sendResponse(latestByTab.get(msg.tabId) || null);
    return true;
  }

  if (msg && msg.type === "SUMMARIZE") {
    summarize(msg.items || [])
      .then((map) => sendResponse({ ok: true, titles: map }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true; // async
  }
});

chrome.tabs.onRemoved.addListener((tabId) => latestByTab.delete(tabId));

// ---------- summarization ----------

const SUMMARY_CACHE_KEY = "summaries"; // { [uuid]: title }

async function getCache() {
  const o = await chrome.storage.local.get(SUMMARY_CACHE_KEY);
  return o[SUMMARY_CACHE_KEY] || {};
}
async function setCache(cache) {
  await chrome.storage.local.set({ [SUMMARY_CACHE_KEY]: cache });
}

async function summarize(items) {
  // items: [{ uuid, text, sender }]
  const cfg = await chrome.storage.local.get([
    "apiKey",
    "summaryModel",
    "summaryEnabled",
  ]);
  const cache = await getCache();

  // start from whatever we already have cached
  const result = {};
  const todo = [];
  for (const it of items) {
    if (!it || !it.uuid) continue;
    if (cache[it.uuid]) result[it.uuid] = cache[it.uuid];
    else if (it.text && it.text.trim()) todo.push(it);
  }

  if (cfg.summaryEnabled === false || !cfg.apiKey || todo.length === 0) {
    return result; // fall back to whatever's cached; panel truncates the rest
  }

  const model = cfg.summaryModel || "claude-haiku-4-5-20251001";

  // split into small batches, then run a few batches concurrently (bounded so
  // we don't trip rate limits on large research conversations)
  const CHUNK = 25;
  const CONCURRENCY = 4;
  const batches = [];
  for (let i = 0; i < todo.length; i += CHUNK) batches.push(todo.slice(i, i + CHUNK));

  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      try {
        const titles = await callHaiku(cfg.apiKey, model, batch);
        for (const it of batch) {
          const t = titles[it.uuid];
          if (t) {
            cache[it.uuid] = t;
            result[it.uuid] = t;
          }
        }
      } catch (e) {
        // leave these uncached; panel will show truncated text for them
        console.warn("[Branch of Thought] summarize batch failed:", e);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker)
  );

  await setCache(cache);
  return result;
}

async function callHaiku(apiKey, model, batch) {
  const list = batch
    .map(
      (it) =>
        `- id: ${it.uuid}\n  role: ${it.sender === "human" ? "user" : "assistant"}\n  message: ${JSON.stringify(
          it.text.slice(0, 1500)
        )}`
    )
    .join("\n");

  const prompt =
    `다음은 대화 속 메시지 목록입니다. 각 메시지를 그래프 노드에 붙일 아주 짧은 한국어 제목으로 요약하세요.\n` +
    `규칙: 제목은 최대 18자, 명사구, 따옴표/마침표 없이. 각 id에 대해 하나씩.\n` +
    `반드시 아래 JSON 형식만 출력: {"<id>":"<제목>", ...}\n\n` +
    list;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .map((b) => (b && b.type === "text" ? b.text : ""))
    .join("");

  // extract the JSON object from the reply
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return {};
  }
}
