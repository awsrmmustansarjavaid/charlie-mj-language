/* Single source of truth for every setting. Used by the page, popup and options page. */
(() => {
  const root = typeof window !== 'undefined' ? (window.YTP = window.YTP || {}) : {};
  root.DEFAULTS = {
    /* General */
    buttonPosition: 'start', // start | beforeSettings | end
    panelMode: 'docked', // docked | floating
    autoOpen: false,
    rememberLanguages: true,
    preferredLanguages: '', // comma separated, first match wins; empty = use the video's own captions
    sourceLanguage: '',
    targetLanguage: '',

    /* Transcript */
    timestamps: true,
    timestampFormat: 'auto', // auto | mmss | hhmmss | seconds | ms
    timestampWrap: 'brackets', // brackets | parens | none
    timestampSeparator: ' ', // " " | " - " | " — " | "\t"
    removeDuplicates: true,
    cleanTags: true,
    removeSoundCues: false,
    mergeParagraphs: false,
    paragraphGap: 2.5,
    includeHeader: false,
    removeBlankLines: true,

    /* Dual language */
    dualMode: true,
    dualLayout: 'stacked', // stacked | side | delimited
    swapOrder: false,
    copyScope: 'both', // both | original | translation
    delimiter: ' | ',
    showOriginal: true,
    showTranslation: true,
    showLineCopy: true,
    showLineSave: true, // per-line "Save to My Library > Subtitle Learning" button
    lineCopyTimestamp: true,
    lineCopyScope: 'both', // both | original | translation

    /* Appearance */
    theme: 'dark', // system | light | dark | custom
    colorBg: '#ffffff',
    colorText: '#0f0f0f',
    colorOriginal: '#0f0f0f',
    colorTranslation: '#5a5a5a',
    colorTime: '#cc0000',
    colorAccent: '#e62117',
    colorActive: '#fde8e6',
    colorBorder: '#e3e3e3',
    colorHeader: '#f7f7f7',
    fontFamily: 'system', // system | serif | mono | rounded
    fontSize: 14,
    translationSize: 13,
    lineHeight: 1.5,
    panelWidth: 420, // floating window width
    panelHeight: 560, // floating window height
    listHeight: 480, // transcript list height when docked
    radius: 12,
    opacity: 100,
    density: 'comfortable', // compact | comfortable
    highlightStyle: 'bar', // bar | fill | underline
    floatX: -1,
    floatY: -1,

    /* Copy & export */
    lineEnding: 'lf', // lf | crlf
    csvDelimiter: ',',
    includeBom: true,
    notifyOnCopy: true,
    showFormats: 'txt,srt,vtt,csv',
    srtMinDuration: 1,

    /* Download */
    filenameTemplate: '{title}',
    downloadFolder: '',
    saveAs: false,
    conflictAction: 'uniquify', // uniquify | overwrite | prompt
    revealAfterDownload: false,

    /* Player & sync */
    autoScroll: true,
    highlightCurrent: true,
    clickToSeek: true,
    resumeScrollDelay: 4,
    scrollBehavior: 'smooth', // smooth | auto
    seekOffset: 0,

    /* Shortcuts (in-page) */
    keyTogglePanel: 'Alt+T',
    keyCopyTime: 'Alt+C',
    keyCopyClean: 'Alt+Shift+C',
    keyDownloadTxt: 'Alt+D',
    keyFocusSearch: 'Alt+F',

    /* Advanced */
    debug: false,
  };
  root.STORAGE_KEY = 'settings.ytTranscriptPro';
  if (typeof module !== 'undefined') module.exports = root;
})();
