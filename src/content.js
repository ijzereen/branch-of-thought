// Runs in the ISOLATED world. Listens for the CustomEvent emitted by the
// MAIN-world interceptor and relays the conversation JSON to the extension
// (background + any open side panel) via chrome.runtime messaging.

(function () {
  const EVENT = "claude-graph-data";

  // Panel asks us to scroll the claude.ai page to a given message.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "SCROLL_TO_MESSAGE") {
      sendResponse({ ok: scrollToMessage(msg.uuid, msg.text) });
    }
  });

  function scrollToMessage(uuid, text) {
    let el = null;

    // 1) try attribute-based selectors that may carry the uuid
    if (uuid) {
      const sels = [
        `[data-message-id="${uuid}"]`,
        `[data-uuid="${uuid}"]`,
        `[data-testid="${uuid}"]`,
        `#${CSS.escape(uuid)}`,
      ];
      for (const s of sels) {
        try {
          const found = document.querySelector(s);
          if (found) { el = found; break; }
        } catch (_) {}
      }
    }

    // 2) fall back to matching the rendered message text (works for the
    //    currently-active branch, which is what the DOM contains)
    if (!el && text) {
      const needle = text.replace(/\s+/g, " ").trim().slice(0, 40);
      if (needle.length >= 6) {
        const candidates = document.querySelectorAll(
          "div[data-test-render-count] , [data-testid='chat-message'], p, div"
        );
        for (const c of candidates) {
          const t = (c.textContent || "").replace(/\s+/g, " ");
          if (t.includes(needle)) {
            // prefer the tightest wrapper
            el = c;
            break;
          }
        }
      }
    }

    if (!el) return false;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prev = el.style.outline;
    el.style.outline = "3px solid #d97757";
    el.style.outlineOffset = "4px";
    el.style.borderRadius = "6px";
    setTimeout(() => { el.style.outline = prev; }, 1600);
    return true;
  }

  window.addEventListener(EVENT, (e) => {
    let parsed;
    try {
      parsed = JSON.parse(e.detail);
    } catch (_) {
      return;
    }
    try {
      chrome.runtime.sendMessage(
        {
          type: "CLAUDE_TREE",
          url: parsed.url,
          conversation: parsed.conversation,
          pageUrl: location.href,
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(
              "[Branch of Thought] sendMessage failed:",
              chrome.runtime.lastError.message
            );
          }
        }
      );
    } catch (e) {
      console.warn("[Branch of Thought] relay failed:", e);
    }
  });
})();
