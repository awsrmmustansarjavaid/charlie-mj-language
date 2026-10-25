/* Language labels and automatic track selection. */
(() => {
  const root = window.YTP = window.YTP || {};
  let names;
  root.languageLabel = (code) => {
    try { names = names || new Intl.DisplayNames([navigator.language || "en"], { type: "language" }); return names.of(code) || code; }
    catch { return code; }
  };
  root.getTrackLabel = (track) => `${track.name || root.languageLabel(track.languageCode)}${track.kind === "asr" && !/auto/i.test(track.name) ? " (auto-generated)" : ""}`;

  /** Pick the best source track: remembered > preferred list > any manual > first. Manual beats auto-generated. */
  root.pickSourceTrack = (tracks, settings) => {
    const base = (c) => String(c || "").toLowerCase().split("-")[0];
    const wanted = [];
    if (settings.rememberLanguages && settings.sourceLanguage) wanted.push(settings.sourceLanguage);
    String(settings.preferredLanguages || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((c) => wanted.push(c));
    for (const code of wanted) {
      const exact = tracks.filter((t) => t.languageCode.toLowerCase() === code.toLowerCase());
      const loose = tracks.filter((t) => base(t.languageCode) === base(code));
      const pool = exact.length ? exact : loose;
      if (pool.length) return pool.find((t) => t.kind !== "asr") || pool[0];
    }
    return tracks.find((t) => t.kind !== "asr") || tracks[0];
  };
})();
