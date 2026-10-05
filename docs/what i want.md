# ❤️ Charlie MJ Language Companion

> **An open-source language-learning Chrome extension for learning languages naturally through real-world videos and subtitles.**

**Charlie MJ Language Companion** helps language learners **watch, understand, capture, organize, review, and practice vocabulary** directly while watching YouTube and other supported media.

It combines **dual subtitles, word-by-word translation, vocabulary mining, sentence learning, transcripts, dictionaries, pronunciation, Anki export, and learning statistics** into one productivity-focused language-learning tool.

---

## ✨ Main Features

### 🎬 Watch & Learn

* YouTube video learning
* Original + translated dual subtitles
* Turkish subtitle support
* Subtitle synchronization
* Clickable subtitles
* Current sentence highlighting
* Word-level highlighting
* Subtitle navigation
* Jump to subtitle
* Playback speed controls
* Slow playback
* Sentence/section replay
* Keyboard shortcuts

### 🔤 Word-by-Word Learning

* Click any subtitle word
* Instant translation
* Context-aware meaning
* Multiple meanings
* Dictionary definitions
* Part of speech
* Pronunciation
* Example sentences
* Related words
* Word forms
* Previous/next word navigation
* Quick save to vocabulary
* Vocabulary popup with close button
* Click outside to close
* Optional automatic popup closing

### 🇹🇷 Turkish Learning

* Turkish → English translation
* Lemma/base-form detection
* Verb conjugation analysis
* Root + suffix awareness
* Plural/case/possessive forms
* Inflected-word recognition

Example:

`çalışıyorum` → `çalışmak` → **to work**

`geliyorum` → `gelmek` → **to come**

### 📚 Vocabulary Builder

Save words with:

* Original word
* Translation
* Lemma
* Part of speech
* Pronunciation
* Example sentence
* Sentence translation
* Video title
* Video URL
* Timestamp
* Screenshot
* Audio
* Personal notes
* Tags
* CEFR level
* Difficulty
* Learning status
* Date saved

### 📝 Complete Transcript

* Extract complete subtitles
* Preserve timestamps
* Turkish transcript
* Translated transcript
* Search transcript
* Copy transcript
* Download transcript
* Sentence extraction
* Word extraction
* Vocabulary mining
* Duplicate removal
* Subtitle cleanup

### 💾 Export & Backup

Export learning data as:

* TXT
* CSV
* JSON
* Markdown
* TSV
* SRT
* VTT
* HTML
* PDF
* DOCX
* EPUB

Import/restore:

* TXT
* CSV
* JSON
* TSV
* SRT
* VTT
* Markdown
* Anki data

### 🃏 Anki Integration

Create flashcards containing:

* Word
* Translation
* Example sentence
* Screenshot
* Audio
* Video context
* Timestamp
* Tags
* Difficulty
* Learning level

Support for:

* Anki decks
* AnkiConnect
* Automatic flashcard generation

### 🎧 Audio & Pronunciation

* Word pronunciation
* Sentence pronunciation
* Text-to-speech
* Audio replay
* Slow audio
* Saved sentence audio
* Shadowing practice
* Optional speech recognition

### 📸 Context Capture

When saving vocabulary:

* Automatically capture video context
* Manual screenshot
* Crop screenshot
* Save subtitle context
* Save timestamp
* Reopen video at exact position
* Save surrounding sentence context

### 📖 Sentence Mining

Save complete sentences instead of only individual words.

Each sentence can contain:

* Original sentence
* Translation
* Important vocabulary
* Screenshot
* Audio
* Video timestamp
* Video URL
* Personal notes

### 🧠 Grammar Learning

* Grammar explanations
* Sentence structure
* Tense detection
* Case detection
* Suffix analysis
* Verb analysis
* Grammar notes
* Context-based explanations

### 📊 Vocabulary Intelligence

* Word frequency
* Common/rare words
* Known words
* Unknown words
* Learning words
* Difficult words
* Repeated words
* CEFR levels
* A1 → C2 classification

### 🗂️ Vocabulary Library

Search and filter your saved learning material by:

* Word
* Meaning
* Lemma
* Sentence
* Video
* Tag
* Level
* Difficulty
* Part of speech
* Learning status
* Date

### 🏷️ Smart Tags

Organize vocabulary using tags such as:

`Travel` · `Food` · `Daily Life` · `Verbs` · `Grammar` · `Movies` · `News` · `Istanbul` · `Work` · `Conversation`

### 🔎 Search Everything

Search across:

