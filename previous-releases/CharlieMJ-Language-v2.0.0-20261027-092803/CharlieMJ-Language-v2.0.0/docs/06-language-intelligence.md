# Vocabulary and Language Intelligence

## CEFR

The current local implementation provides a lightweight estimated level based on word characteristics. It is intentionally labeled as an estimate rather than pretending to be a validated CEFR dictionary.

The architecture is ready for a future frequency/CEFR dataset so levels can become language-specific and evidence-based.

## Part of speech

The current analyzer uses small language-aware heuristics for common Turkish/English patterns and falls back to an `other` category. This gives immediate visual feedback without downloading a large NLP model.

For a production-grade language engine, the next layer should use language-specific morphology/POS libraries or a local NLP model. Turkish can then support root/lemma and suffix analysis such as `evlerimizden → ev + ler + imiz + den`.

## Translation

The extension uses a provider adapter pattern. MyMemory is the default public provider. LibreTranslate can be configured against a compatible server.

Google Translate is not open-source. A future Google provider should be implemented only through an appropriate official API and its current terms/quotas.

## Translation caching

Repeated requests are cached in Chrome local storage using a provider/source/target/text key. This reduces duplicate translation calls and improves repeated subtitle interactions.
