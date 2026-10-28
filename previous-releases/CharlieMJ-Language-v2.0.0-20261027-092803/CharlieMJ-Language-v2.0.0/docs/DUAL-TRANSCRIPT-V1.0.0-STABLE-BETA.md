# Charlie MJ Language — Dual Transcript v1.0.0 Stable Beta

## Preservation rule
This release is an additive integration. The original Charlie MJ Language v5.0.0 system remains the master system. Existing transcript engines, windows, settings, library features, toolbar actions, learning features, and storage keys are not replaced by the Dual Transcript subsystem.

## Added
- YouTube-native dual transcript fetcher based on the proven v1.0.0 dual engine.
- Original + YouTube auto-translated transcript.
- New `Dual Transcript` button inside the existing Charlie MJ YouTube toolbar.
- New `Dual Transcript` tab inside the existing Charlie MJ transcript window.
- Independent `Dual Transcript` settings category/tab.
- Local dual-transcript cache under `cmjDualTranscriptCache`.
- Independent settings under `cmjDualTranscriptSettings`.
- Timeline-synchronized active sentence highlighting.
- Save sentence to existing Library stores (`vocabulary` and `sentenceLearning`).
- Save words to existing Library stores (`vocabulary` and `wordLearning`).

## Important
The standalone dual extension is not embedded as a second application. Its YouTube bridge/controller are integrated as an additional subsystem so duplicate popup/background/transcript UI is avoided.
