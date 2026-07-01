// Side panel: receive conversation JSON, build the branch tree, render as SVG.

const SVGNS = "http://www.w3.org/2000/svg";
const ROOT_SENTINEL = "00000000-0000-4000-8000-000000000000";

const els = {
  empty: document.getElementById("empty"),
  wrap: document.getElementById("graph-wrap"),
  svg: document.getElementById("graph"),
  stats: document.getElementById("stats"),
  fit: document.getElementById("fit"),
  detail: document.getElementById("detail"),
  detailSender: document.getElementById("detail-sender"),
  detailTime: document.getElementById("detail-time"),
  detailText: document.getElementById("detail-text"),
  detailClose: document.getElementById("detail-close"),
  detailQuestion: document.getElementById("detail-question"),
  detailQuestionText: document.getElementById("detail-question-text"),
  detailQuestionLabel: document.getElementById("detail-question-label"),
};

let currentTabId = null;
let lastConversation = null;
let selectedUuid = null;
const nodeEls = new Map(); // uuid -> <g> element
const labelEls = new Map(); // uuid -> chip {g, rect, t} (permanent active labels)
const summaries = new Map(); // uuid -> AI title
const textByUuid = new Map(); // uuid -> full message text

// manual layout
const nodePos = new Map(); // uuid -> { x, y } current content coords
const edgeList = []; // { parentUuid, childUuid, el, active }
let posOverride = new Map(); // uuid -> { x, y } user-dragged positions
let convUuid = null; // current conversation id (for persisting positions)
let activeLeafUuid = null; // current_leaf_message_uuid of the rendered tree
let renderedActiveSet = new Set(); // claude's original active path (for downward preference)
let currentPlatform = "claude"; // claude | chatgpt | gemini

function assistantName(p) {
  return p === "chatgpt" ? "ChatGPT" : p === "gemini" ? "Gemini" : "Claude";
}

// ---------- i18n (default English, toggle to Korean) ----------
const I18N = {
  en: {
    emptyTitle: "Waiting for a conversation…",
    emptyBody:
      "Open or refresh a chat in <b>Claude</b> or <b>ChatGPT</b>, and the branch graph shows up here.",
    emptyHint: "Every edit starts a new branch; your current path is highlighted.",
    fit: "Fit to screen",
    reset: "Reset layout",
    exportT: "Export",
    settings: "Settings",
    resize: "Drag to resize",
    maximize: "Bigger / smaller",
    stats: (m, b) => `${m} messages · ${b} branches`,
    me: "You",
    question: "Question",
    prevAnswer: (n) => `Previous answer (${n})`,
    emptyMsg: "(empty message)",
    emptyQ: "(no content)",
    toggle: "한국어",
    renderErr: "Render error: ",
    resetDone: "Layout reset to auto.",
    nothingToExport: "Nothing to export.",
    pngFail: "PNG export failed.",
  },
  ko: {
    emptyTitle: "대화 트리를 기다리는 중…",
    emptyBody:
      "<b>Claude</b> 또는 <b>ChatGPT</b> 탭에서 대화를 열거나 새로고침하면 여기에 브랜치 그래프가 나타납니다.",
    emptyHint: "메시지를 편집할 때마다 새 가지가 생기고, 현재 경로가 강조됩니다.",
    fit: "화면에 맞추기",
    reset: "레이아웃 초기화",
    exportT: "내보내기",
    settings: "설정",
    resize: "드래그해서 크기 조절",
    maximize: "크게 / 작게",
    stats: (m, b) => `메시지 ${m}개 · 분기 ${b}곳`,
    me: "나",
    question: "질문",
    prevAnswer: (n) => `이전 답변 (${n})`,
    emptyMsg: "(빈 메시지)",
    emptyQ: "(내용 없음)",
    toggle: "English",
    renderErr: "그래프 렌더 오류: ",
    resetDone: "레이아웃을 자동 배치로 되돌렸어요.",
    nothingToExport: "내보낼 그래프가 없어요.",
    pngFail: "PNG 내보내기에 실패했어요.",
  },
};
let lang = "en";
function t(k) {
  return I18N[lang][k];
}
let lastCounts = null; // { count, branch } for re-rendering stats on lang switch
let selectedNode = null; // for re-rendering the detail pane on lang switch

function applyLang() {
  els.empty.innerHTML =
    `<p><b>${t("emptyTitle")}</b></p>` +
    `<p>${t("emptyBody")}</p>` +
    `<p class="hint">${t("emptyHint")}</p>`;
  els.fit.title = t("fit");
  document.getElementById("reset").title = t("reset");
  document.getElementById("export-btn").title = t("exportT");
  document.getElementById("settings").title = t("settings");
  const rz = document.getElementById("detail-resize");
  if (rz) rz.title = t("resize");
  const mx = document.getElementById("detail-max");
  if (mx) mx.title = t("maximize");
  const lb = document.getElementById("lang");
  if (lb) lb.textContent = t("toggle");
  if (lastCounts) els.stats.textContent = t("stats")(lastCounts.count, lastCounts.branch);
  if (selectedNode) renderDetail(selectedNode);
}

async function setLang(next) {
  lang = next === "ko" ? "ko" : "en";
  await chrome.storage.local.set({ lang });
  applyLang();
}
let gEdgesRef = null;
let gNodesRef = null;
let draggingNode = null;
let suppressClick = false;

