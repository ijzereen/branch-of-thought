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
      const c = m.content || {};
      let text = "";
      if (Array.isArray(c.parts))
        text = c.parts.filter((p) => typeof p === "string").join("\n").trim();
      else if (typeof c.text === "string") text = c.text.trim();
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

  // ---------- patch fetch ----------
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const p = origFetch.apply(this, args);
    p.then((res) => {
      try {
        const url =
          (args[0] && args[0].url) || (typeof args[0] === "string" ? args[0] : res.url);
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

  console.debug("[Branch of Thought] interceptor installed on", HOST);
})();
