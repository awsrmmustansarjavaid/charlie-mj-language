/* Shared lightweight POS/morphology styling for transcript surfaces. */
(() => {
  'use strict';
  if (window.CMJLanguageIntelligence) return;

  const POS = {
    noun: '#38bdf8',
    verb: '#fb7185',
    adjective: '#a78bfa',
    adverb: '#4ade80',
    pronoun: '#facc15',
    preposition: '#f472b6',
    conjunction: '#fb923c',
    determiner: '#818cf8',
    numeral: '#a3e635',
    particle: '#22d3ee',
    other: '#e2e8f0',
  };
  const DEFAULT_COLORS = {
    ...POS,
    turkishSuffix: '#c084fc',
    turkishCase: '#f59e0b',
    turkishPlural: '#34d399',
    turkishPossessive: '#60a5fa',
    turkishTense: '#f87171',
    turkishPerson: '#fb7185',
  };
  let settings = {};

  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>'"]/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[c]
    );

  async function load() {
    try {
      settings = (await chrome.storage.local.get('settings')).settings || {};
    } catch (_) {
      settings = {};
    }
  }
  load();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) settings = changes.settings.newValue || {};
    });
  } catch (_) {}

  function colors() {
    return { ...DEFAULT_COLORS, ...(settings.grammarColors || {}) };
  }

  function analyze(word) {
    const source = String(settings.sourceLanguage || 'tr');
    const lower = String(word || '').toLocaleLowerCase(source.startsWith('tr') ? 'tr' : undefined);
    let pos = 'other';
    if (/^(i|you|he|she|we|they|me|him|her|us|them|ben|sen|o|biz|siz|onlar)$/i.test(lower))
      pos = 'pronoun';
    else if (/^(the|a|an|bir|bu|şu|o)$/i.test(lower)) pos = 'determiner';
    else if (/^(and|or|but|because|ve|veya|ama|çünkü|fakat|ile)$/i.test(lower)) pos = 'conjunction';
    else if (/^(in|on|at|from|to|for|of|ile|için|den|dan|de|da)$/i.test(lower))
      pos = source.startsWith('tr') ? 'particle' : 'preposition';
    else if (
      /^(very|really|quickly|slowly|çok|daha|en|hemen|şimdi|burada|orada|nasıl)$/i.test(lower)
    )
      pos = 'adverb';
    else if (
      /(mak|mek|yor|di|dı|du|dü|miş|mış|acak|ecek|abilir|ebilir|iyorum|ıyorum|uyorum|üyorum)$/i.test(
        lower
      )
    )
      pos = 'verb';
    else if (/(li|lı|lu|lü|siz|sız|suz|süz|sel|sal|ful|less|ous|ive|al)$/i.test(lower))
      pos = 'adjective';
    else if (/^\d+(?:[.,]\d+)?$/.test(lower)) pos = 'numeral';
    else pos = lower.length <= 6 ? 'noun' : 'other';
    return { pos, color: colors()[pos] || POS[pos] || colors().other };
  }

  function morphology(word) {
    const lower = String(word || '').toLocaleLowerCase('tr');
    const c = colors();
    const rules = [
      [
        'turkishCase',
        /(den|dan|ten|tan|de|da|te|ta|ye|ya|e|a|yi|yı|yu|yü|i|ı|u|ü|nin|nın|nun|nün)$/,
      ],
      ['turkishPossessive', /(ımız|imiz|umuz|ümüz|ınız|iniz|unuz|ünüz|ım|im|um|üm|ın|in|un|ün)$/],
      ['turkishPlural', /(lar|ler)$/],
      ['turkishTense', /(iyor|ıyor|uyor|üyor|miş|mış|muş|müş|di|dı|du|dü|acak|ecek|ar|er)$/],
      [
        'turkishPerson',
        /(im|ım|um|üm|sin|sın|sun|sün|iz|ız|uz|üz|siniz|sınız|sunuz|sünüz|lar|ler)$/,
      ],
      [
        'turkishSuffix',
        /(lik|lık|luk|lük|ci|cı|cu|cü|daş|taş|sel|sal|siz|sız|suz|süz|li|lı|lu|lü)$/,
      ],
    ];
    return rules
      .map(([key, re]) => {
        const match = lower.match(re);
        return match ? { key, suffix: match[0], color: c[key] } : null;
      })
      .filter(Boolean);
  }

  function enabled(key) {
    return settings[key] === true;
  }

  function renderNodes(text, { translated = false, sourceText = '', enabledKey, query = '' } = {}) {
    if (!enabled(enabledKey)) return [document.createTextNode(String(text ?? ''))];
    const sourceWords = String(sourceText || '')
      .split(/\s+/)
      .filter(Boolean);
    let index = 0;
    return String(text ?? '')
      .split(/(\s+)/)
      .map((part) => {
        if (/^\s+$/.test(part)) return document.createTextNode(part);
        const word = part.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’_-]+$/gu, '');
        if (!word) return document.createTextNode(part);
        const info =
          translated && sourceWords.length
            ? analyze(sourceWords[Math.min(index, sourceWords.length - 1)])
            : analyze(word);
        index += 1;
        const span = document.createElement('span');
        span.className = `cmj-li-word cmj-li-${info.pos}`;
        span.style.setProperty('--cmj-li-pos', info.color);
        span.textContent = part;
        if (!translated && String(settings.sourceLanguage || '').startsWith('tr')) {
          const morph = morphology(word);
          if (morph.length) {
            span.dataset.cmjMorphology = morph.map((x) => x.key).join(' ');
            span.title = morph.map((x) => x.key).join(' · ');
          }
        }
        if (!translated && settings.dualTranscriptLanguageIntelligenceEnabled === true)
          span.classList.add('cmj-li-original');
        if (!translated && settings.ytpTranscriptLanguageIntelligenceEnabled === true)
          span.classList.add('cmj-li-original');
        if (query) {
          const source = span.textContent || '';
          const lower = source.toLocaleLowerCase();
          const needle = String(query).toLocaleLowerCase();
          const at = needle ? lower.indexOf(needle) : -1;
          if (at >= 0) {
            span.replaceChildren(
              document.createTextNode(source.slice(0, at)),
              Object.assign(document.createElement('mark'), {
                textContent: source.slice(at, at + needle.length),
              }),
              document.createTextNode(source.slice(at + needle.length))
            );
          }
        }
        return span;
      });
  }

  window.CMJLanguageIntelligence = {
    renderNodes,
    enabled,
    analyze,
    morphology,
    colors,
    settings: () => ({ ...settings }),
  };
})();
