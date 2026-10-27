/*
 * Charlie MJ Dual Transcript settings.
 * ADDITIVE ONLY: existing settings remain compatible; new language/service
 * settings use separate fields/namespaces and fall back to current defaults.
 */
(() => {
  'use strict';
  const KEY = 'cmjDualTranscriptSettings';
  const SERVICE_KEY = 'cmjDualYouTubeServiceSettings';
  const CATALOG_KEY = 'cmjDualTranscriptLanguageCatalog';
  const DEFAULT = {
    enabled: true,
    showToolbarButton: true,
    autoFetchOnPlay: true,
    targetLanguage: 'en',
    sourceLanguage: 'auto',
    sentenceMerging: true,
    cacheEnabled: true,
    cacheLimit: 20,
    originalColor: '#ffffff',
    translatedColor: '#8fd3ff',
    speakerIconEnabled: true,
    speakerIconColor: '#ffd54a',
    speakerIconSize: 18,
  };
  const SERVICE_DEFAULT = {
    enabled: true,
    sourceBehavior: 'selected-or-auto',
    cacheEnabled: true,
    cacheTtlHours: 24,
    timeoutMs: 6500,
    fallbackEnabled: true,
    sentenceEnabled: true,
    wordAlignment: 'safe-only',
  };
  const $ = (id) => document.getElementById(id);
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>'"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]
    );
  function optionList(items, includeAuto = false, selected = '') {
    const rows = [];
    if (includeAuto) rows.push(`<option value="auto">Auto</option>`);
    const seen = new Set(includeAuto ? ['auto'] : []);
    for (const item of Array.isArray(items) ? items : []) {
      const code = String(item?.languageCode || item?.code || '').trim();
      const name = String(item?.name || item?.languageName || code).trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      rows.push(`<option value="${esc(code)}">${esc(name)}</option>`);
    }
    if (selected && !seen.has(selected))
      rows.push(`<option value="${esc(selected)}">${esc(selected)}</option>`);
    return rows.join('');
  }
  async function readAll() {
    const stored = await chrome.storage.local.get([KEY, SERVICE_KEY, CATALOG_KEY]);
    return {
      settings: { ...DEFAULT, ...(stored[KEY] || {}) },
      service: { ...SERVICE_DEFAULT, ...(stored[SERVICE_KEY] || {}) },
      catalog: stored[CATALOG_KEY] || {},
    };
  }
  function renderCatalog(catalog, settings) {
    const originals = Array.isArray(catalog?.originals) ? catalog.originals : [];
    const targets = Array.isArray(catalog?.translations) ? catalog.translations : [];
    const source = $('cmjDualSource');
    const target = $('cmjDualTarget');
    if (source) {
      source.innerHTML = optionList(originals, true, settings.sourceLanguage || 'auto');
      source.value = settings.sourceLanguage || 'auto';
    }
    if (target) {
      target.innerHTML = optionList(targets, false, settings.targetLanguage || 'en');
      target.value = settings.targetLanguage || 'en';
    }
    const meta = $('cmjDualLanguageStatus');
    if (meta) {
      const video = catalog?.videoId ? `Video: ${catalog.videoId}` : 'Waiting for a YouTube video.';
      meta.textContent = `${video} · ${originals.length} original caption language${originals.length === 1 ? '' : 's'} · ${targets.length} YouTube translation language${targets.length === 1 ? '' : 's'}.`;
    }
  }
  function build() {
    if ($('cmjDualTranscriptSettingsSection')) return;
    const main = document.querySelector('main');
    if (!main) return;
    const section = document.createElement('section');
    section.id = 'cmjDualTranscriptSettingsSection';
    section.dataset.settingsCategory = 'Dual Transcript';
    section.innerHTML = `<h2>Dual Transcript</h2>
      <div class="component-card">
        <h3>🌐 Additional Dual Transcript Engine · v1.0.0 Stable Beta</h3>
        <p class="note">This is an additional system. It does not replace the existing Charlie MJ transcript engine.</p>
        <label class="check"><input id="cmjDualEnabled" type="checkbox"> Enable Dual Transcript</label>
        <label class="check"><input id="cmjDualToolbar" type="checkbox"> Show Dual Transcript button in the existing YouTube toolbar</label>
        <label class="check"><input id="cmjDualAuto" type="checkbox"> Fetch dual transcript automatically after YouTube playback starts</label>
        <label>Original YouTube Transcript Language<select id="cmjDualSource"><option value="auto">Auto</option></select></label>
        <label>Target Translation Language<select id="cmjDualTarget"><option value="en">English</option></select></label>
        <p id="cmjDualLanguageStatus" class="note">Waiting for YouTube caption data. Open a YouTube video with captions to populate the language lists.</p>
        <div class="two-col"><label class="check"><input id="cmjDualMerge" type="checkbox"> Merge cues into readable sentences</label><label class="check"><input id="cmjDualCache" type="checkbox"> Cache dual transcripts locally</label></div>
        <label>Maximum cached videos<input id="cmjDualCacheLimit" type="number" min="1" max="100" step="1"></label>
        <div class="two-col"><label>Original subtitle color<input id="cmjDualOriginalColor" type="color"></label><label>Translated subtitle color<input id="cmjDualTranslatedColor" type="color"></label><label class="check"><input id="cmjDualSpeakerEnabled" type="checkbox"> Show speaker icon on the current synced sentence</label><label>Speaker icon color<input id="cmjDualSpeakerColor" type="color"></label><label>Speaker icon size<input id="cmjDualSpeakerSize" type="number" min="12" max="32" step="1"></label></div>
        <p class="note">Original languages come from YouTube caption-track data for the current video. Translation languages come from YouTube's own translation-language data. Auto remains the default original language and English remains the default target.</p>
        <button class="primary" id="cmjDualSave" type="button">Save Dual Transcript Settings</button><span id="cmjDualSaveStatus" class="note" aria-live="polite"></span>
      </div>
      <div class="component-card cmj-dual-service-card">
        <h3>⚙ Dual YouTube Service Settings</h3>
        <p class="note">Additional service controls for the existing Dual YouTube translation provider. These settings do not remove or replace any existing translation provider.</p>
        <label class="check"><input id="cmjDualServiceEnabled" type="checkbox"> Enable Dual YouTube Service</label>
        <label>YouTube transcript source behavior<select id="cmjDualServiceSourceBehavior"><option value="selected-or-auto">Use selected original language, then Auto fallback</option><option value="selected-only">Use selected original language only</option><option value="auto-only">Always use YouTube Auto source selection</option></select></label>
        <div class="two-col"><label class="check"><input id="cmjDualServiceCache" type="checkbox"> Enable service cache</label><label>Cache lifetime (hours)<input id="cmjDualServiceCacheTtl" type="number" min="1" max="720" step="1"></label><label>Service timeout (ms)<input id="cmjDualServiceTimeout" type="number" min="1000" max="30000" step="250"></label><label class="check"><input id="cmjDualServiceFallback" type="checkbox"> Allow fallback to the next translation provider</label><label class="check"><input id="cmjDualServiceSentence" type="checkbox"> Enable sentence translation</label><label>Word-level matching/alignment<select id="cmjDualServiceWord"><option value="safe-only">Safe alignment only (recommended)</option><option value="same-position">Allow same-position alignment</option></select></label></div>
        <div class="row"><button class="secondary" id="cmjDualClearCache" type="button">Clear Dual YouTube Cache</button><button class="secondary" id="cmjDualServiceTest" type="button">Test Service Status</button><span id="cmjDualServiceStatus" class="note" aria-live="polite"></span></div>
      </div>`;
    const savebar = main.querySelector('.settings-savebar');
    if (savebar) savebar.before(section);
    else main.appendChild(section);
    load();
    $('cmjDualSave').addEventListener('click', save);
    $('cmjDualClearCache').addEventListener('click', clearCache);
    $('cmjDualServiceTest').addEventListener('click', testService);
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[CATALOG_KEY]) readAll().then((x) => renderCatalog(x.catalog, x.settings));
    });
    document.dispatchEvent(new Event('cmj-rebuild-settings-nav'));
  }
  async function load() {
    const all = await readAll(),
      s = all.settings,
      svc = all.service;
    $('cmjDualEnabled').checked = s.enabled !== false;
    $('cmjDualToolbar').checked = s.showToolbarButton !== false;
    $('cmjDualAuto').checked = s.autoFetchOnPlay !== false;
    $('cmjDualMerge').checked = s.sentenceMerging !== false;
    $('cmjDualCache').checked = s.cacheEnabled !== false;
    $('cmjDualCacheLimit').value = String(s.cacheLimit || 20);
    $('cmjDualOriginalColor').value = s.originalColor || '#ffffff';
    $('cmjDualTranslatedColor').value = s.translatedColor || '#8fd3ff';
    $('cmjDualSpeakerEnabled').checked = s.speakerIconEnabled !== false;
    $('cmjDualSpeakerColor').value = s.speakerIconColor || '#ffd54a';
    $('cmjDualSpeakerSize').value = String(s.speakerIconSize || 18);
    renderCatalog(all.catalog, s);
    $('cmjDualServiceEnabled').checked = svc.enabled !== false;
    $('cmjDualServiceSourceBehavior').value = svc.sourceBehavior || 'selected-or-auto';
    $('cmjDualServiceCache').checked = svc.cacheEnabled !== false;
    $('cmjDualServiceCacheTtl').value = String(svc.cacheTtlHours || 24);
    $('cmjDualServiceTimeout').value = String(svc.timeoutMs || 6500);
    $('cmjDualServiceFallback').checked = svc.fallbackEnabled !== false;
    $('cmjDualServiceSentence').checked = svc.sentenceEnabled !== false;
    $('cmjDualServiceWord').value = svc.wordAlignment || 'safe-only';
    $('cmjDualServiceStatus').textContent =
      svc.enabled !== false ? 'Service enabled · ready' : 'Service disabled';
  }
  async function save() {
    const s = {
      enabled: $('cmjDualEnabled').checked,
      showToolbarButton: $('cmjDualToolbar').checked,
      autoFetchOnPlay: $('cmjDualAuto').checked,
      targetLanguage: $('cmjDualTarget').value || 'en',
      sourceLanguage: $('cmjDualSource').value || 'auto',
      sentenceMerging: $('cmjDualMerge').checked,
      cacheEnabled: $('cmjDualCache').checked,
      cacheLimit: Math.max(1, Math.min(100, Number($('cmjDualCacheLimit').value) || 20)),
      originalColor: $('cmjDualOriginalColor').value,
      translatedColor: $('cmjDualTranslatedColor').value,
      speakerIconEnabled: $('cmjDualSpeakerEnabled').checked,
      speakerIconColor: $('cmjDualSpeakerColor').value,
      speakerIconSize: Math.max(12, Math.min(32, Number($('cmjDualSpeakerSize').value) || 18)),
    };
    const svc = {
      enabled: $('cmjDualServiceEnabled').checked,
      sourceBehavior: $('cmjDualServiceSourceBehavior').value,
      cacheEnabled: $('cmjDualServiceCache').checked,
      cacheTtlHours: Math.max(1, Math.min(720, Number($('cmjDualServiceCacheTtl').value) || 24)),
      timeoutMs: Math.max(1000, Math.min(30000, Number($('cmjDualServiceTimeout').value) || 6500)),
      fallbackEnabled: $('cmjDualServiceFallback').checked,
      sentenceEnabled: $('cmjDualServiceSentence').checked,
      wordAlignment: $('cmjDualServiceWord').value,
    };
    await chrome.storage.local.set({ [KEY]: s, [SERVICE_KEY]: svc });
    $('cmjDualSaveStatus').textContent =
      '✓ Saved. Refresh YouTube to apply transcript/service changes.';
    $('cmjDualServiceStatus').textContent = svc.enabled
      ? 'Service enabled · ready'
      : 'Service disabled';
    setTimeout(() => {
      if ($('cmjDualSaveStatus')) $('cmjDualSaveStatus').textContent = '';
    }, 2200);
  }
  async function clearCache() {
    try {
      await chrome.storage.local.remove('cmjDualTranscriptCache');
      $('cmjDualServiceStatus').textContent = '✓ Dual YouTube cache cleared.';
      setTimeout(() => {
        if ($('cmjDualServiceStatus'))
          $('cmjDualServiceStatus').textContent = 'Service cache ready';
      }, 2200);
    } catch (e) {
      $('cmjDualServiceStatus').textContent = 'Could not clear cache.';
    }
  }
  async function testService() {
    const all = await readAll();
    const text =
      all.service.enabled !== false
        ? '✓ Service configuration is enabled and ready.'
        : 'Service is disabled.';
    $('cmjDualServiceStatus').textContent = text;
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', build, { once: true });
  else build();
})();
