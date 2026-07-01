// Runs in the MAIN world so it can patch the same window.fetch / XMLHttpRequest
// that each chat app uses. When a conversation response goes by, we normalize it
// to a common shape and forward it to the ISOLATED-world content script via a
// CustomEvent (as a string, to avoid cross-world object access issues).
//
// Common shape:
//   { uuid, platform, current_leaf_message_uuid,
//     chat_messages: [{ uuid, parent_message_uuid, sender, text, index, created_at }] }
// where sender is "human" | "assistant".

(function () {
  const EVENT = "claude-graph-data";
  const HOST = location.hostname;

  // ---------- normalizers ----------

  function claudeText(m) {
    if (typeof m.text === "string" && m.text.trim()) return m.text;
    if (Array.isArray(m.content)) {
      return m.content
        .map((b) => (b && typeof b.text === "string" ? b.text : ""))
        .join("")
        .trim();
    }
    return "";
  }

  function normalizeClaude(json) {
    if (!Array.isArray(json.chat_messages)) return null;
    return {
      uuid: json.uuid,
      platform: "claude",
      current_leaf_message_uuid: json.current_leaf_message_uuid,
      chat_messages: json.chat_messages.map((m) => ({
        uuid: m.uuid,
        parent_message_uuid: m.parent_message_uuid,
        sender: m.sender === "human" ? "human" : "assistant",
        index: typeof m.index === "number" ? m.index : null,
        created_at: m.created_at || "",
        text: claudeText(m),
      })),
    };
  }

  // ChatGPT: /backend-api/conversation/{id} returns a `mapping` of node_id ->
  // { id, message, parent, children } forming the branch tree, plus current_node.
  function normalizeChatGPT(json) {
    const mapping = json.mapping;
    if (!mapping || typeof mapping !== "object") return null;

    const included = new Map(); // id -> { rawParent, role, text, ct }
    for (const id in mapping) {
      const node = mapping[id];
      if (!node) continue;
      const m = node.message;
      if (!m || !m.author) continue;
      const role = m.author.role;
      if (role !== "user" && role !== "assistant") continue; // skip system/tool
      const meta = m.metadata || {};
      if (meta.is_visually_hidden_from_conversation) continue; // hidden helpers
      if (m.recipient && m.recipient !== "all") continue; // tool-call routes
      const c = m.content || {};
      // Skip non-answer content: reasoning ("thoughts"), reasoning_recap, tool
      // code/output, etc. Only plain visible text is a real graph node.
      const ctype = c.content_type;
      if (ctype && ctype !== "text" && ctype !== "multimodal_text") continue;
      let text = "";
      if (Array.isArray(c.parts))
        text = c.parts.filter((p) => typeof p === "string").join("\n").trim();
      else if (typeof c.text === "string") text = c.text.trim();
      // an assistant node with no visible text is a thinking/placeholder step
      if (role === "assistant" && !text) continue;
      included.set(id, { rawParent: node.parent, role, text, ct: m.create_time });
    }
    if (included.size === 0) return null;

    // re-link each node to its nearest included ancestor (skipping system/tool)
    const nearest = (p) => {
      let guard = 0;
      while (p && guard++ < 100000) {
        if (included.has(p)) return p;
        p = mapping[p] ? mapping[p].parent : null;
      }
      return null;
    };

    const chat_messages = [];
    for (const [id, info] of included) {
      chat_messages.push({
        uuid: id,
        parent_message_uuid: nearest(info.rawParent),
        sender: info.role === "user" ? "human" : "assistant",
        index: null,
        created_at: info.ct ? new Date(info.ct * 1000).toISOString() : "",
        text: info.text,
      });
    }

    let leaf = json.current_node;
    let guard = 0;
    while (leaf && !included.has(leaf) && guard++ < 100000) {
      leaf = mapping[leaf] ? mapping[leaf].parent : null;
    }

    return {
      uuid: json.conversation_id || json.id,
      platform: "chatgpt",
      current_leaf_message_uuid: leaf || null,
      chat_messages,
    };
  }

  function normalize(json) {
    try {
      if (json && Array.isArray(json.chat_messages)) return normalizeClaude(json);
      if (json && json.mapping && ("current_node" in json || "conversation_id" in json))
        return normalizeChatGPT(json);
    } catch (_) {}
    return null;
  }

  function ok(conv) {
    return conv && Array.isArray(conv.chat_messages) && conv.chat_messages.length > 0;
  }

  // ---------- emit ----------

  let lastSig = null;
  function emit(url, rawJson) {
    try {
      const conv = normalize(rawJson);
      if (!ok(conv)) return;
      const sig =
        (conv.uuid || "") +
        "|" +
        conv.chat_messages.length +
        "|" +
        (conv.current_leaf_message_uuid || "");
      if (sig === lastSig) return;
      lastSig = sig;
      const payload = JSON.stringify({ url: String(url), conversation: conv });
      console.debug(
        "[Branch of Thought]",
        conv.platform,
        "captured:",
        conv.chat_messages.length,
        "messages,",
        Math.round(payload.length / 1024),
        "KB"
      );
      window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }));
    } catch (e) {
      console.warn("[Branch of Thought] emit failed:", e);
    }
  }

  // Which response URLs are worth parsing on this host.
  function isConvUrl(url) {
    if (!url) return false;
    if (/claude\.ai/.test(HOST)) return /\/api\//.test(url);
    if (/chatgpt\.com|openai\.com/.test(HOST))
      return /\/backend-api\/conversation\/[0-9a-f-]/i.test(url);
    if (/gemini\.google\.com/.test(HOST)) return /batchexecute/.test(url);
    return /\/api\//.test(url);
  }

  // Gemini uses an obfuscated batchexecute RPC (nested arrays, no stable schema),
  // so we can't reliably reconstruct its branch tree yet.
  if (/gemini\.google\.com/.test(HOST)) {
    console.debug(
      "[Branch of Thought] Gemini is not supported yet (obfuscated batchexecute API)."
    );
  }

  // ---------- proactive tree fetch ----------
  // A brand-new chat streams its reply but never GETs the tree, so there's
  // nothing for us to intercept. We watch for sends / navigation and fetch the
  // tree ourselves.
  let orgId = null;
  function noteOrg(url) {
    const m = /\/api\/organizations\/([0-9a-f-]{6,})/i.exec(url || "");
    if (m) orgId = m[1];
  }
  function currentConvId() {
    if (/claude\.ai/.test(HOST)) {
      const m = /\/chat\/([0-9a-f-]{6,})/i.exec(location.pathname);
      return m ? m[1] : null;
    }
    if (/chatgpt\.com|openai\.com/.test(HOST)) {
      const m = /\/c\/([0-9a-f-]{6,})/i.exec(location.pathname);
      return m ? m[1] : null;
    }
    return null;
  }
  function treeUrl(convId) {
    if (!convId) return null;
    if (/claude\.ai/.test(HOST)) {
      if (!orgId) return null;
      return (
        location.origin +
        "/api/organizations/" + orgId + "/chat_conversations/" + convId +
        "?tree=True&rendering_mode=messages&render_all_tools=false"
      );
    }
    if (/chatgpt\.com|openai\.com/.test(HOST)) {
      return location.origin + "/backend-api/conversation/" + convId;
    }
    return null;
  }

  // ---------- patch fetch ----------
  const origFetch = window.fetch;

  // ChatGPT's /backend-api needs a Bearer access token, not just cookies. The
  // app only GETs a conversation's tree when you *open* an existing chat, so a
  // brand-new chat is never re-fetched for us to intercept — we have to fetch it
  // ourselves, which means we need the token. Grab it (cached) from the
  // same-origin NextAuth session endpoint.
  let cgptToken = null;
  async function refetchHeaders() {
    const h = { accept: "application/json" };
    if (/chatgpt\.com|openai\.com/.test(HOST)) {
      if (!cgptToken) {
        try {
          const s = await origFetch(location.origin + "/api/auth/session", {
            credentials: "include",
          }).then((r) => (r && r.ok ? r.json() : null));
          if (s && s.accessToken) cgptToken = s.accessToken;
        } catch (_) {}
      }
      if (cgptToken) h.authorization = "Bearer " + cgptToken;
    }
    return h;
  }

  // Fetch the tree ourselves and emit it. Retried a few times so a reply that's
  // still streaming gets picked up once it's saved.
  async function fireRefetch(explicitId) {
    const url = treeUrl(explicitId || currentConvId());
    if (!url) return;
    try {
      const headers = await refetchHeaders();
      const r = await origFetch(url, { credentials: "include", headers });
      if (r && r.ok) {
        const j = await r.json();
        if (j) emit(url, j);
      } else if (r && (r.status === 401 || r.status === 403)) {
        cgptToken = null; // stale token → refresh on next try
      }
    } catch (_) {}
  }
  function scheduleRefetch(explicitId) {
    [600, 1500, 3000, 6000].forEach((d) =>
      setTimeout(() => fireRefetch(explicitId), d)
    );
  }

  window.fetch = function (...args) {
    const p = origFetch.apply(this, args);
    p.then((res) => {
      try {
        const url =
          (args[0] && args[0].url) || (typeof args[0] === "string" ? args[0] : res.url);
        noteOrg(url);
        // a message was just sent → pull the fresh tree
        const claudeSend = /chat_conversations\/([0-9a-f-]+)\/completion/.exec(url || "");
        if (claudeSend) scheduleRefetch(claudeSend[1]);
        else if (/\/backend-api\/(f\/)?conversation$/.test(url || "")) scheduleRefetch();
        if (!isConvUrl(url)) return;
        const ct = (res.headers && res.headers.get && res.headers.get("content-type")) || "";
        if (!/json/i.test(ct)) return;
        res
          .clone()
          .json()
          .then((json) => emit(url, json))
          .catch(() => {});
      } catch (_) {}
    }).catch(() => {});
    return p;
  };

  // ---------- patch XMLHttpRequest (fallback) ----------
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__cg_url = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      try {
        const url = this.__cg_url || "";
        noteOrg(url);
        if (!isConvUrl(url)) return;
        const rt = this.responseType;
        if (rt !== "" && rt !== "text") return;
        const ct =
          (this.getResponseHeader && this.getResponseHeader("content-type")) || "";
        if (!/json/i.test(ct)) return;
        emit(url, JSON.parse(this.responseText));
      } catch (_) {}
    });
    return origSend.apply(this, args);
  };

  // React to SPA navigation (opening or creating a conversation).
  function onNav() {
    scheduleRefetch();
  }
  const hp = history.pushState;
  const hr = history.replaceState;
  history.pushState = function (...a) {
    const r = hp.apply(this, a);
    setTimeout(onNav, 0);
    return r;
  };
  history.replaceState = function (...a) {
    const r = hr.apply(this, a);
    setTimeout(onNav, 0);
    return r;
  };
  window.addEventListener("popstate", onNav);
  setTimeout(onNav, 500); // first load

  // Catch-all: some SPA routers (Next.js on ChatGPT) route without going through
  // our history monkeypatch, so poll the URL for conversation-id changes too.
  // Fires a refetch the moment a brand-new chat gets its /c/{id} or /chat/{id}.
  let lastConvSeen = currentConvId();
  setInterval(() => {
    const id = currentConvId();
    if (id && id !== lastConvSeen) {
      lastConvSeen = id;
      scheduleRefetch(id);
    } else if (!id && lastConvSeen) {
      lastConvSeen = null;
    }
  }, 800);

  console.debug("[Branch of Thought] interceptor installed on", HOST);
})();
