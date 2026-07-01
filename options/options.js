const els = {
  key: document.getElementById("key"),
  model: document.getElementById("model"),
  enabled: document.getElementById("enabled"),
  save: document.getElementById("save"),
  status: document.getElementById("status"),
};

async function load() {
  const cfg = await chrome.storage.local.get([
    "apiKey",
    "summaryModel",
    "summaryEnabled",
  ]);
  els.key.value = cfg.apiKey || "";
  els.model.value = cfg.summaryModel || "claude-haiku-4-5-20251001";
  els.enabled.checked = cfg.summaryEnabled !== false; // default on
}

els.save.addEventListener("click", async () => {
  await chrome.storage.local.set({
    apiKey: els.key.value.trim(),
    summaryModel: els.model.value,
    summaryEnabled: els.enabled.checked,
  });
  els.status.textContent = "Saved ✓";
  setTimeout(() => (els.status.textContent = ""), 1500);
});

load();
