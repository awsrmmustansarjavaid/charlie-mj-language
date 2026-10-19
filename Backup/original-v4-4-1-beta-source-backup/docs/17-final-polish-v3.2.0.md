# Charlie MJ Language v3.2.0 — Final Polish

## Caption artifact cleanup

YouTube can leak its caption-settings UI label into caption text. v3.2.0 removes patterns such as `A1TurkishB1(auto-generated)C1ClickA2forA1settingsB1` before subtitle rendering, translation display, transcript export, SRT/VTT output, and learning-package generation.

## Configurable grammar colors

Settings now expose editable colors for noun, pronoun, verb, adjective, adverb, preposition, conjunction, determiner, numeral, particle, other, Turkish suffix, Turkish case, Turkish plural, Turkish possessive, Turkish tense/aspect, and Turkish person.

The selected POS color is reused on the corresponding translated token. Turkish morphology can additionally highlight a detected suffix/case portion.

## Watch Later open action

Watch Later cards now include **Open in new tab**, preserving the saved YouTube URL.

## Validation

All JavaScript files should pass `node --check`, the manifest must remain valid MV3 JSON, and no GitHub Actions workflow is required.
