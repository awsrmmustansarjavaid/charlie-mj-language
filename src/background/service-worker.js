import { fetchYouTubeMetadata } from '../additional/youtube-metadata-service.js';
import { alignTranscripts } from '../additional/alignment.js';
import { listTranscriptEngines } from '../additional/transcript-engine-manager.js';
import {
  saveFavorite,
  updateFavorite,
  removeFavorite,
  listFavorites,
  exportFavorites,
  importFavorites,
  getCategories,
  setCategories,
  getCollections,
  setCollections,
  favoritesToTxt,
} from '../additional/favorites-service.js';
/**
 * Charlie MJ Language - Manifest V3 service worker.
 * Responsible for context menus, commands, translation requests, downloads and
 * lightweight background coordination. No GitHub Actions or remote code is used.
 */
chrome.alarms.create('cmj-favorites-refresh', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'cmj-favorites-refresh') return;
  try {
    const settingsStore = await chrome.storage.local.get([
      'cmjAdditionalSettings',
      'cmjPerformance',
      'cmjLightweightSleepMode',
    ]);
    const settings = settingsStore.cmjAdditionalSettings || {};
    const performance = settingsStore.cmjPerformance || {};
    if (settingsStore.cmjLightweightSleepMode === true) return;
    if (performance.backgroundTasks !== true || performance.services?.metadataRefresh === 'sleep')
      return;
    if (settings.thumbnailRefresh === false) return;
    const intervalMs =
      Math.max(
        24,
        Number(settings.metadataRefreshHours) || Number(settings.thumbnailRefreshHours) || 168
      ) * 3600000;
    const [channels, playlists] = await Promise.all([
      chrome.storage.local.get('cmjFavChannels'),
      chrome.storage.local.get('cmjFavPlaylists'),
    ]);
    const refreshList = async (key, type) => {
      const list = Array.isArray((type === 'channel' ? channels : playlists)[key])
        ? (type === 'channel' ? channels : playlists)[key]
        : [];
      const out = [];
      for (const item of list.slice(0, 50)) {
        if (
          Date.now() -
            new Date(item.metadataLastChecked || item.thumbnail?.lastChecked || 0).getTime() <
          intervalMs
        ) {
          out.push(item);
          continue;
        }
        try {
          const meta = await fetchYouTubeMetadata(item.url, type);
          out.push(
            await updateFavorite(type, {
              ...item,
              ...meta,
              category: item.category,
              tags: item.tags,
              notes: item.notes,
              isPinned: item.isPinned,
              thumbnail: {
                ...(item.thumbnail || {}),
                url: meta.thumbnail || item.thumbnail?.url || '',
                lastChecked: new Date().toISOString(),
                lastUpdated:
                  meta.thumbnail && meta.thumbnail !== item.thumbnail?.url
                    ? new Date().toISOString()
                    : item.thumbnail?.lastUpdated || '',
              },
            })
          );
        } catch {
          out.push({ ...item, metadataLastChecked: new Date().toISOString() });
        }
      }
      await chrome.storage.local.set({ [key]: out });
    };
    await refreshList('cmjFavChannels', 'channel');
    await refreshList('cmjFavPlaylists', 'playlist');
    // Optional scheduled GitHub pull: wake only at the alarm, never poll.
    try {
      const syncStore = await chrome.storage.local.get(['cmjDataSync', 'cmjPerformance']);
      const sync = syncStore.cmjDataSync || {};
      const perf2 = syncStore.cmjPerformance || {};
      const intervalMs = Math.max(1, Number(sync.intervalHours) || 24) * 3600000;
      if (
        sync.scheduled === true &&
        sync.githubUrl &&
        Date.now() - Number(sync.lastSync || 0) >= intervalMs &&
        perf2.services?.githubSync !== 'sleep'
      ) {
        const cfg = await githubConfig(sync);
        const dirs = await githubTree(cfg.base, sync);
        // Scheduled mode is intentionally conservative: pull/merge only.
        for (const dir of dirs.filter(
          (x) => x.type === 'dir' && ['channels', 'playlists', 'categories'].includes(x.name)
        )) {
          const files = await githubTree(`${cfg.base}/${dir.name}`, sync);
          for (const f of files.filter((x) => x.type === 'file' && x.name.endsWith('.json'))) {
            try {
              const payload = await (
                await fetch(f.download_url, {
                  headers: { Accept: 'application/vnd.github.raw+json' },
                })
              ).json();
              if (dir.name === 'channels' && Array.isArray(payload)) {
                const cur = await listFavorites('channel');
                const merged = [...cur];
                for (const x of payload) {
                  const id = x.channelId || x.id;
                  if (id && !merged.some((y) => (y.channelId || y.id) === id)) merged.push(x);
                }
                await chrome.storage.local.set({ cmjFavChannels: merged });
              }
              if (dir.name === 'playlists' && Array.isArray(payload)) {
                const cur = await listFavorites('playlist');
                const merged = [...cur];
                for (const x of payload) {
                  const id = x.playlistId || x.id;
                  if (id && !merged.some((y) => (y.playlistId || y.id) === id)) merged.push(x);
                }
                await chrome.storage.local.set({ cmjFavPlaylists: merged });
              }
              if (dir.name === 'categories' && Array.isArray(payload)) await setCategories(payload);
            } catch (_) {}
          }
        }
        await chrome.storage.local.set({ cmjDataSync: { ...sync, lastSync: Date.now() } });
      }
    } catch (error) {
      console.warn('Charlie MJ scheduled GitHub sync skipped.', error);
    }
  } catch (error) {
    console.warn('Charlie MJ favorites refresh skipped.', error);
  }
});
const MENU_ROOT = 'cmj-root';
const MENU_WATCH = 'cmj-watch-later';
const MENU_LEARN = 'cmj-open-learning';
const MENU_BOOKMARK = 'cmj-bookmark';
const MENU_SAVE_SELECTION = 'cmj-save-selection';
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT,
      title: 'Charlie MJ Language',
      contexts: ['page', 'link', 'selection'],
    });
    chrome.contextMenus.create({
      id: MENU_WATCH,
      parentId: MENU_ROOT,
      title: '➕ Add YouTube video to Watch Later',
      contexts: ['page', 'link'],
      documentUrlPatterns: ['https://*.youtube.com/*', 'https://youtu.be/*'],
    });
    chrome.contextMenus.create({
      id: MENU_LEARN,
      parentId: MENU_ROOT,
      title: '🎬 Open Charlie MJ Learning Panel',
      contexts: ['page'],
      documentUrlPatterns: ['https://*.youtube.com/*'],
    });
    chrome.contextMenus.create({
      id: MENU_BOOKMARK,
      parentId: MENU_ROOT,
      title: '🔖 Bookmark current YouTube moment',
      contexts: ['page'],
      documentUrlPatterns: ['https://*.youtube.com/*'],
    });
    chrome.contextMenus.create({
      id: MENU_SAVE_SELECTION,
      parentId: MENU_ROOT,
      title: '⭐ Save selected text as vocabulary',
      contexts: ['selection'],
    });
  });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === MENU_WATCH) {
    const url = info.linkUrl || tab.url || '';
    if (/youtube\.com|youtu\.be/.test(url)) {
      await chrome.storage.local.set({
        lastWatchLaterRequest: { url, title: tab.title || '', addedAt: Date.now() },
      });
      await sendToTab(tab.id, { type: 'CMJ_ADD_WATCH_LATER', url, title: tab.title || '' });
    }
  }
  if (info.menuItemId === MENU_LEARN) await sendToTab(tab.id, { type: 'CMJ_OPEN_PANEL' });
  if (info.menuItemId === MENU_BOOKMARK) await sendToTab(tab.id, { type: 'CMJ_BOOKMARK' });
  if (info.menuItemId === MENU_SAVE_SELECTION)
    await sendToTab(tab.id, { type: 'CMJ_SAVE_TEXT', text: info.selectionText || '' });
});
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  if (command === 'toggle-focus-mode') await sendToTab(tab.id, { type: 'CMJ_TOGGLE_FOCUS' });
  if (command === 'save-current-vocabulary') await sendToTab(tab.id, { type: 'CMJ_SAVE_CURRENT' });
});
let categoryKnowledgePromise = null;

function cmjNormalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function cmjTermMatches(text, term) {
  const haystack = cmjNormalizeText(text);
  const needle = cmjNormalizeText(term);
  if (!haystack || !needle) return false;
  if (needle.length < 2) return false;
  if (/^[\u0000-\u024f\u0600-\u06ff\u0900-\u097f\u3040-\u30ff\u3400-\u9fff]+$/u.test(needle)) {
    return haystack.includes(needle);
  }
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(haystack);
}

function cmjArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((x) => String(x));
  if (value == null || value === '') return [];
  return [String(value)];
}

