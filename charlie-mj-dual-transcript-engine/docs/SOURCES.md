# Technical references / inspiration

This project was designed independently. The following open-source projects were studied for public architectural ideas and documented behavior; their source code is not copied into this repository.

1. Gythiro / yt-dual-subs
   https://github.com/Gythiro/yt-dual-subs
   - MAIN-world request observation for modern YouTube caption requests.
   - YouTube whole-track translation with `tlang`.
   - Lightweight vanilla JS architecture.
   - Caption-rendered fallback and cache concepts.

2. 21317389 / youtube-dual-subtitles
   https://github.com/21317389/youtube-dual-subtitles
   - 60fps/requestAnimationFrame synchronization concept.
   - Binary-search cue lookup.
   - Sentence merging and ASR cleanup.
   - Prefetch/cache concepts.

3. reza-nzri / yt-dual-sub
   https://github.com/reza-nzri/yt-dual-sub
   - YouTube player-state / caption-track model.
   - JSON3 cue parsing model.
   - MV3 dual-subtitle architecture.

These references are used as technical inspiration, not as a source-code dependency. The extension has no runtime dependency on any of the projects above.