* Vocabulary
* Transcripts
* Sentences
* Videos
* Meanings
* Lemmas
* Notes
* Tags

### 📈 Learning Dashboard

Track:

* Words encountered
* Words saved
* Words learned
* Sentences saved
* Videos studied
* Study time
* Review progress
* Vocabulary growth
* CEFR progress
* Daily/weekly/monthly activity
* Learning streaks

### 🔄 Spaced Repetition

Learning states:

`New → Learning → Review → Known`

Support:

* Daily review
* Difficult-word review
* Forgotten-word review
* New-word review
* Personalized review sessions

### 🎯 Learning Modes

Choose how you want to study:

* **Relaxed Mode** — watch normally
* **Learning Mode** — enhanced subtitles + translations
* **Mining Mode** — quickly collect vocabulary
* **Review Mode** — review saved vocabulary
* **Shadowing Mode** — listen and repeat
* **Transcript Mode** — study the complete transcript

### ⚡ Productivity Features

* Quick vocabulary capture
* Keyboard shortcuts
* Save current word
* Save current sentence
* Save all words from current subtitle
* "Learn This Video"
* Recently viewed words
* Recently saved vocabulary
* Known-word filtering
* Automatic translation caching
* Automatic context preservation

### 🤖 Optional AI

AI can optionally help with:

* Word explanations
* Grammar explanations
* Example sentences
* Sentence simplification
* Vocabulary quizzes
* Cloze exercises
* Conversation practice
* Learning summaries
* Translation assistance
* Personalized study material

AI should remain **optional**, so the core extension can work without requiring an AI subscription.

### 🌐 Multi-Language Architecture

Start with:

* 🇹🇷 Turkish
* 🇬🇧 English

Designed to expand to:

* 🇺🇸 English
* 🇸🇦 Arabic
* 🇵🇰 Urdu
* 🇮🇷 Persian
* 🇪🇸 Spanish
* 🇫🇷 French
* 🇩🇪 German
* 🇮🇹 Italian
* 🇵🇹 Portuguese
* 🇷🇺 Russian
* 🇯🇵 Japanese
* 🇰🇷 Korean
* 🇨🇳 Chinese

### 🔌 Translation Providers

The extension can support multiple translation providers through a provider-based architecture:

* LibreTranslate
* Argos Translate
* Google Translate
* DeepL
* Microsoft Translator
* Other compatible providers

This allows users to choose between **online, local, free, and premium translation services**.

### 🔒 Privacy & Offline Learning

* Local-first vocabulary storage
* Local browser storage
* Offline-capable features where supported
* Optional local translation
* No mandatory account
* Import/export backup
* User-controlled learning data

---

## 🔄 Learning Workflow

```text
Watch Video
     ↓
Read Dual Subtitles
     ↓
Click Unknown Word
     ↓
Understand Meaning
     ↓
Save Word / Sentence
     ↓
Capture Context
     ↓
Build Vocabulary
     ↓
Export / Anki
     ↓
Review
     ↓
Practice
     ↓
Track Progress
```

---

## 🧩 Product Architecture

Charlie MJ Language Companion is designed around independent providers and modules:

```text
Charlie MJ Language Companion
│
├── Subtitle Provider
├── Translation Provider
├── Dictionary Provider
├── Pronunciation / TTS Provider
├── AI Provider
├── Vocabulary Manager
├── Transcript Manager
├── Sentence Mining
├── Anki Integration
├── Export / Import
├── Learning & Review
├── Statistics
└── Local Storage
```

This makes it easier to add new languages, dictionaries, translators, AI services, and learning features without redesigning the entire extension.

---

## 🎯 Product Goal

The goal is simple:

> **Turn everyday video watching into an active language-learning experience.**

Instead of watching a video, finding a word, opening a dictionary, copying the word, creating a flashcard, finding the sentence, taking a screenshot, and later reviewing everything separately — **Charlie MJ Language Companion brings the complete workflow into one place.**

**Watch → Understand → Capture → Organize → Review → Practice → Improve**

---

## 🚀 Future Direction

The project can eventually expand beyond a Chrome extension into:

* Windows language-learning media player
* Local video learning
* YouTube + Netflix + other supported platforms
* OCR learning
* EPUB/manga learning
* AI language tutor
* Speaking practice
* Pronunciation analysis
* Shadowing
* Web learning dashboard
* Mobile companion
* Cloud synchronization
* More languages

---

## ❤️ Charlie MJ Language Companion

**Learn languages from the content you already love.**

**Watch it. Understand it. Save it. Learn it.**