// Minimal, dependency-free Markdown → HTML. HTML is escaped FIRST so message
// content can never inject markup; only our own tags are emitted. Self-contained
// (no outer refs) so it can be embedded verbatim in the HTML export.
function mdToHtml(src) {
  src = String(src || "").replace(/\r\n/g, "\n");
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // pull out fenced code blocks first
  const blocks = [];
  src = src.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) => {
    blocks.push(
      '<pre class="code"><code>' + esc(code.replace(/\n$/, "")) + "</code></pre>"
    );
    return "\uE000B" + (blocks.length - 1) + "\uE000";
  });

  const inline = (raw) => {
    let t = esc(raw);
    t = t.replace(/`([^`]+)`/g, (m, c) => "<code>" + c + "</code>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    t = t.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    t = t.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
      (m, txt, url) =>
        '<a href="' +
        url.replace(/"/g, "%22") +
        '" target="_blank" rel="noopener">' +
        txt +
        "</a>"
    );
    return t;
  };

  const lines = src.split("\n");
  let html = "";
  let i = 0;
  const tokenRe = /^\uE000B(\d+)\uE000$/;
  while (i < lines.length) {
    const line = lines[i];
    const tok = line.trim().match(tokenRe);
    if (tok) {
      html += blocks[+tok[1]];
      i++;
      continue;
    }
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const n = h[1].length;
      html += "<h" + n + ">" + inline(h[2]) + "</h" + n + ">";
      i++;
      continue;
    }
    if (/^\s*([-*_])\1\1+\s*$/.test(line)) {
      html += "<hr>";
      i++;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(inline(lines[i].replace(/^\s*>\s?/, "")));
        i++;
      }
      html += "<blockquote>" + buf.join("<br>") + "</blockquote>";
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push("<li>" + inline(lines[i].replace(/^\s*[-*+]\s+/, "")) + "</li>");
        i++;
      }
      html += "<ul>" + items.join("") + "</ul>";
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push("<li>" + inline(lines[i].replace(/^\s*\d+\.\s+/, "")) + "</li>");
        i++;
      }
      html += "<ol>" + items.join("") + "</ol>";
      continue;
    }
    // paragraph: gather until a blank line or another block starts
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s|^\s*[-*+]\s|^\s*\d+\.\s|^\s*>\s|^\uE000B\d+\uE000$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    html += "<p>" + inline(buf.join("\n")).replace(/\n/g, "<br>") + "</p>";
  }
  return html;
}

const LABEL_MAX = 30;

function truncate(s) {
  s = (s || "").replace(/\s+/g, " ").trim();
  return s.length > LABEL_MAX ? s.slice(0, LABEL_MAX - 1) + "…" : s || "…";
}

function labelText(uuid, fallbackText) {
  return truncate(summaries.has(uuid) ? summaries.get(uuid) : fallbackText);
}

// A rounded-rect label chip (box + text) placed to the right of a node.
function makeChip(text, isHover) {
  const g = document.createElementNS(SVGNS, "g");
  g.setAttribute("class", "label" + (isHover ? " hover" : ""));
  g.setAttribute("transform", "translate(14,0)");
  const rect = document.createElementNS(SVGNS, "rect");
  rect.setAttribute("rx", 5);
  rect.setAttribute("ry", 5);
  rect.setAttribute("x", 0);
  rect.setAttribute("y", -10);
  rect.setAttribute("height", 20);
  rect.setAttribute("width", 16);
  const t = document.createElementNS(SVGNS, "text");
  t.setAttribute("x", 8);
  t.setAttribute("y", 0);
  t.textContent = text || "…";
  g.appendChild(rect);
  g.appendChild(t);
  return { g, rect, t };
}

// Hard cap on chip text width (px). Chips never exceed this, so the layout's
// horizontal spacing (X_GAP) can guarantee they don't overlap the next node —
// important for Korean titles, which are near full-width per character.
const CHIP_MAX_W = 130;

// Size a chip's box to its text (must be in the DOM to measure), trimming with
// an ellipsis if the text would exceed CHIP_MAX_W.
function sizeChip(chip) {
  if (!chip || !chip.t) return;
  const t = chip.t;
  const measure = () => {
    try {
      return t.getComputedTextLength();
    } catch (_) {
      return (t.textContent || "").length * 6.5;
    }
  };
  let w = measure();
  if (w > CHIP_MAX_W) {
    const full = (t.textContent || "").replace(/…$/, "");
    let s = full;
    while (s.length > 1 && measure() > CHIP_MAX_W) {
      s = s.slice(0, -1);
      t.textContent = s + "…";
    }
    w = measure();
  }
  chip.rect.setAttribute("width", Math.max(16, Math.round(Math.min(w, CHIP_MAX_W) + 16)));
}

// ---------- data plumbing ----------

async function init() {
  const cfg = await chrome.storage.local.get("lang");
  lang = cfg.lang === "ko" ? "ko" : "en";
  applyLang();
  document.getElementById("lang").addEventListener("click", () => {
    setLang(lang === "en" ? "ko" : "en");
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await switchToTab(tab ? tab.id : null);
}

// Point the panel at a tab and load whatever tree we have cached for it.
async function switchToTab(tabId) {
  currentTabId = tabId;
  lastSig = null; // force a redraw even if the new tree looks similar
  if (tabId == null) {
    showEmpty();
    return;
  }
  const cached = await chrome.runtime.sendMessage({
    type: "GET_LATEST",
    tabId,
  });
  if (cached && cached.conversation) scheduleRender(cached.conversation);
  else showEmpty();
}

function showEmpty() {
  clearTimeout(renderTimer);
  els.wrap.hidden = true;
  els.detail.hidden = true;
  els.empty.hidden = false;
  els.stats.textContent = "";
}

// The side panel is shared across tabs — when the user switches to another
// claude.ai conversation tab, repoint at it so the graph follows along.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  console.debug("[Branch of Thought] active tab →", tabId);
  switchToTab(tabId);
});

// Same-tab full navigation to another conversation.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === currentTabId && changeInfo.status === "complete") {
    switchToTab(tabId);
  }
});

// Cheap fingerprint of a conversation tree — changes only when the tree really
// changes (new/edited message, or the active branch switched).
function convSignature(conv) {
  const n = conv && conv.chat_messages ? conv.chat_messages.length : 0;
  return `${(conv && conv.uuid) || ""}|${n}|${
    (conv && conv.current_leaf_message_uuid) || ""
  }`;
}

let lastSig = null;
let renderTimer = null;
let pendingConv = null;

// Debounce + dedupe: claude.ai often refetches the same tree several times when
// loading a long conversation. Collapse those into a single render, and skip
// entirely if nothing changed.
function scheduleRender(conv) {
  if (!conv) return;
  const sig = convSignature(conv);
  if (sig === lastSig) return; // identical tree → nothing to redraw
  pendingConv = conv;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    lastSig = convSignature(pendingConv);
    Promise.resolve()
      .then(() => render(pendingConv))
      .catch((e) => {
        console.error("[Branch of Thought] render failed:", e);
        toast(t("renderErr") + (e && e.message ? e.message : e));
      });
  }, 120);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  // Only handle the tab-scoped broadcast so we render at most once per fetch.
  if (msg.type === "CLAUDE_TREE_FOR_TAB" && msg.tabId === currentTabId) {
    scheduleRender(msg.conversation);
  }
});

// ---------- tree building ----------

function messageText(m) {
  if (typeof m.text === "string" && m.text.trim()) return m.text;
  if (Array.isArray(m.content)) {
    return m.content
      .map((b) => (b && typeof b.text === "string" ? b.text : ""))
      .join("")
      .trim();
  }
  return "";
}

function buildTree(conv) {
  const messages = conv.chat_messages || [];
  const byId = new Map();

  for (const m of messages) {
    byId.set(m.uuid, {
      uuid: m.uuid,
      parent: m.parent_message_uuid,
      sender: m.sender === "human" ? "human" : "assistant",
      text: messageText(m),
      createdAt: m.created_at || "",
      index: typeof m.index === "number" ? m.index : null,
      children: [],
    });
  }

  // Fallback for share snapshots / exports that carry no branch pointers: if no
  // message links to another, chain them linearly in order so we still render a
  // sensible path instead of a flat fan.
  const hasLinks = [...byId.values()].some(
    (n) => n.parent && n.parent !== ROOT_SENTINEL && byId.has(n.parent)
  );
  if (!hasLinks && byId.size > 1) {
    const ordered = [...byId.values()].sort((a, b) => {
      if (a.index != null && b.index != null && a.index !== b.index)
        return a.index - b.index;
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
    for (let i = 1; i < ordered.length; i++) ordered[i].parent = ordered[i - 1].uuid;
    if (!conv.current_leaf_message_uuid)
      conv = { ...conv, current_leaf_message_uuid: ordered[ordered.length - 1].uuid };
  }

  const root = { uuid: "__root__", sender: "root", text: "", children: [], parent: null };

  for (const node of byId.values()) {
    const parentNode =
      node.parent && node.parent !== ROOT_SENTINEL && byId.has(node.parent)
        ? byId.get(node.parent)
        : root;
    parentNode.children.push(node);
  }

  // order siblings chronologically so branches read left→right by age
  const order = (a, b) => {
    if (a.index != null && b.index != null && a.index !== b.index)
      return a.index - b.index;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  };
  const sortRec = (n) => {
    n.children.sort(order);
    n.children.forEach(sortRec);
  };
  sortRec(root);

  // active path: from current leaf up to root
  const activeSet = new Set();
  let leaf = conv.current_leaf_message_uuid;
  while (leaf && byId.has(leaf)) {
    activeSet.add(leaf);
    leaf = byId.get(leaf).parent;
  }

  return { root, byId, activeSet, count: byId.size };
}

// ---------- layout (simple tidy tree) ----------

// Wide enough that a max-width chip (node + 14px offset + ~146px box ≈ 160px)
// clears the neighbouring node, so active-path titles never overlap.
const X_GAP = 172;
const Y_GAP = 66;
const PAD = 40;

function layout(root) {
  let nextX = 0;
  const walk = (node, depth) => {
    node.depth = depth;
    if (node.children.length === 0) {
      node.lx = nextX++;
    } else {
      node.children.forEach((c) => walk(c, depth + 1));
      const first = node.children[0].lx;
      const last = node.children[node.children.length - 1].lx;
      node.lx = (first + last) / 2;
    }
  };
  // root is synthetic; start its real children at depth 0
  root.children.forEach((c) => walk(c, 0));
  root.lx = root.children.length
    ? (root.children[0].lx + root.children[root.children.length - 1].lx) / 2
    : 0;
  root.depth = -1;
}

// ---------- rendering ----------

let view = { x: 0, y: 0, k: 1 };

async function render(conv) {
  lastConversation = conv;
  currentPlatform = conv.platform || "claude";
  const { root, byId, activeSet, count } = buildTree(conv);
  renderedActiveSet = activeSet;
  layout(root);

  // load persisted manual positions when the conversation changes
  const cid = conv.uuid || "unknown";
  if (cid !== convUuid) {
    convUuid = cid;
    posOverride = await loadPositions(cid);
  }

  els.empty.hidden = true;
  els.wrap.hidden = false;

  const svg = els.svg;
  svg.innerHTML = "";
  nodeEls.clear();
  labelEls.clear();
  textByUuid.clear();
  nodePos.clear();
  edgeList.length = 0;

  const gEdges = document.createElementNS(SVGNS, "g");
  const gNodes = document.createElementNS(SVGNS, "g");
  const gRoot = document.createElementNS(SVGNS, "g");
  gRoot.appendChild(gEdges);
  gRoot.appendChild(gNodes);
  svg.appendChild(gRoot);
  gEdgesRef = gEdges;
  gNodesRef = gNodes;

  const px = (n) => PAD + n.lx * X_GAP;
  const py = (n) => PAD + n.depth * Y_GAP;

  let branchCount = 0;
  const edgePairs = [];

  // ---- pass 1: position + draw nodes ----
  const drawNode = (node) => {
    if (node.uuid !== "__root__") {
      const override = posOverride.get(node.uuid);
      const pos = override || { x: px(node), y: py(node) };
      nodePos.set(node.uuid, pos);

      const isActive = activeSet.has(node.uuid);
      const isBranch = node.children.length > 1;
      if (isBranch) branchCount++;

      const parentNode = node.__parentRef;
      if (parentNode && parentNode.uuid !== "__root__") {
        edgePairs.push({
          parentUuid: parentNode.uuid,
          childUuid: node.uuid,
          active: isActive && activeSet.has(parentNode.uuid),
        });
      }

      const g = document.createElementNS(SVGNS, "g");
      g.setAttribute(
        "class",
        `node ${node.sender}` +
          (isActive ? " active" : "") +
          (isBranch ? " branch" : "") +
          (node.uuid === selectedUuid ? " selected" : "")
      );
      g.setAttribute("transform", `translate(${pos.x},${pos.y})`);

      const c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("r", isBranch ? 9 : 7);
      g.appendChild(c);

      textByUuid.set(node.uuid, node.text);

      // Active branch gets a permanent label chip (rounded box) to the right.
      // Inactive branches stay as dots and reveal a chip on hover.
      if (isActive) {
        const chip = makeChip(labelText(node.uuid, node.text), false);
        g.appendChild(chip.g);
        labelEls.set(node.uuid, chip);
      }

      // click selects + jumps (suppressed right after a drag)
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        selectNode(node);
      });

      // drag to reposition this node
      g.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation(); // don't start a canvas pan
        const p = toGraph(e.clientX, e.clientY);
        const cur = nodePos.get(node.uuid);
        draggingNode = {
          uuid: node.uuid,
          g,
          grabX: p.x - cur.x,
          grabY: p.y - cur.y,
          moved: false,
        };
      });

      // Any node NOT currently on the active path reveals a chip on hover.
      // (Active nodes already carry a permanent chip.) Checked at hover time so
      // it stays correct after the active path is recomputed on selection.
      g.addEventListener("mouseenter", () => {
        if (draggingNode) return;
        if (g.classList.contains("active")) return;
        if (g.querySelector("g.label")) return;
        const chip = makeChip(labelText(node.uuid, node.text), true);
        g.appendChild(chip.g);
        sizeChip(chip);
        gNodes.appendChild(g); // move to end → draws above siblings
        if (!summaries.has(node.uuid)) requestSummaries([node]);
      });
      g.addEventListener("mouseleave", () => {
        const hl = g.querySelector("g.label.hover");
        if (hl) hl.remove();
      });

      nodeEls.set(node.uuid, g);
      gNodes.appendChild(g);
      if (isActive) sizeChip(labelEls.get(node.uuid)); // measure now it's in DOM
    }

    node.children.forEach((ch) => {
      ch.__parentRef = node;
      drawNode(ch);
    });
  };

  root.children.forEach((c) => {
    c.__parentRef = root;
    drawNode(c);
  });

  // ---- pass 2: draw edges from final positions ----
  for (const pair of edgePairs) {
    const path = document.createElementNS(SVGNS, "path");
    path.setAttribute("class", "edge" + (pair.active ? " active" : ""));
    gEdges.appendChild(path);
    edgeList.push({ ...pair, el: path });
  }
  redrawEdges();

  svg.__gRoot = gRoot;
  updateContentSize();

  activeLeafUuid = conv.current_leaf_message_uuid || null;

  lastCounts = { count, branch: branchCount };
  els.stats.textContent = t("stats")(count, branchCount);
  applyView();
  initialView();

  console.debug(
    "[Branch of Thought] rendered",
    count,
    "nodes,",
    branchCount,
    "branches"
  );

  // Summarize only the active path — those are the only nodes with a permanent
  // label. Inactive nodes are summarized lazily on hover. This keeps long
  // "research" conversations from firing hundreds of API calls up front.
  const activeItems = [...byId.values()].filter((n) => activeSet.has(n.uuid));
  requestSummaries(activeItems);
}

// recompute every edge path from current node positions
function redrawEdges() {
  for (const e of edgeList) {
    const p = nodePos.get(e.parentUuid);
    const c = nodePos.get(e.childUuid);
    if (!p || !c) continue;
    const my = (p.y + c.y) / 2;
    e.el.setAttribute("d", `M ${p.x} ${p.y} C ${p.x} ${my}, ${c.x} ${my}, ${c.x} ${c.y}`);
  }
}

function updateContentSize() {
  const b = computeBounds();
  els.svg.__contentSize = { w: b.w, h: b.h, x: b.x, y: b.y };
}

function computeBounds() {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of nodePos.values()) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  if (!isFinite(minX)) return { x: 0, y: 0, w: 200, h: 200 };
  const pad = 60;
  const labelRoom = 180; // space for right-side labels
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad + labelRoom,
    h: maxY - minY + pad * 2,
  };
}

// screen (client) coords -> graph content coords
function toGraph(clientX, clientY) {
  const r = els.wrap.getBoundingClientRect();
  return {
    x: (clientX - r.left - view.x) / view.k,
    y: (clientY - r.top - view.y) / view.k,
  };
}

// ---------- position persistence ----------

async function loadPositions(cid) {
  const o = await chrome.storage.local.get("positions");
  const all = o.positions || {};
  const m = new Map();
  for (const [u, p] of Object.entries(all[cid] || {})) m.set(u, p);
  return m;
}

async function savePositions() {
  const o = await chrome.storage.local.get("positions");
  const all = o.positions || {};
  const forConv = {};
  for (const [u, p] of posOverride) forConv[u] = p;
  all[convUuid] = forConv;
  await chrome.storage.local.set({ positions: all });
}

const summaryRequested = new Set(); // uuids we've already asked about

// Ask the background worker to summarize the given nodes (Haiku, cached per
// uuid). Updates permanent labels in place — no re-render, view preserved.
async function requestSummaries(nodes) {
  const items = nodes
    .filter((n) => !summaryRequested.has(n.uuid))
    .map((n) => ({ uuid: n.uuid, text: n.text, sender: n.sender }));
  if (items.length === 0) return;
  items.forEach((it) => summaryRequested.add(it.uuid));

  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: "SUMMARIZE", items });
  } catch (_) {
    return;
  }
  if (!resp || !resp.ok || !resp.titles) return;
  for (const [uuid, title] of Object.entries(resp.titles)) {
    if (!title) continue;
    summaries.set(uuid, title);
    // update the permanent (active) chip if present
    const chip = labelEls.get(uuid);
    if (chip) {
      chip.t.textContent = truncate(title);
      sizeChip(chip);
    }
    // update a currently-open hover chip too
    const g = nodeEls.get(uuid);
    const lbl = g && g.querySelector("g.label.hover");
    if (lbl) {
      const t = lbl.querySelector("text");
      const rect = lbl.querySelector("rect");
      t.textContent = truncate(title);
      sizeChip({ t, rect });
    }
  }
}

// The active lineage of a node: all ancestors up to the root, the node itself,
// then a single path down to a leaf — preferring claude's original active
// branch at each fork, otherwise the first child.
function computeLineage(node) {
  const set = new Set();
  let n = node;
  while (n && n.uuid !== "__root__") {
    set.add(n.uuid);
    n = n.__parentRef;
  }
  let d = node;
  while (d.children && d.children.length) {
    const next =
      d.children.find((c) => renderedActiveSet.has(c.uuid)) || d.children[0];
    set.add(next.uuid);
    d = next;
  }
  return set;
}

// Apply an active set to the DOM: toggle node/edge highlighting and move the
// permanent label chips onto exactly the active nodes.
function applyActivePath(activeSet) {
  for (const [uuid, g] of nodeEls) {
    const on = activeSet.has(uuid);
    g.classList.toggle("active", on);
    const hasChip = labelEls.has(uuid);
    if (on && !hasChip) {
      const hov = g.querySelector("g.label.hover");
      if (hov) hov.remove();
      const chip = makeChip(labelText(uuid, textByUuid.get(uuid)), false);
      g.appendChild(chip.g);
      labelEls.set(uuid, chip);
      sizeChip(chip);
    } else if (!on && hasChip) {
      labelEls.get(uuid).g.remove();
      labelEls.delete(uuid);
    }
  }
  for (const e of edgeList) {
    e.el.classList.toggle(
      "active",
      activeSet.has(e.parentUuid) && activeSet.has(e.childUuid)
    );
  }
}

function selectNode(node) {
  // toggle selection class (keep current pan/zoom)
  if (selectedUuid && nodeEls.has(selectedUuid))
    nodeEls.get(selectedUuid).classList.remove("selected");
  selectedUuid = node.uuid;
  if (nodeEls.has(selectedUuid))
    nodeEls.get(selectedUuid).classList.add("selected");

  // re-highlight the active path to run THROUGH the selected node: its ancestors
  // + itself + one branch down to a leaf. Everything else dims.
  applyActivePath(computeLineage(node));

  renderDetail(node);
  jumpToMessage(node);
}

// Fill the detail pane for a node (also re-run on language switch).
function renderDetail(node) {
  selectedNode = node;
  els.detail.hidden = false;
  els.detailSender.textContent =
    node.sender === "human" ? t("me") : assistantName(currentPlatform);
  els.detailSender.className = "badge " + node.sender;
  els.detailTime.textContent = node.createdAt
    ? new Date(node.createdAt).toLocaleString()
    : "";

  // Always show the parent turn for context: clicking an answer shows the
  // question above it; clicking a question shows the previous answer.
  const parent = node.__parentRef;
  if (
    parent &&
    parent.uuid !== "__root__" &&
    (parent.sender === "human" || parent.sender === "assistant")
  ) {
    els.detailQuestion.hidden = false;
    els.detailQuestion.className = parent.sender;
    els.detailQuestionLabel.textContent =
      parent.sender === "human"
        ? t("question")
        : t("prevAnswer")(assistantName(currentPlatform));
    els.detailQuestionText.innerHTML = parent.text
      ? mdToHtml(parent.text)
      : `<em>${t("emptyQ")}</em>`;
  } else {
    els.detailQuestion.hidden = true;
    els.detailQuestionText.innerHTML = "";
  }

  els.detailText.innerHTML = node.text
    ? mdToHtml(node.text)
    : `<em>${t("emptyMsg")}</em>`;
}

// Best-effort: ask the page to scroll to this message. Silent on failure —
// inactive branches aren't in the DOM, and that's expected, not an error.
async function jumpToMessage(node) {
  if (currentTabId == null) return;
  try {
    await chrome.tabs.sendMessage(currentTabId, {
      type: "SCROLL_TO_MESSAGE",
      uuid: node.uuid,
      text: node.text,
    });
  } catch (_) {
    /* no receiver / not scrollable — ignore */
  }
}

let toastTimer = null;
function toast(text) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

// ---------- pan / zoom ----------

function applyView() {
  const g = els.svg.__gRoot;
  if (g) g.setAttribute("transform", `translate(${view.x},${view.y}) scale(${view.k})`);
}

// "맞춤" button: fit the ENTIRE graph in view (may be tiny for huge trees —
// that's what the user asked for by pressing it).
function fitToScreen() {
  const size = els.svg.__contentSize;
  if (!size) return;
  const rect = els.wrap.getBoundingClientRect();
  const kx = rect.width / size.w;
  const ky = rect.height / size.h;
  view.k = Math.min(1, Math.min(kx, ky) * 0.9) || 1;
  view.x = -(size.x || 0) * view.k + (rect.width - size.w * view.k) / 2;
  view.y = -(size.y || 0) * view.k + 20;
  applyView();
}

// Initial view after a render: fit to WIDTH at a readable zoom (never shrink to
// an invisible speck), and anchor vertically to the current/latest message so a
// long, deep conversation opens where you actually are — not zoomed out to dust.
function initialView() {
  const size = els.svg.__contentSize;
  if (!size) return;
  const rect = els.wrap.getBoundingClientRect();
  const kx = rect.width / size.w;
  view.k = Math.max(0.4, Math.min(1, kx * 0.95)) || 1;
  view.x = -(size.x || 0) * view.k + (rect.width - size.w * view.k) / 2;

  const leaf = activeLeafUuid && nodePos.get(activeLeafUuid);
  if (leaf) {
    // place the latest message around 65% down the viewport
    view.y = rect.height * 0.65 - leaf.y * view.k;
  } else {
    view.y = -(size.y || 0) * view.k + 20;
  }
  applyView();
}

els.fit.addEventListener("click", fitToScreen);
els.detailClose.addEventListener("click", () => (els.detail.hidden = true));

// --- resizable detail pane ---
const detailResize = document.getElementById("detail-resize");
const detailMax = document.getElementById("detail-max");
let detailMaximized = false;

function setDetailHeight(px) {
  const h = Math.max(120, Math.min(window.innerHeight * 0.92, px));
  els.detail.style.height = h + "px";
}

detailResize.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const startY = e.clientY;
  const startH = els.detail.getBoundingClientRect().height;
  const onMove = (ev) => setDetailHeight(startH + (startY - ev.clientY)); // drag up → taller
  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    detailMaximized = false;
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
});

detailMax.addEventListener("click", () => {
  detailMaximized = !detailMaximized;
  setDetailHeight(detailMaximized ? window.innerHeight * 0.92 : window.innerHeight * 0.42);
  detailMax.textContent = detailMaximized ? "⤡" : "⤢";
});
document
  .getElementById("settings")
  .addEventListener("click", () => chrome.runtime.openOptionsPage());

// drag to pan
let dragging = false;
let start = { x: 0, y: 0 };
els.wrap.addEventListener("mousedown", (e) => {
  dragging = true;
  start = { x: e.clientX - view.x, y: e.clientY - view.y };
});
window.addEventListener("mousemove", (e) => {
  if (draggingNode) {
    const p = toGraph(e.clientX, e.clientY);
    const nx = p.x - draggingNode.grabX;
    const ny = p.y - draggingNode.grabY;
    const pos = nodePos.get(draggingNode.uuid);
    pos.x = nx;
    pos.y = ny;
    draggingNode.g.setAttribute("transform", `translate(${nx},${ny})`);
    draggingNode.moved = true;
    redrawEdges();
    return;
  }
  if (!dragging) return;
  view.x = e.clientX - start.x;
  view.y = e.clientY - start.y;
  applyView();
});
window.addEventListener("mouseup", () => {
  if (draggingNode) {
    if (draggingNode.moved) {
      posOverride.set(draggingNode.uuid, { ...nodePos.get(draggingNode.uuid) });
      suppressClick = true; // don't fire the click/jump after a drag
      updateContentSize();
      savePositions();
    }
    draggingNode = null;
    return;
  }
  dragging = false;
});

// wheel to zoom (around cursor)
els.wrap.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const rect = els.wrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newK = Math.max(0.2, Math.min(3, view.k * factor));
    view.x = mx - ((mx - view.x) / view.k) * newK;
    view.y = my - ((my - view.y) / view.k) * newK;
    view.k = newK;
    applyView();
  },
  { passive: false }
);

// ---------- reset layout ----------

async function resetLayout() {
  posOverride = new Map();
  await savePositions();
  if (lastConversation) render(lastConversation);
  toast(t("resetDone"));
}
document.getElementById("reset").addEventListener("click", resetLayout);

// ---------- export ----------

const EXPORT_CSS = `
  .edge { fill:none; stroke:#4a4a42; stroke-width:1.5; }
  .edge.active { stroke:#d97757; stroke-width:2.5; }
  .node circle { stroke-width:2; }
  .node.human circle { fill:#6a9bd8; stroke:#6a9bd8; }
  .node.assistant circle { fill:#d97757; stroke:#d97757; }
  .node:not(.active) circle { fill-opacity:0.35; }
  .node.active circle { stroke:#fff; }
  .node.branch circle { stroke:#e6b800; stroke-width:3; }
  .node .label rect { fill:#26261f; stroke:#4a4a42; stroke-width:1; }
  .node.human .label rect { stroke:#6a9bd8; }
  .node.assistant .label rect { stroke:#d97757; }
  .node.branch .label rect { stroke:#e6b800; }
  .node .label text { fill:#f2eee4; font-size:11px; font-family:-apple-system,Segoe UI,sans-serif; dominant-baseline:middle; }
`;

function buildExportSVG() {
  const b = computeBounds();
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("xmlns", SVGNS);
  svg.setAttribute("width", b.w);
  svg.setAttribute("height", b.h);
  svg.setAttribute("viewBox", `${b.x} ${b.y} ${b.w} ${b.h}`);

  const style = document.createElementNS(SVGNS, "style");
  style.textContent = EXPORT_CSS;

  const bg = document.createElementNS(SVGNS, "rect");
  bg.setAttribute("x", b.x);
  bg.setAttribute("y", b.y);
  bg.setAttribute("width", b.w);
  bg.setAttribute("height", b.h);
  bg.setAttribute("fill", "#1c1c1a");

  const edges = gEdgesRef.cloneNode(true);
  const nodes = gNodesRef.cloneNode(true);
  nodes.querySelectorAll("g.label.hover").forEach((n) => n.remove());

  svg.appendChild(style);
  svg.appendChild(bg);
  svg.appendChild(edges);
  svg.appendChild(nodes);
  return { svg, bounds: b };
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fileBase() {
  const id = (convUuid || "graph").slice(0, 8);
  return `claude-graph-${id}`;
}

function exportSVG() {
  if (!nodePos.size) return toast(t("nothingToExport"));
  const { svg } = buildExportSVG();
  const str = new XMLSerializer().serializeToString(svg);
  download(fileBase() + ".svg", new Blob([str], { type: "image/svg+xml" }));
}

function exportPNG() {
  if (!nodePos.size) return toast(t("nothingToExport"));
  const { svg, bounds } = buildExportSVG();
  const str = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([str], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const scale = 2; // retina-crisp
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bounds.w * scale));
    canvas.height = Math.max(1, Math.round(bounds.h * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#1c1c1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((bl) => {
      if (bl) download(fileBase() + ".png", bl);
      else toast(t("pngFail"));
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  img.onerror = () => {
    toast(t("pngFail"));
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// ---------- interactive HTML export ----------

// snapshot the current graph into plain data (positions, labels, full text)
function snapshot() {
  const parentOf = {};
  for (const e of edgeList) parentOf[e.childUuid] = e.parentUuid;
  const nodes = [];
  for (const [uuid, g] of nodeEls) {
    const cls = g.getAttribute("class") || "";
    const pos = nodePos.get(uuid);
    if (!pos) continue;
    const text = textByUuid.get(uuid) || "";
    nodes.push({
      uuid,
      parent: parentOf[uuid] || null,
      x: pos.x,
      y: pos.y,
      sender: cls.includes("human") ? "human" : "assistant",
      active: cls.includes("active"),
      branch: cls.includes("branch"),
      label:
        summaries.get(uuid) ||
        text.replace(/\s+/g, " ").slice(0, 22) ||
        "…",
      text,
    });
  }
  const edges = edgeList.map((e) => ({
    p: e.parentUuid,
    c: e.childUuid,
    active: e.active,
  }));
  return {
    nodes,
    edges,
    id: (convUuid || "").slice(0, 8),
    platform: currentPlatform,
    labels: {
      me: t("me"),
      question: t("question"),
      prevAnswer: t("prevAnswer")(assistantName(currentPlatform)),
      emptyMsg: t("emptyMsg"),
      emptyQ: t("emptyQ"),
      meta: t("stats")(nodes.length, nodes.filter((n) => n.branch).length),
    },
  };
}

function buildHTMLDoc() {
  const data = snapshot();
  // escape "<" so embedded JSON can't break out of the <script> tag
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Branch of Thought ${data.id}</title>
<style>
  :root{--bg:#1c1c1a;--panel:#26261f;--line:#4a4a42;--text:#f2eee4;--muted:#a09a8a;}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden;}
  #bar{position:fixed;top:0;left:0;right:0;height:40px;display:flex;align-items:center;gap:10px;padding:0 14px;background:var(--panel);border-bottom:1px solid var(--line);font-size:13px;z-index:5;}
  #bar b{font-weight:600;} #bar .m{color:var(--muted);font-size:12px;}
  #bar button{margin-left:auto;background:transparent;border:1px solid var(--line);color:var(--text);border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;}
  #wrap{position:absolute;top:40px;left:0;right:0;bottom:0;overflow:hidden;cursor:grab;} #wrap:active{cursor:grabbing;}
  svg{width:100%;height:100%;display:block;}
  .edge{fill:none;stroke:var(--line);stroke-width:1.5;} .edge.active{stroke:#d97757;stroke-width:2.5;}
  .node{cursor:pointer;} .node circle{stroke-width:2;}
  .node.human circle{fill:#6a9bd8;stroke:#6a9bd8;} .node.assistant circle{fill:#d97757;stroke:#d97757;}
  .node:not(.active) circle{fill-opacity:.35;} .node.active circle{stroke:#fff;}
  .node.branch circle{stroke:#e6b800;stroke-width:3;}
  .node .label{pointer-events:none;}
  .node .label rect{fill:#26261f;stroke:var(--line);stroke-width:1;}
  .node.human .label rect{stroke:#6a9bd8;} .node.assistant .label rect{stroke:#d97757;} .node.branch .label rect{stroke:#e6b800;}
  .node .label text{fill:var(--text);font-size:11px;dominant-baseline:middle;}
  #detail{position:fixed;left:10px;right:10px;bottom:10px;max-height:42%;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px;overflow:auto;display:none;box-shadow:0 6px 24px rgba(0,0,0,.4);}
  #detail .h{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
  .badge{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;}
  .badge.human{background:#6a9bd8;color:#08131f;} .badge.assistant{background:#d97757;color:#1c0d06;}
  #detail .h span.t{color:var(--muted);font-size:11px;flex:1;}
  #dquestion{margin-bottom:10px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;}
  #dquestion.human{background:rgba(106,155,216,.1);border-color:rgba(106,155,216,.4);}
  #dquestion.human .ql{color:#6a9bd8;}
  #dquestion.assistant{background:rgba(217,119,87,.1);border-color:rgba(217,119,87,.4);}
  #dquestion.assistant .ql{color:#d97757;}
  #dquestion .ql{font-size:10px;font-weight:700;letter-spacing:.04em;margin-bottom:4px;}
  #dquestion .md{font-size:12px;color:var(--muted);}
  #detail button{background:transparent;border:none;color:var(--muted);cursor:pointer;font-size:14px;}
  .md{font-size:13px;line-height:1.55;color:var(--text);word-break:break-word;}
  .md p{margin:0 0 8px;} .md h1,.md h2,.md h3,.md h4{margin:12px 0 6px;line-height:1.3;}
  .md h1{font-size:17px;} .md h2{font-size:15px;} .md h3{font-size:14px;}
  .md ul,.md ol{margin:0 0 8px;padding-left:20px;} .md li{margin:2px 0;}
  .md code{background:#1c1c1a;border:1px solid var(--line);border-radius:4px;padding:1px 4px;font-family:ui-monospace,Menlo,monospace;font-size:12px;}
  .md pre.code{background:#1c1c1a;border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow:auto;margin:0 0 8px;}
  .md pre.code code{background:none;border:none;padding:0;white-space:pre;}
  .md blockquote{margin:0 0 8px;padding:2px 10px;border-left:3px solid var(--line);color:var(--muted);}
  .md a{color:#d97757;} .md hr{border:none;border-top:1px solid var(--line);margin:10px 0;} .md strong{font-weight:700;}
</style>
</head>
<body>
<div id="bar"><b>Branch of Thought</b> <span class="m" id="meta"></span><button id="fit">⤢</button></div>
<div id="wrap"><svg id="g" xmlns="http://www.w3.org/2000/svg"></svg></div>
<div id="detail"><div class="h"><span class="badge" id="dsender"></span><span class="t" id="dtime"></span><button id="dclose">✕</button></div><div id="dquestion" hidden><div class="ql" id="dql"></div><div id="dqtext" class="md"></div></div><div id="dtext" class="md"></div>
<script>
const DATA=${json};
${mdToHtml.toString()}
const SVGNS="http://www.w3.org/2000/svg";
const svg=document.getElementById("g");
const gRoot=document.createElementNS(SVGNS,"g");
const gE=document.createElementNS(SVGNS,"g"),gN=document.createElementNS(SVGNS,"g");
gRoot.appendChild(gE);gRoot.appendChild(gN);svg.appendChild(gRoot);
const pos={};DATA.nodes.forEach(n=>pos[n.uuid]=n);
DATA.edges.forEach(e=>{const p=pos[e.p],c=pos[e.c];if(!p||!c)return;const my=(p.y+c.y)/2;const path=document.createElementNS(SVGNS,"path");path.setAttribute("class","edge"+(e.active?" active":""));path.setAttribute("d","M "+p.x+" "+p.y+" C "+p.x+" "+my+", "+c.x+" "+my+", "+c.x+" "+c.y);gE.appendChild(path);});
DATA.nodes.forEach(n=>{const g=document.createElementNS(SVGNS,"g");g.setAttribute("class","node "+n.sender+(n.active?" active":"")+(n.branch?" branch":""));g.setAttribute("transform","translate("+n.x+","+n.y+")");const c=document.createElementNS(SVGNS,"circle");c.setAttribute("r",n.branch?9:7);g.appendChild(c);
function chip(text,hover){const gl=document.createElementNS(SVGNS,"g");gl.setAttribute("class","label"+(hover?" hover":""));gl.setAttribute("transform","translate(14,0)");const r=document.createElementNS(SVGNS,"rect");r.setAttribute("rx",5);r.setAttribute("ry",5);r.setAttribute("x",0);r.setAttribute("y",-10);r.setAttribute("height",20);r.setAttribute("width",16);const t=document.createElementNS(SVGNS,"text");t.setAttribute("x",8);t.setAttribute("y",0);t.textContent=text;gl.appendChild(r);gl.appendChild(t);return {gl:gl,r:r,t:t};}
var CHIP_MAX_W=130;function measureT(t){try{return t.getComputedTextLength();}catch(e){return (t.textContent||"").length*6.5;}}
function sizeChip(o){var t=o.t;var w=measureT(t);if(w>CHIP_MAX_W){var full=(t.textContent||"").replace(/…$/,"");var s=full;while(s.length>1&&measureT(t)>CHIP_MAX_W){s=s.slice(0,-1);t.textContent=s+"…";}w=measureT(t);}o.r.setAttribute("width",Math.max(16,Math.round(Math.min(w,CHIP_MAX_W)+16)));}
if(n.active){const o=chip(n.label,false);g.appendChild(o.gl);n.__chip=o;}
else{g.addEventListener("mouseenter",()=>{if(g.querySelector("g.label"))return;const o=chip(n.label,true);g.appendChild(o.gl);sizeChip(o);gN.appendChild(g);});g.addEventListener("mouseleave",()=>{const l=g.querySelector("g.label");if(l)l.remove();});}
g.addEventListener("click",ev=>{ev.stopPropagation();showDetail(n);});gN.appendChild(g);if(n.__chip)sizeChip(n.__chip);});
var AINAME=DATA.platform==="chatgpt"?"ChatGPT":DATA.platform==="gemini"?"Gemini":"Claude";
var L=DATA.labels||{me:"You",question:"Question",prevAnswer:"Previous answer",emptyMsg:"(empty message)",emptyQ:"(no content)"};
function showDetail(n){document.getElementById("detail").style.display="block";const s=document.getElementById("dsender");s.textContent=n.sender==="human"?L.me:AINAME;s.className="badge "+n.sender;const q=document.getElementById("dquestion");const par=n.parent?pos[n.parent]:null;if(par&&(par.sender==="human"||par.sender==="assistant")){q.hidden=false;q.className=par.sender;document.getElementById("dql").textContent=par.sender==="human"?L.question:L.prevAnswer;document.getElementById("dqtext").innerHTML=par.text?mdToHtml(par.text):"<em>"+L.emptyQ+"</em>";}else{q.hidden=true;}document.getElementById("dtext").innerHTML=n.text?mdToHtml(n.text):"<em>"+L.emptyMsg+"</em>";}
document.getElementById("dclose").onclick=()=>document.getElementById("detail").style.display="none";
document.getElementById("meta").textContent=(DATA.labels&&DATA.labels.meta)||(DATA.nodes.length+" nodes");
let view={x:0,y:0,k:1};function apply(){gRoot.setAttribute("transform","translate("+view.x+","+view.y+") scale("+view.k+")");}
function bounds(){let a=1e9,b=1e9,c=-1e9,d=-1e9;DATA.nodes.forEach(n=>{a=Math.min(a,n.x);b=Math.min(b,n.y);c=Math.max(c,n.x);d=Math.max(d,n.y);});if(a>1e8)return{x:0,y:0,w:200,h:200};const P=60;return{x:a-P,y:b-P,w:c-a+P+180,h:d-b+P*2};}
function fit(){const B=bounds();const r=document.getElementById("wrap").getBoundingClientRect();view.k=Math.min(1,Math.min(r.width/B.w,r.height/B.h)*.9)||1;view.x=-B.x*view.k+(r.width-B.w*view.k)/2;view.y=-B.y*view.k+20;apply();}
document.getElementById("fit").onclick=fit;
let drag=false,st={x:0,y:0};const wrap=document.getElementById("wrap");
wrap.addEventListener("mousedown",e=>{drag=true;st={x:e.clientX-view.x,y:e.clientY-view.y};});
window.addEventListener("mousemove",e=>{if(!drag)return;view.x=e.clientX-st.x;view.y=e.clientY-st.y;apply();});
window.addEventListener("mouseup",()=>drag=false);
wrap.addEventListener("wheel",e=>{e.preventDefault();const r=wrap.getBoundingClientRect();const mx=e.clientX-r.left,my=e.clientY-r.top;const f=e.deltaY<0?1.1:1/1.1;const k=Math.max(.2,Math.min(3,view.k*f));view.x=mx-((mx-view.x)/view.k)*k;view.y=my-((my-view.y)/view.k)*k;view.k=k;apply();},{passive:false});
fit();
<\/script>
</body>
</html>`;
}

function exportHTML() {
  if (!nodePos.size) return toast(t("nothingToExport"));
  const doc = buildHTMLDoc();
  download(fileBase() + ".html", new Blob([doc], { type: "text/html" }));
}

// export dropdown
const exportMenu = document.getElementById("export-menu");
document.getElementById("export-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  exportMenu.hidden = !exportMenu.hidden;
});
document.addEventListener("click", () => (exportMenu.hidden = true));

function menuItem(id, fn) {
  document.getElementById(id).addEventListener("click", () => {
    exportMenu.hidden = true;
    fn();
  });
}
menuItem("export-png", exportPNG);
menuItem("export-svg", exportSVG);
menuItem("export-html", exportHTML);

init();
