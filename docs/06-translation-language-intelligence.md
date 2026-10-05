# Translation and Language Intelligence

## Provider model

The extension separates the learning UI from translation providers. The current settings expose MyMemory and a configurable LibreTranslate endpoint, with a no-online-translation option.

Google Translate can be considered as a future official API/provider integration subject to Google's current API availability, authentication, quotas and terms. Google Translate itself is not an open-source project.

## Provider fallback

A future provider chain can be:

```text
Primary provider
      |
      +-- failure --> cached result
      |
      +-- failure --> backup provider
      |
      +-- failure --> local/manual mode
```

## CEFR

The UI data model supports A1, A2, B1, B2, C1 and C2 plus learner-friendly labels. The current fallback estimator is deliberately transparent and is not a replacement for a real frequency/CEFR dictionary.

## Grammar

The architecture supports part-of-speech categories. High-quality grammatical classification should eventually come from language-specific NLP models/dictionaries rather than simplistic word-shape guesses.

## Turkish

Turkish can receive a dedicated morphology provider for roots, suffixes, case, possession, tense, person and lemma forms.

## Other languages

The common learning data model should remain language-neutral while analysis providers implement language-specific behavior.
