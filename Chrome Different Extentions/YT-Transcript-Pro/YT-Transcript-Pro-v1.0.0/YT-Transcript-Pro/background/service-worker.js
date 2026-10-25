/* Background worker: saves files via chrome.downloads and relays the keyboard command. Stays idle otherwise. */
const KEY = "ytTranscriptPro";
const revealIds = new Set();

const cleanPart = (part) => String(part).replace(/[<>:"|?*\u0000-\u001f]/g, "-").replace(/^\.+/, "").trim();
function buildPath(folder, name) {
  const parts = String(folder || "").replace(/\\/g, "/").split("/").map(cleanPart).filter((p) => p && p !== "..");
  return [...parts, cleanPart(name) || "transcript.txt"].join("/");
}
function toDataUrl(text, mime, bom) {
  const bytes = new TextEncoder().encode((bom ? "\ufeff" : "") + text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ytp:download") {
    (async () => {
      try {
        const stored = (await chrome.storage.local.get(KEY))[KEY] || {};
        const id = await chrome.downloads.download({
          url: toDataUrl(msg.content, msg.mime, msg.bom),
          filename: buildPath(stored.downloadFolder, msg.filename),
          saveAs: Boolean(stored.saveAs),
          conflictAction: stored.conflictAction || "uniquify"
        });
        if (stored.revealAfterDownload && id != null) revealIds.add(id);
        sendResponse({ ok: true, id });
      } catch (error) {
        // "Download canceled by the user" happens when the Save As dialog is dismissed.
        sendResponse({ ok: false, error: String(error?.message || error) });
      }
    })();
    return true;
  }
  if (msg?.type === "ytp:openOptions") { chrome.runtime.openOptionsPage(); sendResponse({ ok: true }); }
  return false;
});

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state?.current === "complete" && revealIds.has(delta.id)) {
    revealIds.delete(delta.id);
    chrome.downloads.show(delta.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-panel") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id != null) chrome.tabs.sendMessage(tab.id, { type: "ytp:action", action: "toggle" }).catch(() => {});
});