function cmjUnique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const clean = String(value ?? '').trim();
    if (!clean) continue;
    const key = cmjNormalizeText(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function cmjRuleMatchesAny(texts, terms) {
  const matches = [];
  for (const term of cmjArray(terms)) {
    if (texts.some((text) => cmjTermMatches(text, term))) matches.push(term);
  }
  return cmjUnique(matches);
}

function cmjFieldText(meta) {
  const title = [meta.name, meta.title].filter(Boolean).join(' ');
  const description = [meta.description].filter(Boolean).join(' ');
  const tags = cmjArray(meta.tags).join(' ');
  const keywords = cmjArray(meta.keywords).join(' ');
  const labels = cmjArray(meta.labels).join(' ');
  const owner = [meta.owner, meta.handle].filter(Boolean).join(' ');
  const playlist = [meta.playlistTitle, meta.playlistDescription].filter(Boolean).join(' ');
  const videos = cmjArray(meta.playlistItems)
    .flatMap((item) => [item?.title, item?.description, item?.owner])
    .filter(Boolean)
    .join(' ');
  return {
    title,
    description,
    tags,
    keywords,
    labels,
    owner,
    playlist,
    videos,
    all: [title, description, tags, keywords, labels, owner, playlist, videos]
      .filter(Boolean)
      .join(' '),
  };
}

function cmjCountryByCode(countries, code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;
  return (countries || []).find((country) => String(country?.code || '').toUpperCase() === normalized) || null;
}

function cmjDetectCountry(meta, knowledge, fields) {
  const countries = knowledge.countries || [];
  const explicitCode = String(meta.countryCode || '').trim().toUpperCase();
  const explicitName = String(meta.country || meta.countryName || '').trim();

  if (explicitCode) {
    const country = cmjCountryByCode(countries, explicitCode);
    if (country) {
      return {
        code: country.code,
        name: country.name,
        confidence: 0.99,
        source: 'explicit-metadata',
        evidence: [country.code],
      };
    }
  }

  if (explicitName) {
    const match = countries.find((country) =>
      [country?.name, ...(country?.aliases || [])].some(
        (value) => cmjNormalizeText(value) === cmjNormalizeText(explicitName)
      )
    );
    if (match) {
      return {
        code: match.code,
        name: match.name,
        confidence: 0.96,
        source: 'explicit-metadata',
        evidence: [explicitName],
      };
    }
  }

  const keywordMap = knowledge.countryKeywords?.keywords || {};
  const candidates = [];
  for (const country of countries) {
    const terms = cmjUnique([
      country?.name,
      ...(country?.aliases || []),
      ...(keywordMap[country?.code] || []),
    ]);
    const matches = cmjRuleMatchesAny([fields.title, fields.description, fields.tags, fields.keywords, fields.labels, fields.owner, fields.playlist, fields.videos], terms);
    if (!matches.length) continue;

    let score = 0;
    for (const term of matches) {
      const normalized = cmjNormalizeText(term);
      const strong = ['turkey', 'turkish', 'turkiye', 'turkiye', 'hatay', 'istanbul', 'ankara'].includes(normalized);
      score += strong ? 3 : normalized.includes(' ') ? 2 : 1;
    }

    const titleMatches = cmjRuleMatchesAny([fields.title, fields.owner], terms);
    const descriptionMatches = cmjRuleMatchesAny([fields.description, fields.playlist, fields.videos], terms);
    if (titleMatches.length) score += titleMatches.length * 2;
    if (descriptionMatches.length) score += descriptionMatches.length;

    candidates.push({ country, matches, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  if (!top) return null;

  const second = candidates[1]?.score || 0;
  const confidence = Math.min(0.95, 0.55 + (top.score / Math.max(1, top.score + second + 2)) * 0.4);
  return {
    code: top.country.code,
    name: top.country.name,
    confidence,
    source: 'country-keywords',
    evidence: top.matches.slice(0, 8),
  };
}

function cmjInferLanguage(meta, country, knowledge, fields) {
  const explicit = String(meta.languageCode || meta.language || '').trim();
  if (explicit) {
    return {
      code: explicit,
      confidence: 0.98,
      source: 'explicit-metadata',
      evidence: [explicit],
    };
  }

  if (country?.code) {
    const mapped = knowledge.countryLanguageMap?.countries?.[country.code] || [];
    if (mapped.length) {
      return {
        code: mapped[0],
        confidence: country.source === 'explicit-metadata' ? 0.88 : 0.72,
        source: 'country-language-map',
        evidence: [country.code],
      };
    }
  }

  const languageSignals = [
    ['tr', ['turkish', 'türkçe', 'turkce', 'Türk']],
    ['ur', ['urdu', 'اردو']],
    ['ar', ['arabic', 'العربية', 'عربي']],
    ['en', ['english']],
    ['de', ['german', 'deutsch']],
    ['fr', ['french', 'français']],
    ['es', ['spanish', 'español']],
    ['it', ['italian', 'italiano']],
    ['pt', ['portuguese', 'português']],
    ['hi', ['hindi', 'हिन्दी']],
    ['ja', ['japanese', '日本語']],
    ['ko', ['korean', '한국어']],
    ['zh', ['chinese', '中文']],
  ];

  const matches = [];
  for (const [code, terms] of languageSignals) {
    const found = cmjRuleMatchesAny([fields.title, fields.description, fields.tags, fields.keywords, fields.labels, fields.owner], terms);
    if (found.length) matches.push({ code, found, score: found.length });
  }
  matches.sort((a, b) => b.score - a.score);
  if (!matches.length) return null;
  return {
    code: matches[0].code,
    confidence: Math.min(0.92, 0.7 + matches[0].score * 0.08),
    source: 'language-signals',
    evidence: matches[0].found,
  };
}

function cmjAddScore(map, category, score, source, evidence = [], ruleId = '') {
  const name = String(category || '').trim();
  if (!name || !Number.isFinite(score) || score <= 0) return;
  const current = map.get(name) || { score: 0, sources: [], evidence: [], rules: [] };
  current.score += score;
  if (source && !current.sources.includes(source)) current.sources.push(source);
  current.evidence = cmjUnique([...current.evidence, ...evidence]).slice(0, 20);
  if (ruleId && !current.rules.includes(ruleId)) current.rules.push(ruleId);
  map.set(name, current);
}

function cmjCategoryExists(existing, name) {
  return existing.find((category) => cmjNormalizeText(category?.name) === cmjNormalizeText(name));
}

function cmjExpandSynonyms(term, synonyms) {
  const normalized = cmjNormalizeText(term);
  const result = [term];
  for (const [canonical, values] of Object.entries(synonyms || {})) {
    const variants = [canonical, ...cmjArray(values)];
    if (variants.some((value) => cmjNormalizeText(value) === normalized)) result.push(...variants);
  }
  return cmjUnique(result);
}

async function loadCategoryKnowledge() {
  if (categoryKnowledgePromise) return categoryKnowledgePromise;
  categoryKnowledgePromise = (async () => {
    const base = chrome.runtime.getURL('data/category-knowledge/');
    const localBase = chrome.runtime.getURL('database/youtube-metadata-auto-categorization/');
    const get = async (baseUrl, name, fallback) => {
      try {
        const response = await fetch(baseUrl + name, { cache: 'no-store' });
        if (!response.ok) return fallback;
        return await response.json();
      } catch {
        return fallback;
      }
    };

    const [legacyKeywords, learning, youtube, legacyRules, localKeywords, localTags, localLabels, localRules, storedRules, countries, countryKeywords, languages, countryLanguageMap, categories, synonyms, priorityRules] = await Promise.all([
      get(base, 'category-keywords.json', {}),
      get(base, 'learning-categories.json', { categories: [] }),
      get(base, 'youtube-categories.json', { guideCategories: [], channelTopicCategories: [] }),
      get(base, 'category-rules.json', { rules: [] }),
      get(localBase, 'keywords/default.json', {}),
      get(localBase, 'tags/default.json', {}),
      get(localBase, 'labels/default.json', {}),
      get(localBase, 'rules/default.json', { rules: [] }),
      chrome.storage.local.get('cmjYoutubeMetadataRules'),
      get(localBase, 'countries.json', { countries: [] }),
      get(localBase, 'country-keywords.json', { keywords: {} }),
      get(localBase, 'languages.json', { languages: [] }),
      get(localBase, 'country-language-map.json', { countries: {} }),
      get(localBase, 'categories.json', { categories: [] }),
      get(localBase, 'synonyms.json', { synonyms: {} }),
      get(localBase, 'priority-rules.json', { rules: [] }),
    ]);

    const custom = storedRules.cmjYoutubeMetadataRules || {};
    return {
      keywords: { ...legacyKeywords, ...localKeywords, ...(custom.keywords || {}) },
      tags: { ...localTags, ...(custom.tags || {}) },
      labels: { ...localLabels, ...(custom.labels || {}) },
      learning,
      youtube,
      countries: custom.countries?.length ? custom.countries : countries.countries || [],
      countryKeywords: custom.countryKeywords || countryKeywords,
      languages,
      countryLanguageMap,
      categories: categories.categories || [],
      synonyms: custom.synonyms || synonyms.synonyms || {},
      priorityRules: custom.priorityRules || priorityRules.rules || [],
      rules: {
        rules: [
          ...(legacyRules.rules || []),
          ...(localRules.rules || []),
          ...(custom.rules?.rules || []),
        ],
      },
    };
  })();
  return categoryKnowledgePromise;
}
/*
 * Rule-Based Auto-Categorization Engine (local, no AI).
 *
 * Flow: metadata -> country -> language -> keyword/tag/label rules -> multi-keyword combination
 *       -> category name ("TR Travel Biker Vlogger") -> existing-category match -> explanation.
 * Rules live in database/youtube-metadata-auto-categorization/ and can be edited without code changes.
 */
const METADATA_FIELD_WEIGHTS = { title: 3, tags: 2, description: 1 };
const METADATA_MIN_CONFIDENCE = 0.45;
let metadataExtraPromise = null;

/** Lower-case, accent-free text for matching (maps Turkish dotless i). */
function foldRuleText(value) {
  return String(value ?? '')
    .replace(/İ/g, 'i')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Word-boundary matcher; longer terms also match short suffixes (travel -> travelers). */
function termMatcher(term) {
  const folded = foldRuleText(term).trim();
  if (!folded) return null;
  const escaped = folded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const suffix = folded.length >= 5 ? '[a-z]{0,3}' : '';
  return new RegExp(`(^|[^a-z0-9])${escaped}${suffix}(?=$|[^a-z0-9])`, 'g');
}

/** Number of times any term appears in a folded text (capped, so one repeated word cannot dominate). */
function countTermHits(text, terms) {
  const found = [];
  let hits = 0;
  for (const term of terms) {
    const matcher = termMatcher(term);
    const count = matcher ? Math.min(3, (text.match(matcher) || []).length) : 0;
    if (count) {
      hits += count;
      found.push(term);
    }
  }
  return { hits, found };
}

/** Optional extras: country-language map, loaded once. */
function loadMetadataExtras() {
  if (metadataExtraPromise) return metadataExtraPromise;
  metadataExtraPromise = (async () => {
    const base = chrome.runtime.getURL('database/youtube-metadata-auto-categorization/');
    const get = async (name, fallback) => {
      try {
        const response = await fetch(base + name, { cache: 'no-store' });
        return response.ok ? await response.json() : fallback;
      } catch (_) {
        return fallback;
      }
    };
    const [countryKeywords, countryLanguages, languages] = await Promise.all([
      get('country-keywords.json', { keywords: {} }),
      get('country-language-map.json', { countries: {} }),
      get('languages.json', { languages: [] }),
    ]);
    return {
      countryKeywords: countryKeywords.keywords || {},
      countryLanguages: countryLanguages.countries || {},
      languages: languages.languages || [],
    };
  })();
  return metadataExtraPromise;
}

/** Group metadata into weighted, folded text fields. */
function splitCompoundWords(value) {
  const text = foldRuleText(value);
  if (!text) return '';
  // Preserve normal whitespace/punctuation, then add boundaries for common camel-case
  // and letter/digit transitions so TurkuazKitchen can match "kitchen".
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-z]{3,})(kitchen|food|chef|travel|gaming|music|tech|vlog|recipes?|language|learn(?:ing)?|history|film|movie|news|review)(?=[a-z]|$)/gi, '$1 $2')
    .replace(/([a-z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-z])/g, '$1 $2');
}

function normalizeRuleText(value) {
  return splitCompoundWords(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\u0600-\u06ff\u0900-\u097f\u3040-\u30ff\u4e00-\u9fff]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ruleTerms(value) {
  const normalized = normalizeRuleText(value);
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const out = [normalized, ...tokens];
  // Singular/plural and common English inflections improve recall without AI.
  for (const token of tokens) {
    if (token.length >= 5 && token.endsWith('ies')) out.push(token.slice(0, -3) + 'y');
    if (token.length >= 5 && token.endsWith('es')) out.push(token.slice(0, -2));
    if (token.length >= 5 && token.endsWith('s')) out.push(token.slice(0, -1));
  }
  return cmjUnique(out);
}

function buildMetadataFields(meta, options = {}) {
  const join = (...parts) => {
    const raw = parts.flat().filter(Boolean).join(' \n ');
    return options.compoundMatching === false ? foldRuleText(raw) : normalizeRuleText(raw);
  };
  return {
    title: join(meta.name, meta.title, meta.handle, meta.owner),
    tags: join(meta.tags || [], meta.keywords || [], meta.labels || [], meta.playlistTitles || []),
    description: join(meta.description, meta.about, meta.videoTitles || [], meta.recentVideoTitles || []),
    all: join(
      meta.name, meta.title, meta.handle, meta.owner, meta.description, meta.about,
      meta.tags || [], meta.keywords || [], meta.labels || [], meta.playlistTitles || [],
      meta.videoTitles || [], meta.recentVideoTitles || []
    ),
  };
}

const weightedHits = (fields, terms) => {
  let score = 0;
  const found = new Set();
  const normalizedTerms = cmjUnique(terms.flatMap(ruleTerms));
  for (const [field, weight] of Object.entries(METADATA_FIELD_WEIGHTS)) {
    const result = countTermHits(fields[field], normalizedTerms);
    score += result.hits * weight;
    result.found.forEach((term) => found.add(term));
  }
  return { score, found: [...found] };
};

/** Country detection: names, aliases, demonyms, cities. Returns the strongest candidate. */
function detectMetadataCountry(fields, countries, extras) {
  let best = null;
  for (const country of countries) {
    const terms = [
      country.name,
      ...(country.aliases || []),
      ...(extras.countryKeywords[country.code] || []),
    ].filter((term) => String(term || '').trim().length >= 4);
    const { score, found } = weightedHits(fields, terms);
    if (score >= 2 && (!best || score > best.score)) best = { country, score, found };
  }
  return best;
}

/** Language detection: explicit language names (via Intl.DisplayNames) plus the country's main language. */
function detectMetadataLanguage(fields, extras, country) {
  let names = null;
  try {
    names = new Intl.DisplayNames(['en'], { type: 'language' });
  } catch (_) {}
  const text = `${fields.title} ${fields.tags} ${fields.description}`;
  let best = null;
  if (names) {
    for (const language of extras.languages.slice(0, 400)) {
      const code = String(language.code || '').split('_')[0];
      let name = '';
      try {
        name = names.of(code) || '';
      } catch (_) {}
      if (!name || name === code || name.length < 4) continue;
      const hits = countTermHits(text, [name]).hits;
      if (hits && (!best || hits > best.hits)) best = { code, name, hits, via: 'language name' };
    }
  }
  if (best) return best;
  const mainCode = (country?.languageCodes || extras.countryLanguages[country?.code] || [])[0];
  if (mainCode && names) {
    try {
      return {
        code: mainCode,
        name: names.of(mainCode.split('_')[0]) || mainCode,
        hits: 0,
        via: 'country',
      };
    } catch (_) {}
  }
  return null;
}

/**
 * Combine matching rules into one category name.
 * Best rule per group (topic, sub, role) in group order, behind the country code.
 */
async function categorizeFromMetadata(meta, knowledge, existing, intelligence = {}) {
  const extras = await loadMetadataExtras();
  const sourceMeta = { ...meta };
  if (intelligence.useRecentVideos === false) {
    sourceMeta.videoTitles = [];
    sourceMeta.recentVideoTitles = [];
  }
  if (intelligence.usePlaylistTitles === false) sourceMeta.playlistTitles = [];
  const fields = buildMetadataFields(sourceMeta, intelligence);
  const countryResult = detectMetadataCountry(fields, knowledge.countries || [], extras);
  const language = detectMetadataLanguage(fields, extras, countryResult?.country);
  const countryCode = countryResult?.country.code || meta.countryCode || '';
  const languageCode = language?.code || meta.languageCode || '';
  const learning = intelligence.learning || {};

  const candidates = new Map();
  const addCandidate = (name, score, source, found = [], ruleId = '') => {
    const cleanName = String(name || '').trim();
    if (!cleanName || cleanName.toLowerCase() === 'uncategorized' || !Number.isFinite(score) || score <= 0) return;
    const current = candidates.get(cleanName) || { name: cleanName, score: 0, source, found: new Set(), rules: new Set() };
    current.score += score;
    current.source = current.source || source;
    found.forEach((x) => current.found.add(x));
    if (ruleId) current.rules.add(ruleId);
    candidates.set(cleanName, current);
  };

  for (const rule of knowledge.rules?.rules || []) {
    if (rule.enabled === false) continue;
    if (rule.countryCodes?.length && !rule.countryCodes.includes(countryCode)) continue;
    if (rule.languageCodes?.length && !rule.languageCodes.includes(languageCode)) continue;
    const name = rule.part || rule.category || rule.name || rule.label;
    if (!name) continue;
    const terms = [...(rule.keywords || []), ...(rule.phrases || []), ...(rule.tags || []), ...(rule.labels || [])];
    const { score, found } = weightedHits(fields, terms);
    if (score >= 1) {
      const weight = Math.max(0.1, Number(rule.weight || 1));
      const priorityBoost = Math.max(0, Number(rule.priority || 0)) / 250;
      addCandidate(name, score * weight + priorityBoost, 'metadata-rules', found, rule.id);
    }
  }

  // Existing local categories are first-class candidates. Their words are matched against
  // all available metadata, not only the channel description.
  for (const category of existing || []) {
    const name = String(category?.name || '').trim();
    if (!name) continue;
    const terms = ruleTerms(name).filter((x) => x.length >= 3);
    const { score, found } = weightedHits(fields, terms);
    if (score >= 1) addCandidate(name, score * (intelligence.preferExisting !== false ? 1.35 : 1), 'existing-category', found);
  }

  // Learned signals are deliberately separate from packaged rules and survive extension updates.
  for (const [categoryName, data] of Object.entries(learning || {})) {
    const terms = Array.isArray(data?.terms) ? data.terms : [];
    const { score, found } = weightedHits(fields, terms);
    if (score) addCandidate(categoryName, score * 1.25, 'learned', found);
  }

  // Multilingual fallback vocabulary. This is additive and deliberately small; users can extend it.
  const multilingual = {
    'Food & Cooking': ['food','cooking','cook','recipe','recipes','kitchen','chef','baking','cuisine','yemek','yemek tarifi','tarif','tarifler','mutfak','aşçı','pisirme','pişirme','lezzet'],
    'Travel': ['travel','traveler','travelling','tourism','tourist','destination','trip','seyahat','gezmek','gezi','tatil','yolculuk'],
    'Travel Biker Vlogger': ['motorcycle','motorbike','biker','rider','touring','motosiklet','motor','motorsiklet','sürüş','surus','motosiklet vlog'],
    'Turkish Learning': ['turkish','türkçe','turkce','türk dili','türkçe öğren','turkce ogren'],
    'Technology': ['technology','tech','software','hardware','gadget','bilgisayar','teknoloji','yazılım','yazilim','donanım','donanim'],
    'History & Culture': ['history','historical','culture','civilization','tarih','tarihi','kültür','kultur','medeniyet'],
  };
  if (intelligence.multilingualKeywords !== false) {
    for (const [name, terms] of Object.entries(multilingual)) {
      const { score, found } = weightedHits(fields, terms);
      if (score) addCandidate(name, score * 0.9, 'multilingual-keywords', found);
    }
  }

  const ranked = [...candidates.values()]
    .map((item) => ({ ...item, found: [...item.found], matchedRules: [...item.rules] }))
    .sort((a, b) => b.score - a.score);
  const reasons = [];
  if (countryResult) reasons.push(`Country: ${countryResult.country.name} (${countryResult.found.join(', ')})`);
  if (language) reasons.push(`Language: ${language.name}${language.via === 'country' ? ' (country default)' : ''}`);
  const top = ranked[0];
  const second = ranked[1]?.score || 0;
  const totalStrength = ranked.slice(0, 3).reduce((sum, item) => sum + Math.min(8, item.score), 0);
  const confidence = top
    ? Math.min(0.98, Math.max(0.35, 0.5 + Math.min(0.32, top.score * 0.06) + (top.score > Math.max(1, second * 1.25) ? 0.12 : 0) + (countryCode ? 0.05 : 0)))
    : 0;
  const level = confidence >= 0.8 ? 'High' : confidence >= 0.6 ? 'Medium' : 'Low';
  const topCandidates = ranked.slice(0, Math.max(1, Math.min(5, Number(intelligence.topCandidates || 3)))).map((item) => ({
    name: item.name,
    confidence: Math.min(0.98, Math.max(0.1, item.score / Math.max(item.score + second + 1, 1))),
    score: Math.round(item.score * 100) / 100,
    source: item.source,
    keywords: item.found.slice(0, 12),
    matchedRules: item.matchedRules,
  }));
  if (top) {
    for (const candidate of topCandidates) reasons.push(`${candidate.name}: ${candidate.keywords.join(', ')}`);
  }
  const exact = top && existing.find((c) => foldRuleText(c?.name) === foldRuleText(top.name));
  const selectedName = exact?.name || top?.name || 'Uncategorized';
  const accepted = top && confidence >= Number(intelligence.minConfidence || 0.72);
  return {
    name: accepted ? selectedName : 'Uncategorized',
    suggestedName: top?.name || '',
    confidence,
    level,
    source: top?.source || 'none',
    suggestNew: Boolean(top && !exact),
    countryCode,
    countryName: countryResult?.country.name || meta.country || '',
    languageCode,
    languageName: language?.name || meta.language || '',
    keywords: top?.found?.slice(0, 20) || [],
    matchedRules: top?.matchedRules || [],
    candidates: topCandidates,
    reasons: reasons.length ? reasons : ['No category signal matched confidently.'],
    evidence: topCandidates,
    strength: totalStrength,
  };
}

/** Public entry: runs the engine/legacy scoring and always attaches the explanation fields. */
async function suggestCategory(meta = {}, options = {}) {
  const result = await suggestCategoryCore(meta, options);
  const hint = options.engineHint;
  if (hint && !result.reasons) {
    result.countryCode = result.countryCode || hint.countryCode;
    result.countryName = result.countryName || hint.countryName;
    result.languageCode = hint.languageCode;
    result.languageName = hint.languageName;
    result.reasons = hint.reasons;
    result.keywords = hint.keywords;
    result.matchedRules = hint.matchedRules;
    result.candidates = hint.candidates || [];
    result.evidence = hint.evidence || [];
    result.level = result.confidence >= 0.8 ? 'High' : result.confidence >= 0.6 ? 'Medium' : 'Low';
  }
  return result;
}
function extractLearningTerms(meta = {}) {
  const fields = buildMetadataFields(meta);
  const stop = new Set([
    'the','and','for','with','from','this','that','your','you','channel','official','youtube',
    'video','videos','www','com','https','http','about','more','new','how','what','when','where',
    'bir','ve','ile','icin','için','bu','bir','olan','olarak','çok','cok','ben','sen','biz','siz',
  ]);
  const text = fields.all;
  const counts = new Map();
  for (const token of text.split(/\s+/)) {
    if (!token || token.length < 4 || stop.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a,b) => b[1] - a[1])
    .slice(0, 60)
    .map(([token]) => token);
}

async function learnCategoryFromMetadata(meta, category, mode = 'accepted') {
  const name = String(category || '').trim();
  if (!name || name.toLowerCase() === 'uncategorized') return;
  const store = await chrome.storage.local.get('cmjCategoryLearning');
  const learning = store.cmjCategoryLearning && typeof store.cmjCategoryLearning === 'object'
    ? store.cmjCategoryLearning
    : {};
  const current = learning[name] || { terms: [], accepted: 0, rejected: 0, updatedAt: '' };
  const terms = extractLearningTerms(meta);
  if (mode === 'rejected') {
    current.rejected = Number(current.rejected || 0) + 1;
    current.rejectedTerms = cmjUnique([...(current.rejectedTerms || []), ...terms]).slice(0, 120);
  } else {
    current.accepted = Number(current.accepted || 0) + 1;
    current.terms = cmjUnique([...(current.terms || []), ...terms]).slice(0, 120);
  }
  current.updatedAt = new Date().toISOString();
  learning[name] = current;
  await chrome.storage.local.set({ cmjCategoryLearning: learning });
}

async function suggestCategoryCore(meta = {}, options = {}) {
  const stored = await chrome.storage.local.get([
    'cmjFavCategories',
    'cmjExtensionIntelligence',
    'cmjCategoryLearning',
  ]);
  const intelligence = {
    enabled: true,
    autoCategory: true,
    suggestExisting: true,
    suggestNew: true,
    minConfidence: 0.72,
    preferExisting: true,
    autoApplyHighConfidence: false,
    askBeforeCreating: true,
    learnAccepted: true,
    learnRejected: true,
    useRecentVideos: true,
    usePlaylistTitles: true,
    compoundMatching: true,
    multilingualKeywords: true,
    topCandidates: 3,
    autoRecategorizeUncategorized: true,
    ...(stored.cmjExtensionIntelligence || {}),
  };
  if (intelligence.enabled === false || intelligence.autoCategory === false)
    return { name: 'Uncategorized', confidence: 0, reason: 'disabled' };
  const existing = Array.isArray(stored.cmjFavCategories) ? stored.cmjFavCategories : [];
  const knowledge = await loadCategoryKnowledge();
  const categoryLearning = stored.cmjCategoryLearning && typeof stored.cmjCategoryLearning === 'object'
    ? stored.cmjCategoryLearning
    : {};
  try {
    const engine = await categorizeFromMetadata(meta, knowledge, existing, {
      ...intelligence,
      learning: categoryLearning,
    });
    // Without a country signal, demand more evidence before overriding the legacy scoring.
    const needed = engine.countryCode ? METADATA_MIN_CONFIDENCE : 0.6;
    if (engine.name !== 'Uncategorized' && engine.confidence >= needed) return engine;
    options.engineHint = engine;
  } catch (error) {
    console.warn('Metadata categorization engine failed:', error);
  }
  const text = [
    meta.name,
    meta.title,
    meta.description,
    meta.owner,
    meta.handle,
    ...(meta.tags || []),
    ...(meta.keywords || []),
    ...(meta.labels || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const scores = new Map();
  let detectedCountry = null;
  const countryText = text;
  for (const country of knowledge.countries || []) {
    const names = [country.name, ...(country.aliases || [])]
      .map((x) =>
        String(x || '')
          .trim()
          .toLowerCase()
      )
      .filter((x) => x.length >= 4);
    if (names.some((name) => countryText.includes(name))) {
      detectedCountry = country;
      break;
    }
  }
  const addScore = (name, score, source) => {
    if (!name || !score) return;
    scores.set(name, {
      score: (scores.get(name)?.score || 0) + score,
      source: scores.get(name)?.source || source,
    });
  };
  for (const [name, words] of Object.entries(knowledge.keywords || {})) {
    for (const word of Array.isArray(words) ? words : []) {
      const w = String(word).toLowerCase().trim();
      if (w && text.includes(w)) addScore(name, 1, 'json-keywords');
    }
  }
  for (const [name, words] of Object.entries(knowledge.tags || {})) {
    for (const word of Array.isArray(words) ? words : []) {
      const w = String(word).toLowerCase().trim();
      if (w && text.includes(w)) addScore(name, 1.25, 'json-tags');
    }
  }
  for (const [name, words] of Object.entries(knowledge.labels || {})) {
    for (const word of Array.isArray(words) ? words : []) {
      const w = String(word).toLowerCase().trim();
      if (w && text.includes(w)) addScore(name, 1.25, 'json-labels');
    }
  }
  for (const name of knowledge.learning?.categories || []) {
    const terms = String(name)
      .toLowerCase()
      .split(/[^a-z0-9\u0600-\u06ff]+/)
      .filter((x) => x.length > 2);
    for (const t of terms) if (text.includes(t)) addScore(name, 0.75, 'learning-categories');
  }
  // Keep the additive legacy rules as a fallback/compatibility layer.
  const legacy = [
    [
      'English Learning',
      [
        'english',
        'ielts',
        'toefl',
        'grammar',
        'vocabulary',
        'listening',
        'speaking',
        'pronunciation',
      ],
    ],
    [
      'Programming',
      [
        'programming',
        'javascript',
        'python',
        'typescript',
        'java',
        'coding',
        'developer',
        'software',
        'github',
      ],
    ],
    [
      'AI & Machine Learning',
      [
        'artificial intelligence',
        'machine learning',
        'deep learning',
        'llm',
        'ollama',
        'neural network',
      ],
    ],
    [
      'DevOps & Cloud',
      ['devops', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'linux', 'cloud'],
    ],
    [
      'Science & Technology',
      ['science', 'technology', 'physics', 'chemistry', 'biology', 'research'],
    ],
    ['History & Culture', ['history', 'historical', 'culture', 'civilization', 'documentary']],
    ['Health & Fitness', ['health', 'fitness', 'workout', 'nutrition', 'exercise']],
    ['Music Learning', ['music theory', 'guitar', 'piano', 'singing', 'music lesson']],
    ['Travel', ['travel', 'tourism', 'destination', 'trip', 'vlog']],
    ['Gaming', ['gaming', 'gameplay', 'esports', 'walkthrough', 'minecraft', 'roblox']],
    ['Urdu Learning', ['urdu', 'اردو']],
    ['Turkish Learning', ['turkish', 'türkçe', 'turkce']],
    ['Arabic Learning', ['arabic', 'عربي', 'العربية']],
  ];
  for (const [name, words] of legacy)
    for (const word of words) if (text.includes(word)) addScore(name, 0.75, 'legacy-rules');
  for (const c of existing) {
    const name = String(c.name || '').trim();
    if (!name) continue;
    const terms = name
      .toLowerCase()
      .split(/[^a-z0-9\u0600-\u06ff]+/)
      .filter((x) => x.length > 2);
    let score = 0;
    for (const t of terms) if (text.includes(t)) score += 1;
    if (score) addScore(name, score * 2, 'existing-category');
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  if (!ranked.length)
    return { name: 'Uncategorized', confidence: 0, reason: 'no-match', suggestedName: '' };
  const top = ranked[0],
    second = ranked[1]?.[1]?.score || 0;
  const confidence = Math.min(
    0.99,
    Math.max(0.5, top[1].score / (top[1].score + Math.max(0, second) + 1))
  );
  const existingMatch = existing.find(
    (c) => String(c.name).toLowerCase() === String(top[0]).toLowerCase()
  );
  if (existingMatch && intelligence.preferExisting && intelligence.suggestExisting !== false)
    return {
      name: existingMatch.name,
      confidence: Math.max(confidence, 0.8),
      source: 'existing-category',
      suggestNew: false,
      countryCode: detectedCountry?.code || '',
      countryName: detectedCountry?.name || '',
    };
  if (confidence >= Number(intelligence.minConfidence || 0.72)) {
    const baseName = top[0];
    const countryPrefix = detectedCountry?.code ? `${detectedCountry.code} ` : '';
    const suggestedName = `${countryPrefix}${baseName}`.trim();
    const countryExisting = existing.find(
      (c) => String(c.name).toLowerCase() === suggestedName.toLowerCase()
    );
    return {
      name: countryExisting?.name || suggestedName,
      confidence,
      source: countryExisting ? 'existing-category' : top[1].source || 'knowledge-base',
      suggestNew: !countryExisting && intelligence.suggestNew,
      countryCode: detectedCountry?.code || '',
      countryName: detectedCountry?.name || '',
    };
  }
  return {
    name: 'Uncategorized',
    confidence,
    source: 'insufficient-confidence',
    suggestedName: intelligence.suggestNew
      ? `${detectedCountry?.code ? detectedCountry.code + ' ' : ''}${top[0]}`
      : '',
    countryCode: detectedCountry?.code || '',
    countryName: detectedCountry?.name || '',
  };
}
function extractObjectAfterMarker(text, marker) {
  const i = String(text || '').indexOf(marker);
  if (i < 0) return null;
  const start = String(text).indexOf('{', i);
  if (start < 0) return null;
  let depth = 0,
    q = false,
    e = false;
  for (let p = start; p < text.length; p++) {
    const c = text[p];
    if (q) {
      if (e) e = false;
      else if (c === '\\') e = true;
      else if (c === '"') q = false;
      continue;
    }
    if (c === '"') {
      q = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && !--depth) {
      try {
        return JSON.parse(text.slice(start, p + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}
async function youtubeSuggestions(query, type = 'channel') {
  const q = String(query || '').trim();
  if (!q) throw new Error('Suggestion search text is required.');
  const html = await (
    await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'text/html,application/xhtml+xml' },
    })
  ).text();
  const data = extractObjectAfterMarker(html, 'ytInitialData');
  const out = [];
  const seen = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    const c = node.channelRenderer;
    const p = node.playlistRenderer;
    if (type === 'channel' && c?.channelId) {
      const item = {
        type: 'channel',
        id: c.channelId,
        name: c.title?.simpleText || c.title?.runs?.map((x) => x.text).join('') || '',
        url: `https://www.youtube.com/channel/${c.channelId}`,
        thumbnail: c.thumbnail?.thumbnails?.slice(-1)[0]?.url || '',
      };
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
    if (type === 'playlist' && p?.playlistId) {
      const item = {
        type: 'playlist',
        id: p.playlistId,
        name: p.title?.simpleText || p.title?.runs?.map((x) => x.text).join('') || '',
        url: `https://www.youtube.com/playlist?list=${p.playlistId}`,
        thumbnail: p.thumbnails?.slice(-1)[0]?.url || '',
      };
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
  };
  walk(data);
  return out.slice(0, 30);
}
function localDatabaseSnapshot() {
  return Promise.all([
    chrome.storage.local.get('cmjFavChannels'),
    chrome.storage.local.get('cmjFavPlaylists'),
    chrome.storage.local.get('cmjFavCategories'),
    chrome.storage.local.get('cmjFavCollections'),
    chrome.storage.local.get('cmjYoutubeSuggestions'),
    chrome.storage.local.get('cmjYoutubeLibraryVideos'),
    chrome.storage.local.get('cmjYoutubeLibraryFavorites'),
  ]).then(([c, p, k, g, s, v, f]) => {
    const channels = Array.isArray(c.cmjFavChannels) ? c.cmjFavChannels : [],
      playlists = Array.isArray(p.cmjFavPlaylists) ? p.cmjFavPlaylists : [],
      categories = Array.isArray(k.cmjFavCategories) ? k.cmjFavCategories : [],
      groups = Array.isArray(g.cmjFavCollections) ? g.cmjFavCollections : [],
      suggestions = s.cmjYoutubeSuggestions || { channels: [], playlists: [] },
      videos = Array.isArray(v.cmjYoutubeLibraryVideos) ? v.cmjYoutubeLibraryVideos : [],
      favorites = Array.isArray(f.cmjYoutubeLibraryFavorites) ? f.cmjYoutubeLibraryFavorites : [];
    const byCat = (arr) => {
      const m = {};
      for (const x of arr) {
        const n = String(x.category || 'Uncategorized').trim() || 'Uncategorized';
        (m[n] ||= []).push(x);
      }
      return m;
    };
    return {
      channels,
      playlists,
      categories,
      groups,
      videos,
      favorites,
      suggestions,
      files: {
        channels: byCat(channels),
        playlists: byCat(playlists),
        categories: { 'all.json': categories },
        suggestions: {
          'channels.json': suggestions.channels || [],
          'playlists.json': suggestions.playlists || [],
        },
      },
    };
  });
}
function compareRecordIdentity(type, item, index = 0) {
  const x = item && typeof item === 'object' ? item : {};
  const id =
    type === 'channel'
      ? x.channelId || x.id || x.handle || x.url
      : type === 'playlist'
        ? x.playlistId || x.id || x.url
        : type === 'category'
          ? x.id || x.name
          : x.id || x.videoId || x.channelId || x.playlistId || x.url || x.name;
  return String(id || `${type}:${index}`).trim();
}
function compareNormalise(value) {
  if (Array.isArray(value)) return value.map(compareNormalise);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value)
      .sort()
      .forEach((key) => {
        out[key] = compareNormalise(value[key]);
      });
    return out;
  }
  return value;
}
function compareValue(value, max = 180) {
  let text = '';
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch (_) {
    text = String(value);
  }
  if (text === undefined) text = '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
function compareRecordSets(type, localRecords, githubRecords) {
  const local = Array.isArray(localRecords) ? localRecords : [];
  const github = Array.isArray(githubRecords) ? githubRecords : [];
  const localMap = new Map(local.map((item, i) => [compareRecordIdentity(type, item, i), item]));
  const githubMap = new Map(github.map((item, i) => [compareRecordIdentity(type, item, i), item]));
  const onlyLocal = [],
    onlyGithub = [],
    changed = [];
  for (const [id, item] of localMap) {
    if (!githubMap.has(id)) {
      onlyLocal.push({
        id,
        name: item?.name || item?.title || item?.handle || id,
        url: item?.url || '',
      });
      continue;
    }
    const remote = githubMap.get(id);
    if (JSON.stringify(compareNormalise(item)) !== JSON.stringify(compareNormalise(remote))) {
      const keys = new Set([...Object.keys(item || {}), ...Object.keys(remote || {})]);
      const fields = [];
      for (const key of [...keys].sort()) {
        const a = JSON.stringify(compareNormalise(item?.[key]));
        const b = JSON.stringify(compareNormalise(remote?.[key]));
        if (a !== b)
          fields.push({
            field: key,
            local: compareValue(item?.[key]),
            github: compareValue(remote?.[key]),
          });
      }
      changed.push({
        id,
        name: item?.name || item?.title || item?.handle || remote?.name || remote?.title || id,
        url: item?.url || remote?.url || '',
        fields,
      });
    }
  }
  for (const [id, item] of githubMap) {
    if (!localMap.has(id))
      onlyGithub.push({
        id,
        name: item?.name || item?.title || item?.handle || id,
        url: item?.url || '',
      });
  }
  return {
    localCount: local.length,
    githubCount: github.length,
    sameCount: local.length - onlyLocal.length - changed.length,
    onlyLocal,
    onlyGithub,
    changed,
  };
}
function jsonDataUrl(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'data:application/json;base64,' + btoa(binary);
}
async function githubConfig(settings) {
  const m = String(settings.githubUrl || '').match(/github\.com\/([^/]+)\/([^/#]+?)(?:\.git)?$/);
  if (!m) throw new Error('Enter a GitHub repository URL such as https://github.com/owner/repo.');
  return {
    owner: m[1],
    repo: m[2],
    branch: settings.branch || 'main',
    base: String(settings.databasePath || 'database').replace(/^\/+|\/+$/g, ''),
    token: String(settings.token || '').trim(),
  };
}
async function githubRequest(path, settings, init = {}) {
  const cfg = await githubConfig(settings);
  const headers = {
    Accept: 'application/vnd.github+json',
    ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    ...(init.headers || {}),
  };
  const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${path.replace(/^\/+/, '')}`;
  const r = await fetch(url, { ...init, headers });
  if (!r.ok) throw new Error(`GitHub HTTP ${r.status}`);
  return r.json();
}
async function githubRawRequest(path, settings) {
  const cfg = await githubConfig(settings);
  const branch = encodeURIComponent(cfg.branch).replace(/%2F/g, '/');
  const cleanPath = path.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${branch}/${cleanPath}`;
  const headers = cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {};
  const r = await fetch(url, { cache: 'no-store', headers });
  if (!r.ok) throw new Error(`GitHub raw HTTP ${r.status}`);
  return r.json();
}
async function githubTree(path, settings, options = {}) {
  try {
    const data = await githubRequest(path, settings);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if (options.optional && /GitHub HTTP 404/.test(String(error?.message || ''))) return [];
    throw error;
  }
}
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function u16(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}
function u32(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}
function zipStored(files) {
  const enc = new TextEncoder(),
    parts = [],
    central = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name),
      data = enc.encode(JSON.stringify(file.data, null, 2)),
      crc = crc32(data);
    const head = new Uint8Array(30 + name.length);
    head.set([0x50, 0x4b, 0x03, 0x04], 0);
    head.set(u16(20), 4);
    head.set(u16(0), 6);
    head.set(u16(0), 8);
    head.set(u16(0), 10);
    head.set(u16(0), 12);
    head.set(u32(crc), 14);
    head.set(u32(data.length), 18);
    head.set(u32(data.length), 22);
    head.set(u16(name.length), 26);
    head.set(u16(0), 28);
    head.set(name, 30);
    parts.push(head, data);
    const ch = new Uint8Array(46 + name.length);
    ch.set([0x50, 0x4b, 0x01, 0x02], 0);
    ch.set(u16(20), 4);
    ch.set(u16(20), 6);
    ch.set(u16(0), 8);
    ch.set(u16(0), 10);
    ch.set(u16(0), 12);
    ch.set(u16(0), 14);
    ch.set(u32(crc), 16);
    ch.set(u32(data.length), 20);
    ch.set(u32(data.length), 24);
    ch.set(u16(name.length), 28);
    ch.set(u16(0), 30);
    ch.set(u16(0), 32);
    ch.set(u16(0), 34);
    ch.set(u16(0), 36);
    ch.set(u32(0), 38);
    ch.set(u32(offset), 42);
    ch.set(name, 46);
    central.push(ch);
    offset += head.length + data.length;
  }
  const centralOffset = offset,
    centralSize = central.reduce((n, x) => n + x.length, 0);
  parts.push(...central);
  const end = new Uint8Array(22);
  end.set([0x50, 0x4b, 0x05, 0x06], 0);
  end.set(u16(0), 4);
  end.set(u16(0), 6);
  end.set(u16(files.length), 8);
  end.set(u16(files.length), 10);
  end.set(u32(centralSize), 12);
  end.set(u32(centralOffset), 16);
  end.set(u16(0), 20);
  parts.push(end);
  const blob = new Blob(parts, { type: 'application/zip' });
  return blob;
}
async function prepareDatabaseBackup() {
  const snap = await localDatabaseSnapshot();
  const files = [];
  for (const [type, groups] of Object.entries(snap.files)) {
    if (type === 'suggestions') {
      for (const [name, data] of Object.entries(groups))
        files.push({ name: `database/suggestions/${name}`, data });
      continue;
    }
    for (const [name, data] of Object.entries(groups)) {
      const safe = name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'uncategorized';
      files.push({ name: `database/${type}/${safe}.json`, data });
    }
  }
  files.push({
    name: 'database/indexes/channel-index.json',
    data: snap.channels.map((x) => ({
      id: x.channelId || x.id,
      name: x.name || x.title,
      category: x.category || '',
    })),
  });
  files.push({
    name: 'database/indexes/playlist-index.json',
    data: snap.playlists.map((x) => ({
      id: x.playlistId || x.id,
      name: x.name || x.title,
      category: x.category || '',
    })),
  });
  files.push({
    name: 'database/indexes/category-index.json',
    data: snap.categories.map((x) => ({ id: x.id, name: x.name })),
  });
  const metadataRoot = chrome.runtime.getURL('database/youtube-metadata-auto-categorization/');
  const metadataPaths = [
    'countries.json',
    'languages.json',
    'country-language-map.json',
    'country-keywords.json',
    'categories.json',
    'synonyms.json',
    'priority-rules.json',
    'keywords/default.json',
    'tags/default.json',
    'labels/default.json',
    'rules/default.json',
  ];
  for (const path of metadataPaths) {
    try {
      const response = await fetch(metadataRoot + path, { cache: 'no-store' });
      if (response.ok)
        files.push({
          name: `database/youtube-metadata-auto-categorization/${path}`,
          data: await response.json(),
        });
    } catch (_) {}
  }
  const techRoot = chrome.runtime.getURL('database/tech-profiles/');
  for (const name of [
    'devops',
    'frontend',
    'backend',
    'full-stack',
    'network',
    'cybersecurity',
    'cloud',
    'data',
    'graphic-design',
    'ui-ux',
    'database',
    'ai-ml',
    'student',
    'researcher',
  ]) {
    try {
      const response = await fetch(`${techRoot}${name}.json`, { cache: 'no-store' });
      if (response.ok)
        files.push({ name: `database/tech-profiles/${name}.json`, data: await response.json() });
    } catch (_) {}
  }
  const blob = zipStored(files);
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const url = 'data:application/zip;base64,' + btoa(binary);
  const filename = `Charlie-MJ-GitHub-Backup-${new Date().toISOString().slice(0, 10)}.zip`;
  await chrome.downloads.download({ url, filename, saveAs: false });
  return { files: files.length, filename };
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ytp:download') {
    (async () => {
      try {
        const settings = (await chrome.storage.local.get('settings')).settings || {};
        const s = settings.ytTranscriptPro || {};
        const cleanPart = (part) =>
          String(part || '')
            .replace(/[<>:"|?*\u0000-\u001f]/g, '-')
            .replace(/^\.+/, '')
            .trim();
        const folder = String(s.downloadFolder || '')
          .replace(/\\/g, '/')
          .split('/')
          .map(cleanPart)
          .filter(Boolean)
          .filter((x) => x !== '..');
        const name = cleanPart(message.filename) || 'youtube-transcript.txt';
        const filename = [...folder, name].join('/');
        const bytes = new TextEncoder().encode(
          (message.bom ? '\ufeff' : '') + String(message.content || '')
        );
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000)
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const url = `data:${message.mime || 'text/plain;charset=utf-8'};base64,${btoa(binary)}`;
        const id = await chrome.downloads.download({
          url,
          filename,
          saveAs: Boolean(s.saveAs),
          conflictAction: s.conflictAction || 'uniquify',
        });
        if (s.revealAfterDownload && id != null) chrome.downloads.show(id).catch(() => {});
        sendResponse({ ok: true, id });
      } catch (error) {
        sendResponse({ ok: false, error: String(error?.message || error) });
      }
    })();
    return true;
  }
  if (message?.type === 'ytp:openOptions' || message?.type === 'CMJ_OPEN_OPTIONS_CATEGORY') {
    // Open (or re-use) the Settings page directly on the requested tab/category.
    // Defaults to the YT Transcript Pro tab when opened from the transcript window.
    (async () => {
      try {
        const category = String(message.category || 'YT Transcript Pro');
        const base = chrome.runtime.getURL('src/options/options.html');
        const target = `${base}?category=${encodeURIComponent(category)}`;
        const existing = (await chrome.tabs.query({})).find(
          (t) => String(t.url || '').split(/[?#]/)[0] === base
        );
        if (existing) {
          await chrome.tabs.update(existing.id, { url: target, active: true });
          if (existing.windowId != null)
            chrome.windows.update(existing.windowId, { focused: true }).catch(() => {});
        } else {
          await chrome.tabs.create({ url: target });
        }
        sendResponse({ ok: true });
      } catch (error) {
        try {
          await chrome.runtime.openOptionsPage();
          sendResponse({ ok: true, fallback: true });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message || e) });
        }
      }
    })();
    return true;
  }
  if (message.type === 'CMJ_LIST_TRANSCRIPT_ENGINES') {
    sendResponse({ ok: true, engines: listTranscriptEngines() });
    return false;
  }
  if (message.type === 'CMJ_ALIGN_TRANSCRIPTS') {
    try {
      const aligned = alignTranscripts(
        Array.isArray(message.original) ? message.original : [],
        Array.isArray(message.translation) ? message.translation : []
      );
      sendResponse({ ok: true, aligned });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return false;
  }
  if (message.type === 'CMJ_FAVORITES') {
    (async () => {
      const action = message.action,
        type = message.itemType;
      let result;
      if (action === 'list') result = await listFavorites(type);
      else if (action === 'save') result = await saveFavorite(type, message.record || {});
      else if (action === 'update') {
        const beforeList = await listFavorites(type);
        const incoming = message.record || {};
        const identity = type === 'playlist' ? incoming.playlistId || incoming.url : incoming.channelId || incoming.handle || incoming.url;
        const before = beforeList.find((x) => String(type === 'playlist' ? x.playlistId || x.url : x.channelId || x.handle || x.url).toLowerCase() === String(identity || '').toLowerCase());
        result = await updateFavorite(type, incoming);
        const intelStore = await chrome.storage.local.get('cmjExtensionIntelligence');
        const intel = intelStore.cmjExtensionIntelligence || {};
        const category = String(result?.category || '').trim();
        if (category && category.toLowerCase() !== 'uncategorized' && category !== String(before?.category || '').trim() && intel.learnAccepted !== false)
          await learnCategoryFromMetadata(result, category, 'accepted');
      }
      else if (action === 'remove') result = await removeFavorite(type, message.id);
      else if (action === 'export') result = await exportFavorites();
      else if (action === 'import')
        result = await importFavorites(message.data, message.mode || 'merge');
      else if (action === 'categories') result = await getCategories();
      else if (action === 'setCategories') result = await setCategories(message.data);
      else if (action === 'collections') result = await getCollections();
      else if (action === 'setCollections') result = await setCollections(message.data);
      else if (action === 'txt') {
        const d = await exportFavorites();
        result = { text: favoritesToTxt(d) };
      } else if (action === 'refreshMetadata') {
        const r = await fetchYouTubeMetadata(message.url, type);
        result = await updateFavorite(type, { ...message.record, ...r });
      } else if (action === 'suggest') {
        const metadata = await fetchYouTubeMetadata(message.url, type);
        result = await suggestCategory(metadata);
            } else if (action === 'testCategory') {
        const metadata = message.metadata && typeof message.metadata === 'object'
          ? message.metadata
          : await fetchYouTubeMetadata(message.url, message.itemType === 'playlist' ? 'playlist' : 'channel');
        result = await suggestCategory(metadata, { forceDetailed: true });
      } else if (action === 'recategorize') {
        const intelligenceStore = await chrome.storage.local.get('cmjExtensionIntelligence');
        if (intelligenceStore.cmjExtensionIntelligence?.autoRecategorizeUncategorized === false)
          throw new Error('Bulk re-categorization is disabled in Extension Intelligence settings.');
        const type = message.itemType === 'playlist' ? 'playlist' : 'channel';
        const list = await listFavorites(type);
        const onlyUncategorized = message.onlyUncategorized !== false;
        const limit = Math.max(1, Math.min(1000, Number(message.limit) || 500));
        const updated = [];
        let changed = 0;
        for (const item of list.slice(0, limit)) {
          if (onlyUncategorized && String(item.category || '').trim() && String(item.category || '').trim().toLowerCase() !== 'uncategorized') {
            updated.push(item);
            continue;
          }
          try {
            const metadata = item.metadataLastChecked ? item : await fetchYouTubeMetadata(item.url, type);
            const suggestion = await suggestCategory(metadata);
            const min = Number((await chrome.storage.local.get('cmjExtensionIntelligence')).cmjExtensionIntelligence?.minConfidence || 0.72);
            if (suggestion.name !== 'Uncategorized' && Number(suggestion.confidence || 0) >= min) {
              updated.push({ ...item, ...metadata, category: suggestion.name, categorySuggestion: suggestion, categoryConfidence: suggestion.confidence, categoryEvidence: suggestion.evidence || [], categoryMatchedRules: suggestion.matchedRules || [] });
              changed += 1;
              continue;
            }
          } catch (_) {}
          updated.push(item);
        }
        await chrome.storage.local.set({ [type === 'playlist' ? 'cmjFavPlaylists' : 'cmjFavChannels']: updated });
        result = { scanned: Math.min(list.length, limit), changed, remainingUncategorized: updated.filter((x) => !String(x.category || '').trim() || String(x.category).toLowerCase() === 'uncategorized').length };
      } else if (action === 'add') {
        const url = String(message.url || '').trim();
        if (!url) throw new Error('YouTube URL is required.');
        const r = await fetchYouTubeMetadata(url, type);
        const suggestion = await suggestCategory(r);
        const explicit = String(message.record?.category || '').trim();
        const autoSuggestedCategory =
          !explicit &&
          suggestion.name &&
          suggestion.name !== 'Uncategorized' &&
          Number(suggestion.confidence || 0) >= Number((await chrome.storage.local.get('cmjExtensionIntelligence')).cmjExtensionIntelligence?.minConfidence || 0.72)
            ? suggestion.name
            : '';
        const category = explicit || autoSuggestedCategory || 'Uncategorized';
        result = await saveFavorite(type, {
          ...message.record,
          ...r,
          category,
          categorySuggestion: suggestion,
          countryCode: suggestion.countryCode || r.countryCode || message.record?.countryCode || '',
          countryName: suggestion.countryName || r.countryName || message.record?.countryName || '',
          languageCode: suggestion.languageCode || r.languageCode || message.record?.languageCode || '',
          detectedLanguageCode: suggestion.languageCode || r.languageCode || '',
          categoryConfidence: Number(suggestion.confidence || 0),
          categoryEvidence: suggestion.evidence || [],
          categoryMatchedRules: suggestion.matchedRules || [],
        });
        if (!explicit && suggestion.name !== 'Uncategorized' && suggestion.confidence >= 0.72) {
          result.categorySuggestion = suggestion;
        }
        try {
          const intelligenceStore = await chrome.storage.local.get('cmjExtensionIntelligence');
          const intel = intelligenceStore.cmjExtensionIntelligence || {};
          if (explicit && intel.learnAccepted !== false) await learnCategoryFromMetadata(r, explicit, 'accepted');
          if (explicit && suggestion.suggestedName && suggestion.suggestedName !== explicit && intel.learnRejected !== false)
            await learnCategoryFromMetadata(r, suggestion.suggestedName, 'rejected');
          if (!explicit && suggestion.name !== 'Uncategorized' && intel.learnAccepted !== false)
            await learnCategoryFromMetadata(r, suggestion.name, 'accepted');
        } catch (_) {}
      } else throw new Error('Unknown favorites action.');
      sendResponse({ ok: true, result });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_YOUTUBE_SUGGESTIONS') {
    (async () => {
      const type = message.itemType === 'playlist' ? 'playlist' : 'channel';
      const result = await youtubeSuggestions(message.query || '', type);
      const store = (await chrome.storage.local.get('cmjYoutubeSuggestions'))
        .cmjYoutubeSuggestions || { channels: [], playlists: [] };
      store[type === 'channel' ? 'channels' : 'playlists'] = result.map((x) => ({
        ...x,
        suggestedAt: new Date().toISOString(),
      }));
      await chrome.storage.local.set({ cmjYoutubeSuggestions: store });
      sendResponse({ ok: true, result });
    })().catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'CMJ_RELOAD_CATEGORY_KNOWLEDGE') {
    categoryKnowledgePromise = null;
    sendResponse({ ok: true });
    return false;
  }
  if (message.type === 'CMJ_DATABASE_SNAPSHOT') {
    localDatabaseSnapshot()
      .then(async (s) => {
        const files = [];
        for (const [type, groups] of Object.entries(s.files)) {
          if (type === 'suggestions') {
            for (const [name, data] of Object.entries(groups))
              files.push({ path: `suggestions/${name}`, data });
            continue;
          }
          for (const [name, data] of Object.entries(groups)) {
            const safe = name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() || 'uncategorized';
            files.push({ path: `${type}/${safe}.json`, data });
          }
        }
        files.push({
          path: 'indexes/channel-index.json',
          data: s.channels.map((x) => ({
            id: x.channelId || x.id,
            name: x.name || x.title,
            category: x.category || '',
          })),
        });
        files.push({
          path: 'indexes/playlist-index.json',
          data: s.playlists.map((x) => ({
            id: x.playlistId || x.id,
            name: x.name || x.title,
            category: x.category || '',
          })),
        });
        files.push({
          path: 'indexes/category-index.json',
          data: s.categories.map((x) => ({ id: x.id, name: x.name })),
        });

        const rulesBase = chrome.runtime.getURL('database/youtube-metadata-auto-categorization/');
        const storedRules =
          (await chrome.storage.local.get('cmjYoutubeMetadataRules')).cmjYoutubeMetadataRules || {};
        const ruleFiles = [
          ['keywords/default.json', storedRules.keywords || {}],
          ['tags/default.json', storedRules.tags || {}],
          ['labels/default.json', storedRules.labels || {}],
          ['rules/default.json', storedRules.rules || { rules: [] }],
        ];
        for (const [path, override] of ruleFiles) {
          try {
            const response = await fetch(rulesBase + path, { cache: 'no-store' });
            const baseData = response.ok ? await response.json() : {};
            const data =
              path === 'rules/default.json'
                ? { rules: [...(baseData.rules || []), ...(override.rules || [])] }
                : { ...baseData, ...override };
            files.push({
              path: `youtube-metadata-auto-categorization/${path}`,
              data,
            });
          } catch (_) {
            files.push({
              path: `youtube-metadata-auto-categorization/${path}`,
              data: override,
            });
          }
        }
        sendResponse({ ok: true, files });
      })
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'CMJ_DATA_SYNC_HEALTH') {
    (async () => {
      const cfg = await githubConfig(message.settings || {});
      const repo = await githubRequest('', message.settings || {});
      sendResponse({
        ok: true,
        message: `GitHub connected: ${repo.full_name || cfg.owner + '/' + cfg.repo} (${cfg.branch})`,
      });
    })().catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'CMJ_DATA_SYNC_COMPARE') {
    (async () => {
      const cfg = await githubConfig(message.settings || {});
      const local = await localDatabaseSnapshot();
      const root = await githubTree(cfg.base, message.settings || {});
      const directories = root.filter((x) => x.type === 'dir').map((x) => x.name);
      const github = {
        channels: [],
        playlists: [],
        categories: [],
        suggestions: [],
        directories,
        files: [],
      };
      for (const dirName of ['channels', 'playlists', 'categories', 'suggestions']) {
        const files = await githubTree(`${cfg.base}/${dirName}`, message.settings || {});
        for (const f of files.filter((x) => x.type === 'file' && x.name.endsWith('.json'))) {
          try {
            const payload = await (
              await fetch(f.download_url, {
                headers: { Accept: 'application/vnd.github.raw+json' },
              })
            ).json();
            const records = Array.isArray(payload)
              ? payload
              : payload && Array.isArray(payload.items)
                ? payload.items
                : [];
            const type =
              dirName === 'channels'
                ? 'channel'
                : dirName === 'playlists'
                  ? 'playlist'
                  : dirName === 'categories'
                    ? 'category'
                    : 'suggestion';
            github[dirName].push(...records);
            github.files.push({
              path: `${cfg.base}/${dirName}/${f.name}`,
              type: dirName,
              count: records.length,
            });
          } catch (_) {
            github.files.push({
              path: `${cfg.base}/${dirName}/${f.name}`,
              type: dirName,
              count: 0,
              error: 'Could not read JSON',
            });
          }
        }
      }
      const localSuggestions = [
        ...(local.suggestions?.channels || []),
        ...(local.suggestions?.playlists || []),
      ];
      const details = {
        channels: compareRecordSets('channel', local.channels, github.channels),
        playlists: compareRecordSets('playlist', local.playlists, github.playlists),
        categories: compareRecordSets('category', local.categories, github.categories),
        suggestions: compareRecordSets('suggestion', localSuggestions, github.suggestions),
      };
      const allOnlyLocal = Object.values(details).reduce((n, x) => n + x.onlyLocal.length, 0);
      const allOnlyGithub = Object.values(details).reduce((n, x) => n + x.onlyGithub.length, 0);
      const allChanged = Object.values(details).reduce((n, x) => n + x.changed.length, 0);
      const differenceCount = allOnlyLocal + allOnlyGithub + allChanged;
      const localTotal = local.channels.length + local.playlists.length + local.categories.length;
      const githubTotal =
        github.channels.length + github.playlists.length + github.categories.length;
      sendResponse({
        ok: true,
        summary: {
          local: {
            channels: local.channels.length,
            playlists: local.playlists.length,
            categories: local.categories.length,
            suggestions: localSuggestions.length,
            total: localTotal,
          },
          github: {
            channels: github.channels.length,
            playlists: github.playlists.length,
            categories: github.categories.length,
            suggestions: github.suggestions.length,
            total: githubTotal,
            directories,
          },
          differences: {
            onlyLocal: allOnlyLocal,
            onlyGithub: allOnlyGithub,
            changed: allChanged,
            total: differenceCount,
          },
          details,
          files: github.files,
          status: differenceCount
            ? `Comparison complete — ${differenceCount} difference(s) found.`
            : 'Comparison complete — Local and GitHub records match.',
        },
      });
    })().catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'CMJ_DATA_SYNC_PULL') {
    (async () => {
      const cfg = await githubConfig(message.settings || {});
      const dirs = await githubTree(cfg.base, message.settings || {});
      let count = 0;
      for (const dir of dirs.filter(
        (x) =>
          x.type === 'dir' &&
          ['channels', 'playlists', 'categories', 'suggestions', 'indexes'].includes(x.name)
      )) {
        const files = await githubTree(`${cfg.base}/${dir.name}`, message.settings || {});
        for (const f of files.filter((x) => x.type === 'file' && x.name.endsWith('.json'))) {
          const payload = await (
            await fetch(f.download_url, { headers: { Accept: 'application/vnd.github.raw+json' } })
          ).json();
          if (dir.name === 'channels') {
            const current = await listFavorites('channel');
            const merged = [...current];
            for (const x of Array.isArray(payload) ? payload : []) {
              const id = x.channelId || x.id;
              if (id && !merged.some((y) => (y.channelId || y.id) === id)) merged.push(x);
            }
            await chrome.storage.local.set({ cmjFavChannels: merged });
          } else if (dir.name === 'playlists') {
            const current = await listFavorites('playlist');
            const merged = [...current];
            for (const x of Array.isArray(payload) ? payload : []) {
              const id = x.playlistId || x.id;
              if (id && !merged.some((y) => (y.playlistId || y.id) === id)) merged.push(x);
            }
            await chrome.storage.local.set({ cmjFavPlaylists: merged });
          } else if (dir.name === 'categories' && Array.isArray(payload)) {
            await setCategories(payload);
          }
          count++;
        }
      }
      sendResponse({ ok: true, files: count });
    })().catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'CMJ_DATA_SYNC_BACKUP') {
    prepareDatabaseBackup()
      .then((files) => sendResponse({ ok: true, files }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (message.type === 'CMJ_OPEN_OPTIONS') {
    chrome.runtime
      .openOptionsPage()
      .then(() => sendResponse({ ok: true }))
      .catch(async () => {
        try {
          await chrome.tabs.create({ url: chrome.runtime.getURL('src/options/options.html') });
          sendResponse({ ok: true });
        } catch (error) {
          sendResponse({ ok: false, error: error.message });
        }
      });
    return true;
  }
  if (message.type === 'CMJ_YOUTUBE_CAPTIONS') {
    youtubeCaptions(
      message.videoId,
      message.source || 'auto',
      message.target || 'en',
      message.mode || 'bundle'
    )
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_TRANSLATE') {
    translate(
      message.text,
      message.source,
      message.target,
      message.provider,
      message.libreUrl,
      message.settings || {}
    )
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_DICTIONARY') {
    dictionaryLookup(
      message.text,
      message.source || 'en',
      message.target || 'en',
      message.settings || {}
    )
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_CAPTURE_TAB') {
    chrome.tabs
      .captureVisibleTab(sender.tab?.windowId, { format: 'png' })
      .then((dataUrl) =>
        getDownloadSettings().then((settings) =>
          chrome.downloads.download({
            url: dataUrl,
            filename: message.filename || 'Charlie MJ Language/Screenshots/capture.png',
            saveAs: Boolean(settings.downloadSaveAs),
          })
        )
      )
      .then((id) => sendResponse({ ok: true, id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_DOWNLOAD_DATA') {
    let base64;
    if (message.dataUrl) base64 = message.dataUrl;
    else {
      const bytes = new TextEncoder().encode(message.text || '');
      base64 = `data:${message.mime || 'text/plain'};base64,${btoa(String.fromCharCode(...bytes))}`;
    }
    getDownloadSettings()
      .then((settings) =>
        chrome.downloads.download({
          url: base64,
          filename: message.filename || 'charlie-mj.txt',
          saveAs: Boolean(settings.downloadSaveAs),
        })
      )
      .then((id) => sendResponse({ ok: true, id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    return null;
  }
}
/** Read the local download preference before placing a generated file. */
async function getDownloadSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { downloadSaveAs: false, ...(stored.settings || {}) };
}
function youtubeCaptionText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const out = [];
  if (raw.startsWith('{')) {
    try {
      const json = JSON.parse(raw);
      for (const e of json.events || []) {
        const value = (e.segs || [])
          .map((x) => x.utf8 || '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        if (value)
          out.push({
            start: Number(e.tStartMs || 0) / 1000,
            duration: Number(e.dDurationMs || 0) / 1000,
            text: value,
          });
      }
    } catch (_) {}
    return out;
  }
  const decode = (v) =>
    String(v || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = re.exec(raw))) {
    const a = m[1] || '';
    const body = decode(m[2].replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (!body) continue;
    const attr = (n) => {
      const q = a.match(new RegExp('\\b' + n + '=(?:\"([^\"]*)\"|\'([^\']*)\')'));
      return q ? (q[1] ?? q[2] ?? '') : '';
    };
    out.push({ start: Number(attr('start') || 0), duration: Number(attr('dur') || 0), text: body });
  }
  return out;
}
async function youtubeWatchPageCaptions(videoId, source = 'auto', target = 'en') {
  const html = await (
    await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'text/html,application/xhtml+xml' },
    })
  ).text();
  const response = extractObjectAfterMarker(html, 'ytInitialPlayerResponse');
  const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (!tracks.length) throw new Error('Watch page did not expose caption tracks.');
  const cleanTracks = tracks
    .map((t) => ({
      baseUrl: String(t.baseUrl || '').replace(/\\u0026/g, '&'),
      languageCode: t.languageCode || '',
      name: t.name?.simpleText || '',
      kind: t.kind || '',
      isTranslatable: t.isTranslatable !== false,
    }))
    .filter((t) => t.baseUrl);
  const lang = (x) =>
      String(x || '')
        .split('-')[0]
        .toLowerCase(),
    src = lang(source),
    tgt = lang(target),
    find = (l) =>
      cleanTracks.find((t) => lang(t.languageCode) === l && t.kind !== 'asr') ||
      cleanTracks.find((t) => lang(t.languageCode) === l);
  const sourceTrack =
      (src && src !== 'auto' ? find(src) : null) ||
      cleanTracks.find((t) => t.kind === 'asr') ||
      cleanTracks[0],
    native = find(tgt);
  const fetchTrack = async (track, auto) => {
    if (!track?.baseUrl) return [];
    const u = new URL(track.baseUrl);
    u.searchParams.set('fmt', 'json3');
    if (auto && tgt) u.searchParams.set('tlang', tgt);
    const r = await withTimeout(
      fetch(u.toString(), {
        credentials: 'include',
        cache: 'no-store',
        headers: { accept: 'application/json,text/plain,*/*' },
      }),
      4500
    );
    if (!r.ok) throw new Error(`Caption HTTP ${r.status}`);
    return youtubeCaptionText(await r.text());
  };
  let original = [],
    translation = [],
    translationSource = '';
  try {
    original = await fetchTrack(sourceTrack, false);
  } catch (e) {}
  if (native && lang(native.languageCode) !== lang(sourceTrack.languageCode)) {
    try {
      translation = await fetchTrack(native, false);
      translationSource = 'YouTube Native';
    } catch (e) {}
  }
  if (!translation.length && sourceTrack && tgt && tgt !== lang(sourceTrack.languageCode)) {
    try {
      translation = await fetchTrack(sourceTrack, true);
      if (translation.length) translationSource = 'YouTube Auto-Translation';
    } catch (e) {}
  }
  if (!original.length && !translation.length)
    throw new Error('YouTube caption tracks were found but could not be read.');
  return {
    ok: true,
    videoId,
    tracks: cleanTracks,
    original,
    translation,
    translationSource: translationSource || 'YouTube Auto-Translation',
    sourceLanguage: sourceTrack?.languageCode || src,
    targetLanguage: tgt,
    method: 'watch-page',
  };
}
async function youtubeCaptions(videoId, source = 'auto', target = 'en', mode = 'bundle') {
  const id = String(videoId || '').trim();
  if (!id) throw new Error('Missing YouTube video ID.');
  let last = '';
  // The active YouTube page bridge is the primary/authoritative route.
  // Background player recreation was removed because it can trigger YouTube
  // player HTTP 403 and is unnecessary when the user is already on the video.
  try {
    const page = await youtubeWatchPageCaptions(id, source, target);
    if (page.original?.length || page.translation?.length) return page;
  } catch (error) {
    last = error.message;
  }
  throw new Error(
    /403/i.test(last)
      ? 'YouTube caption access was rejected outside the active page session. Reload the YouTube video and try the original transcript again; the extension does not create a second background player request.'
      : last || 'YouTube did not expose caption data for this video.'
  );
}
async function withTimeout(promise, ms) {
  const timeout = Math.max(500, Number(ms) || 5000);
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Provider timeout')), timeout)),
  ]);
}
async function fetchJson(url, options = {}, timeout = 5000) {
  const response = await withTimeout(fetch(url, options), timeout);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function normalisePriority(settings) {
  const defaults = [
    'youtube-captions',
    'google',
    'microsoft',
    'mymemory',
    'libretranslate',
    'deepl',
  ];
  const raw = Array.isArray(settings.translationProviderPriority)
    ? settings.translationProviderPriority
    : defaults;
  const aliases = {
    youtube: 'youtube-captions',
    'youtube-native': 'youtube-captions',
    'youtube-auto': 'youtube-captions',
    'youtube subtitle': 'youtube-captions',
    'youtube-subtitle': 'youtube-captions',
    'youtube auto': 'youtube-captions',
    'youtube-auto-translation': 'youtube-captions',
  };
  const out = [];
  for (const item of raw) {
    const k =
      aliases[
        String(item || '')
          .trim()
          .toLowerCase()
      ] ||
      String(item || '')
        .trim()
        .toLowerCase();
    if (k && !out.includes(k)) out.push(k);
  }
  for (const k of defaults) if (!out.includes(k)) out.push(k);
  return out;
}
function providerList(settings, requested) {
  const configured = normalisePriority(settings);
  const enabled = settings.enabledTranslationProviders || {};
  const filtered = configured.filter((p) => p !== 'youtube-captions' && enabled[p] === true);
  if (
    requested &&
    requested !== 'youtube-first' &&
    requested !== 'auto' &&
    enabled[requested] === true
  )
    return [requested, ...filtered.filter((x) => x !== requested)];
  return filtered;
}
async function providerTranslate(provider, text, source, target, settings) {
  const timeout = settings.translationTimeoutMs || 5000;
  const keys = settings.translationApiKeys || {};
  if (provider === 'google') {
    const key = keys.google;
    if (!key) throw new Error('Google API key is not configured.');
    const data = await fetchJson(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: source === 'auto' ? undefined : source,
          target,
          format: 'text',
        }),
      },
      timeout
    );
    return data?.data?.translations?.[0]?.translatedText || '';
  }
  if (provider === 'microsoft') {
    const key = keys.microsoft;
    if (!key) throw new Error('Microsoft Translator API key is not configured.');
    const headers = { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': key };
    if (settings.microsoftRegion)
      headers['Ocp-Apim-Subscription-Region'] = settings.microsoftRegion;
    const data = await fetchJson(
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${encodeURIComponent(target)}${source && source !== 'auto' ? `&from=${encodeURIComponent(source)}` : ''}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify([{ Text: text }]),
      },
      timeout
    );
    return data?.[0]?.translations?.[0]?.text || '';
  }
  if (provider === 'deepl') {
    const key = keys.deepl;
    if (!key) throw new Error('DeepL API key is not configured.');
    const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const body = new URLSearchParams({
      text,
      target_lang: String(target || 'EN')
        .replace('-', '_')
        .toUpperCase(),
    });
    if (source && source !== 'auto')
      body.set('source_lang', String(source).replace('-', '_').toUpperCase());
    const data = await fetchJson(
      `${host}/v2/translate`,
      {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
      timeout
    );
    return data?.translations?.[0]?.text || '';
  }
  if (provider === 'libretranslate') {
    const base = (settings.libreTranslateUrl || '').replace(/\/$/, '');
    if (!base) throw new Error('LibreTranslate server URL is not configured.');
    const data = await fetchJson(
      `${base}/translate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source, target, format: 'text' }),
      },
      timeout
    );
    return data?.translatedText || '';
  }
  if (provider === 'argos') {
    const base = (settings.argosUrl || '').replace(/\/$/, '');
    if (!base) throw new Error('Argos local service is not configured.');
    const data = await fetchJson(
      `${base}/translate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source, target }),
      },
      timeout
    );
    return data?.translatedText || data?.translation || '';
  }
  if (provider === 'mymemory') {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source || 'auto')}|${encodeURIComponent(target)}`;
    const data = await fetchJson(url, {}, timeout);
    return data?.responseData?.translatedText || '';
  }
  throw new Error(`Unknown translation provider: ${provider}`);
}
async function translate(
  text,
  source = 'auto',
  target = 'en',
  provider = 'youtube-first',
  libreUrl = '',
  incomingSettings = {}
) {
  const stored = await chrome.storage.local.get('settings');
  const settings = { ...(stored.settings || {}), ...(incomingSettings || {}) };
  if (libreUrl && !settings.libreTranslateUrl) settings.libreTranslateUrl = libreUrl;
  const value = String(text || '').trim();
  if (!value) return { translation: '', source: 'none', status: 'empty' };
  if (value.length > (settings.maxTranslationLength || 2000))
    throw new Error(`Text exceeds the ${settings.maxTranslationLength || 2000}-character limit.`);
  if (settings.privacyMode && !settings.offlineOnly) settings.onlineOnly = false;
  const sourceKey = source || 'auto',
    targetKey = target || 'en';
  const cacheKey = `translation:${sourceKey}:${targetKey}:${value}`;
  if (settings.translationCache !== false) {
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) {
      const entry = cached[cacheKey];
      if (entry && typeof entry === 'object' && entry.translation)
        return {
          translation: entry.translation,
          provider: entry.provider || 'cache',
          source: sourceKey,
          target: targetKey,
          status: 'cached',
          cached: true,
        };
      return {
        translation: entry,
        provider: 'cache',
        source: sourceKey,
        target: targetKey,
        status: 'cached',
        cached: true,
      };
    }
  }
  if (settings.offlineOnly && !settings.argosUrl)
    throw new Error('Offline-only mode requires an Argos local service.');
  const candidates = settings.offlineOnly
    ? ['argos']
    : settings.privacyMode
      ? ['argos']
      : settings.onlineOnly
        ? providerList(settings, provider).filter((p) => p !== 'argos')
        : providerList(settings, provider);
  const errors = [];
  for (
    let attempt = 0;
    attempt <= Math.max(0, Number(settings.translationRetries) || 0);
    attempt++
  ) {
    for (const candidate of candidates) {
      if (candidate === 'argos' && !settings.argosUrl) continue;
      try {
        const translation = await providerTranslate(
          candidate,
          value,
          sourceKey,
          targetKey,
          settings
        );
        if (!translation) throw new Error('Empty translation');
        if (settings.translationCache !== false)
          await chrome.storage.local.set({
            [cacheKey]: {
              translation,
              provider: candidate,
              source: sourceKey,
              target: targetKey,
              updatedAt: new Date().toISOString(),
            },
          });
        let verification = [];
        if (settings.verificationMode) {
          const verifyCandidates = providerList(settings, provider)
            .filter(
              (p) => (p !== candidate && p !== 'argos') || (p === 'argos' && settings.argosUrl)
            )
            .slice(0, 3);
          const results = await Promise.allSettled(
            verifyCandidates.map((p) => providerTranslate(p, value, sourceKey, targetKey, settings))
          );
          verification = results.map((r, i) => ({
            provider: verifyCandidates[i],
            translation: r.status === 'fulfilled' ? r.value : '',
            status: r.status === 'fulfilled' ? 'ok' : 'unavailable',
          }));
          const normalized = [
            translation,
            ...verification
              .filter((x) => x.translation)
              .map((x) => x.translation)
              .map((x) => x.trim().toLowerCase()),
          ];
          const agreement = verification
            .filter((x) => x.translation)
            .every((x) => x.translation.trim().toLowerCase() === translation.trim().toLowerCase())
            ? verification.length
              ? 'High Agreement'
              : 'Single Result'
            : verification.length
              ? 'Different Translations'
              : 'Single Result';
          return {
            translation,
            provider: candidate,
            source: sourceKey,
            target: targetKey,
            status: 'translated',
            cached: false,
            verification,
            agreement,
          };
        }
        return {
          translation,
          provider: candidate,
          source: sourceKey,
          target: targetKey,
          status: 'translated',
          cached: false,
        };
      } catch (error) {
        errors.push(`${candidate}: ${error.message}`);
      }
    }
  }
  throw new Error(
    errors.length ? errors.join(' • ') : 'No configured translation provider is available.'
  );
}
function referenceLinks(word, source, target) {
  const w = encodeURIComponent(String(word || '').trim());
  const src = String(source || 'en').split('-')[0];
  const links = [
    { name: 'Wiktionary', url: `https://${src}.wiktionary.org/wiki/${w}` },
    {
      name: 'Cambridge Dictionary',
      url: `https://dictionary.cambridge.org/dictionary/english/${w}`,
    },
    {
      name: 'Collins Dictionary',
      url: `https://www.collinsdictionary.com/dictionary/english/${w}`,
    },
    { name: 'Merriam-Webster', url: `https://www.merriam-webster.com/dictionary/${w}` },
    {
      name: "Oxford Learner's Dictionaries",
      url: `https://www.oxfordlearnersdictionaries.com/definition/english/${w}`,
    },
    { name: 'Glosbe', url: `https://glosbe.com/${src}/en/${w}` },
    { name: 'Reverso Context', url: `https://context.reverso.net/translation/${src}-english/${w}` },
    { name: 'Tureng', url: `https://tureng.com/en/turkish-english/${w}` },
    { name: 'Rekhta', url: `https://www.rekhtadictionary.com/search/${w}` },
  ];
  return links;
}
async function dictionaryLookup(text, source = 'en', target = 'en', settings = {}) {
  const value = String(text || '').trim();
  if (!value) return { ok: false, entries: [] };
  if (settings.dictionaryEnabled === false || settings.privacyMode)
    return { ok: false, entries: [], status: 'disabled' };
  const lang = String(source || 'en').split('-')[0];
  const refs = referenceLinks(value, source, target);
  const dictTimeout = Math.max(1500, Math.min(5000, Number(settings.dictionaryTimeoutMs) || 2500));
  // Use the English Wiktionary REST endpoint as the universal runtime layer.
  // It contains entries for Turkish, Urdu, Arabic, Persian/Farsi and many
  // other languages, while avoiding a multi-hundred-MB bundled dictionary.
  if (settings.dictionaryWiktionaryEnabled !== false) {
    try {
      const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(value)}`;
      const data = await fetchJson(url, {}, dictTimeout);
      const entries = [];
      for (const [code, defs] of Object.entries(data || {})) {
        for (const d of Array.isArray(defs) ? defs : []) {
          const meanings = (d.definitions || []).map((x) => ({
            definition: x.definition || '',
            example: (x.examples || []).map((e) => e.text || '').filter(Boolean),
            synonyms: (x.synonyms || []).map((x) => x.word || x).filter(Boolean),
          }));
          entries.push({
            word: value,
            language: code,
            pos: d.partOfSpeech || '',
            phonetic: d.pronunciation?.text || '',
            meanings,
          });
        }
      }
      if (entries.length)
        return {
          ok: true,
          entries,
          source: 'Wiktionary / Kaikki',
          sourceUrl: refs[0].url,
          dictionary: { word: value, language: lang, entries },
          referenceLinks: settings.dictionaryReferenceLinks === false ? [] : refs,
        };
    } catch (_) {}
  }
  const endpoint = (
    settings.dictionaryEndpoint || 'https://api.dictionaryapi.dev/api/v2/entries'
  ).replace(/\/$/, '');
  try {
    if (lang !== 'en') throw new Error('No English-only fallback for this language.');
    const data = await fetchJson(`${endpoint}/en/${encodeURIComponent(value)}`, {}, dictTimeout);
    return {
      ok: true,
      entries: Array.isArray(data) ? data : [],
      source: 'DictionaryAPI.dev',
      sourceUrl: `${endpoint}/${encodeURIComponent(lang)}/${encodeURIComponent(value)}`,
      dictionary: { word: value, language: lang, entries: Array.isArray(data) ? data : [] },
      referenceLinks: settings.dictionaryReferenceLinks === false ? [] : refs,
    };
  } catch (error) {
    return {
      ok: false,
      entries: [],
      error: error.message,
      source: 'Wiktionary / Kaikki',
      referenceLinks: settings.dictionaryReferenceLinks === false ? [] : refs,
    };
  }
}
