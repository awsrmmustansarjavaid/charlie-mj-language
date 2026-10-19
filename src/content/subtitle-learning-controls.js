(() => {
  'use strict';

  const API_NAME = '__CMJSubtitleLearningAPI';

  const DEFAULTS = {
    autoPauseAfterSubtitle: false,
    subtitleLearningAutoResumeDelay: 3,
    subtitleLearningKeepSubtitleVisible: true,
    subtitleLearningReplayAudioCount: 2
  };

  let api = null;
  let lastVideo = null;
  let lastCaptionKey = '';
  let lastWasPlaying = false;
  let autoResumeTimer = null;
  let autoPausedKey = '';
  let replaySession = null;
  let replaySeeking = false;
  let pollTimer = null;
  let fallbackTimer = null;

  function getApi() {
    return window[API_NAME] || null;
  }

  function getSettings() {
    return {
      ...DEFAULTS,
      ...(api?.getSettings?.() || {})
    };
  }

  function getVideo() {
    return api?.getVideo?.() || document.querySelector('video');
  }

  function getLayer() {
    return document.querySelector('.cmj-subtitle-layer');
  }

  function clearAutoResume() {
    if (autoResumeTimer) {
      clearTimeout(autoResumeTimer);
      autoResumeTimer = null;
    }

    autoPausedKey = '';

    getLayer()?.classList.remove('cmj-subtitle-learning-hidden');
  }

  function scheduleAutoResume(video, captionKey) {
    clearAutoResume();

    const settings = getSettings();

    if (!settings.autoPauseAfterSubtitle) return;

    const delaySeconds = Math.max(
      0.1,
      Math.min(
        60,
        Number(settings.subtitleLearningAutoResumeDelay) || 3
      )
    );

    autoPausedKey = captionKey;

    if (settings.subtitleLearningKeepSubtitleVisible !== false) {
      getLayer()?.classList.remove('cmj-subtitle-learning-hidden');
    } else {
      getLayer()?.classList.add('cmj-subtitle-learning-hidden');
    }

    autoResumeTimer = setTimeout(() => {
      autoResumeTimer = null;

      const currentVideo = getVideo();
      const currentBounds = api?.getCurrentCaptionBounds?.();
      const currentKey = currentBounds?.key || '';

      if (!currentVideo || currentVideo !== video || !currentVideo.paused) {
        return;
      }

      if (
        !getSettings().autoPauseAfterSubtitle ||
        currentKey !== captionKey
      ) {
        return;
      }

      currentVideo.play().catch(() => {});

      autoPausedKey = '';

      getLayer()?.classList.remove(
        'cmj-subtitle-learning-hidden'
      );
    }, delaySeconds * 1000);
  }

  function updateAutoPauseState() {
    const settings = getSettings();

    if (!settings.autoPauseAfterSubtitle) {
      clearAutoResume();
    }

    const toolbar = document.querySelector('.cmj-toolbar');

    const button = toolbar?.querySelector(
      '[data-cmj-toolbar="auto-pause"]'
    );

    if (button) {
      const active = Boolean(settings.autoPauseAfterSubtitle);

      button.classList.toggle(
        'cmj-toolbar-active',
        active
      );

      button.setAttribute(
        'aria-pressed',
        String(active)
      );
    }
  }

  async function toggleAutoPause() {
    const settings = getSettings();

    const enabled = !settings.autoPauseAfterSubtitle;

    if (api?.updateSettings) {
      await api.updateSettings({
        autoPauseAfterSubtitle: enabled
      });
    } else {
      const stored = await chrome.storage.local.get('settings');

      await chrome.storage.local.set({
        settings: {
          ...(stored.settings || {}),
          autoPauseAfterSubtitle: enabled
        }
      });
    }

    if (!enabled) {
      clearAutoResume();
      stopFallback();
    } else {
      startFallback();
    }

    updateAutoPauseState();

    api?.showToast?.(
      enabled
        ? 'Auto-Pause enabled.'
        : 'Auto-Pause disabled.'
    );
  }

  function markReplayButton(active) {
    document
      .querySelectorAll(
        '[data-cmj-toolbar="replay-audio"]'
      )
      .forEach(button => {
        button.classList.toggle(
          'cmj-toolbar-action-complete',
          active
        );

        button.setAttribute(
          'aria-pressed',
          String(active)
        );
      });
  }

  function replayCurrentAudio() {
    if (replaySession) {
      api?.showToast?.(
        'Replay Audio is already running.'
      );
      return;
    }

    const video = getVideo();
    const bounds =
      api?.getCurrentCaptionBounds?.();

    if (!video || !bounds) {
      api?.showToast?.(
        'No active subtitle is available.'
      );
      return;
    }

    const start = Math.max(
      0,
      Number(bounds.start) || 0
    );

    const end = Math.min(
      Number.isFinite(video.duration) &&
        video.duration > 0
        ? video.duration
        : Number(bounds.end) || start + 2,
      Number(bounds.end) || start + 2
    );

    if (!(end > start)) {
      api?.showToast?.(
        'The current subtitle has no playable audio segment.'
      );
      return;
    }

    const settings = getSettings();

    const repeats = Math.max(
      1,
      Math.min(
        3,
        Number(
          settings.subtitleLearningReplayAudioCount
        ) || 2
      )
    );

    const previousPaused = video.paused;
    const previousRate = video.playbackRate;

    const pendingAutoResume = Boolean(
      autoResumeTimer &&
      autoPausedKey === bounds.key
    );

    clearAutoResume();

    replaySession = {
      video,
      key: bounds.key,
      cancelled: false
    };

    video.pause();
    video.playbackRate = previousRate;

    let completed = 0;
    let raf = 0;

    const cancel = () => {
      if (replaySeeking) return;
      if (!replaySession) return;

      replaySession.cancelled = true;
      finish();
    };

    const finish = () => {
      if (!replaySession) return;

      replaySeeking = false;

      cancelAnimationFrame(raf);

      const session = replaySession;

      replaySession = null;

      video.pause();

      video.playbackRate = previousRate;

      video.removeEventListener(
        'seeking',
        cancel
      );

      if (
        !previousPaused &&
        !session.cancelled
      ) {
        video.play().catch(() => {});
      }

      if (
        pendingAutoResume &&
        getSettings().autoPauseAfterSubtitle
      ) {
        scheduleAutoResume(
          video,
          bounds.key
        );
      }

      markReplayButton(false);
    };

    const playSegment = () => {
      if (
        !replaySession ||
        replaySession.cancelled
      ) {
        return;
      }

      replaySeeking = true;

      video.currentTime = start;

      setTimeout(() => {
        replaySeeking = false;
      }, 0);

      video.play().catch(() => {});

      const watch = () => {
        if (
          !replaySession ||
          replaySession.cancelled
        ) {
          return;
        }

        if (
          video.currentTime >= end - 0.03 ||
          video.ended
        ) {
          completed += 1;

          if (completed >= repeats) {
            finish();
            return;
          }

          playSegment();
          return;
        }

        raf = requestAnimationFrame(watch);
      };

      raf = requestAnimationFrame(watch);
    };

    video.addEventListener(
      'seeking',
      cancel
    );

    markReplayButton(true);

    api?.showToast?.(
      `Replay Audio ${repeats}×.`
    );

    playSegment();
  }

  function onToolbarClick(event) {
    const button =
      event.target.closest?.(
        '[data-cmj-toolbar]'
      );

    if (!button) return;

    const action =
      button.dataset.cmjToolbar;

    if (action === 'auto-pause') {
      event.preventDefault();

      toggleAutoPause().catch(() => {});
    }

    if (action === 'replay-audio') {
      event.preventDefault();

      replayCurrentAudio();
    }
  }

  function handleSubtitleChanged(event) {
    api = getApi();
    const detail = event?.detail || {};
    const key = String(detail.key || '');
    if (!key || key === lastCaptionKey) return;

    const video = getVideo();
    if (!video) return;

    lastCaptionKey = key;

    if (detail.wasPlaying && getSettings().autoPauseAfterSubtitle) {
      // Keep the pause guarantee here as well as in youtube.js. The event is
      // the cheap, primary path; this makes the feature independent of timing
      // between the two content scripts.
      if (!video.paused) video.pause();
      if (video.paused) scheduleAutoResume(video, key);
    }
  }

  // Very small safety net for YouTube SPA/caption-engine transitions where an
  // event can be missed. It runs only while Auto-Pause is enabled and at a
  // much lower frequency than the old 70ms polling loop.
  function startFallback() {
    if (fallbackTimer) return;
    const tick = () => {
      fallbackTimer = null;
      const settings = getSettings();
      if (!settings.autoPauseAfterSubtitle) return;

      api = getApi();
      const video = getVideo();
      const bounds = api?.getCurrentCaptionBounds?.();
      const key = String(bounds?.key || '');

      if (video && key && key !== lastCaptionKey) {
        const wasPlaying = !video.paused;
        lastCaptionKey = key;
        if (wasPlaying) {
          video.pause();
          scheduleAutoResume(video, key);
        }
      }

      fallbackTimer = setTimeout(tick, 250);
    };
    fallbackTimer = setTimeout(tick, 250);
  }

  function stopFallback() {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function attachVideoLifecycle(video) {
    if (!video || video === lastVideo) return;
    clearAutoResume();
    lastVideo = video;
    lastCaptionKey = '';
    lastWasPlaying = !video.paused;

    video.addEventListener('play', () => {
      if (replaySession) return;
      if (autoResumeTimer) clearAutoResume();
      getLayer()?.classList.remove('cmj-subtitle-learning-hidden');
    });
    video.addEventListener('ended', clearAutoResume);
    video.addEventListener('seeking', clearAutoResume);
  }

  document.addEventListener(
    'cmj-subtitle-changed',
    handleSubtitleChanged,
    true
  );

  document.addEventListener(
    'click',
    onToolbarClick,
    true
  );

  chrome.storage.onChanged.addListener(
    (changes, area) => {
      if (
        area === 'local' &&
        changes.settings
      ) {
        updateAutoPauseState();
      }
    }
  );

  attachVideoLifecycle(getVideo());
  updateAutoPauseState();
})();