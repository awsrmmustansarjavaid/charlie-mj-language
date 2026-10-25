/*
 * Charlie MJ Language - shared transcript scroll controller (v2.0.0).
 *
 * One implementation for the three transcript windows: Transcript, Dual Transcript and YT Transcript Pro.
 *
 *  - Time driven following: when the active line changes while the video PLAYS, the list moves to it.
 *  - Never moves by itself while the video is PAUSED.
 *  - A seek (timeline click, line click, replay) always re-syncs the list, paused or not.
 *  - Manual scrolling (wheel, touch, scrollbar drag, keys) holds following for a while, then catches up
 *    when the video is playing.
 *  - Only the nearest scrolling container is moved. scrollIntoView() is never used because it also scrolls
 *    the YouTube page and every other ancestor.
 *
 * Settings live in the main Charlie MJ settings object (Settings > Subtitles & Timeline > Transcript Windows Scroll).
 */
(() => {
  "use strict";
  if (window.CMJScroll) return;

  const num = (v, d) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : d);
  const fromSettings = (s = {}) => ({
    enabled: (s.transcriptScrollEnabled ?? s.liveTranscriptAutoScroll) !== false,
    transcript: s.transcriptScrollTranscript !== false,
    dual: s.transcriptScrollDual !== false,
    pro: s.transcriptScrollPro !== false,
    position: s.transcriptScrollPosition || s.liveTranscriptScrollPosition || "center",
    behavior: s.transcriptScrollBehavior === "instant" ? "instant" : "smooth",
    respectManual: (s.transcriptScrollRespectManual ?? s.liveTranscriptRespectManualScroll) !== false,
    resumeSec: Math.max(0, num(s.transcriptScrollResumeSec, 5)),
    onSeek: s.transcriptScrollOnSeek !== false
  });
  let cfg = fromSettings({});
  const alive = () => { try { return Boolean(chrome.runtime?.id); } catch { return false; } };
  try {
    chrome.storage.local.get("settings").then((r) => { cfg = fromSettings(r.settings); }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings) cfg = fromSettings(changes.settings.newValue || {});
    });
  } catch { /* extension context not available */ }

  /** Nearest ancestor that really scrolls. The list itself, or an outer panel body, depending on layout. */
  function scroller(el) {
    for (let n = el && el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY;
      if ((o === "auto" || o === "scroll" || o === "overlay") && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return null;
  }

  function targetTop(sc, row, position) {
    const sr = sc.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const rowTop = rr.top - sr.top + sc.scrollTop - sc.clientTop;
    let top;
    if (position === "top") top = rowTop - 8;
    else if (position === "bottom") top = rowTop - sc.clientHeight + rr.height + 8;
    else top = rowTop - (sc.clientHeight - rr.height) / 2;
    return Math.max(0, Math.min(Math.max(0, sc.scrollHeight - sc.clientHeight), Math.round(top)));
  }

  /**
   * key: "transcript" | "dual" | "pro"
   * getVideo():     the <video>
   * getActiveRow(): sync the highlight with video.currentTime and return the active row element (or null)
   * extraAllowed(): optional extra gate, e.g. the Pro tab's own Auto-scroll switch
   */
  function create({ key, getVideo, getActiveRow, extraAllowed }) {
    let holdUntil = 0, progUntil = 0, resumeTimer = 0, videoBound = null;
    const bound = new WeakSet();
    const allowed = () => cfg.enabled && cfg[key] !== false && (!extraAllowed || extraAllowed() !== false);

    function userMoved() {
      if (!cfg.respectManual) return;
      holdUntil = cfg.resumeSec > 0 ? Date.now() + cfg.resumeSec * 1000 : Infinity;
      clearTimeout(resumeTimer);
      if (cfg.resumeSec > 0) resumeTimer = setTimeout(catchUp, cfg.resumeSec * 1000 + 40);
    }

    /** Watch real user input on one element (the list, or the container that actually scrolls). */
    function bindEl(el) {
      if (!el || bound.has(el)) return;
      bound.add(el);
      el.addEventListener("wheel", userMoved, { passive: true });
      el.addEventListener("touchmove", userMoved, { passive: true });
      el.addEventListener("keydown", (e) => { if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(e.key)) userMoved(); }, true);
      // A press on the scroll container itself (not on a row) is a scrollbar drag.
      el.addEventListener("pointerdown", (e) => { if (e.target === el) userMoved(); }, { passive: true });
      // Scrolling that we did not start (scrollbar, keyboard, middle-click drag).
      el.addEventListener("scroll", () => { if (Date.now() > progUntil) userMoved(); }, { passive: true });
    }
    function bind(list) {
      if (!list) return;
      bindEl(list);
      bindEl(scroller(list.firstElementChild || list));
      bindVideo();
    }

    function bindVideo() {
      const v = getVideo && getVideo();
      if (!v || v === videoBound) return;
      videoBound = v;
      const resync = () => {
        if (!allowed() || !cfg.onSeek) { getActiveRow(); return; }
        const row = getActiveRow();
        if (row) follow(row, { hard: true });
      };
      v.addEventListener("seeking", resync);
      v.addEventListener("seeked", resync);
      v.addEventListener("play", () => { holdUntil = 0; catchUp(); });
    }

    /** Hold expired (or Play pressed): move to the line that is active now, only while playing. */
    function catchUp() {
      if (!allowed()) return;
      const row = getActiveRow();
      if (row) follow(row, { hard: false });
    }

    /**
     * hard=false: time-driven. Never while paused, never during a manual hold.
     * hard=true:  seek / click / open / first show. Ignores pause and hold.
     */
    function follow(row, { hard = false, instant = false } = {}) {
      if (!allowed() || !row || !row.isConnected) return false;
      bindVideo();
      const v = getVideo && getVideo();
      if (!hard) {
        if (v && v.paused) return false;
        if (cfg.respectManual && Date.now() < holdUntil) return false;
      } else {
        holdUntil = 0;
        clearTimeout(resumeTimer);
      }
      const sc = scroller(row);
      if (!sc) return false;
      bindEl(sc);
      const top = targetTop(sc, row, cfg.position);
      const dist = Math.abs(top - sc.scrollTop);
      if (dist < 2) return false;
      const smooth = !instant && cfg.behavior !== "instant" && dist < sc.clientHeight * 4;
      progUntil = Date.now() + (smooth ? 1100 : 250);
      sc.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });
      return true;
    }

    return { bind, bindVideo, follow, catchUp, userMoved, holdNow: () => Date.now() < holdUntil };
  }

  window.CMJScroll = { create, scroller, config: () => ({ ...cfg }) };
})();
