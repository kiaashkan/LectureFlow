# LectureFlow 🎙

🌐 Documentation:

* 🇺🇸 [English](https://github.com/kiaashkan/LectureFlow/blob/main/README.md)
* 🇮🇷 [فارسی](https://github.com/kiaashkan/LectureFlow/blob/main/README-FA.md)


AI-powered speech-to-text and lecture analysis platform.

Upload a lecture recording and automatically generate:

* Transcript
* Technical terms
* Formula extraction
* AI-generated summaries

Built for students, researchers, educators, and anyone who needs AI-powered lecture or speech analysis. LectureFlow is designed for real classroom recordings: long files (an hour or more), recorded from the back of the room, with all the noise that comes with that.

![LectureFlow](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare)
![Groq](https://img.shields.io/badge/Groq-Whisper-orange?style=flat)
![NVIDIA](https://img.shields.io/badge/NVIDIA-NIM-76B900?style=flat)

🔗 **Live Demo:** [lf.kiaashkan.workers.dev](https://lf.kiaashkan.workers.dev)

📱 **Android App (Open Source):**
https://github.com/kiaashkan/LectureFlow-app

---

## Features

* 🎙 **Transcription** — converts audio to text using Groq Whisper. You choose the model:
  * 🎯 **Whisper Large v3** — most accurate, slower
  * ⚡ **Whisper Large v3 Turbo** — faster, slightly less accurate
* 🗣 **English transcription** — voice-to-text is in English; the interface itself is available in 11 languages
* ⏱ **Long recordings** — files are automatically split into chunks in the browser, so hour-long lectures are no problem
* 🧪 **Formula extraction & validation** — detects and validates spoken formulas from lectures
* 💊 **Technical terms extraction** — identifies important terminology
* 📋 **AI Summary** — generates concise lecture summaries
* 🧠 **Accuracy-first lecture analysis** — MiniMax M3.1 Flash via NVIDIA NIM, with automatic fallbacks (see Architecture)
* 📱 **Android app available** — open-source Android client
* 🌙 **Dark / Light mode**
* 📱 **Mobile friendly**
* ☁️ **Serverless deployment on Cloudflare Workers**

---

## Architecture

```text
Audio Recording
      │
      ▼
Groq Whisper (Large v3 or Turbo — your choice)
(Speech-to-Text, English)
      │
      ▼
Transcript
      │
      ▼
Lecture analysis — accuracy-first provider chain:
  1. MiniMax M3.1 Flash (NVIDIA NIM)
  2. GLM-5.3 Flash (NVIDIA NIM)        ← if #1 fails
  3. Workers AI · Llama 3.3 70B        ← if #2 fails
(Formula, terms & summary analysis)
      │
      ▼
┌─────────────────────────┐
│   Final Results         │
├─────────────────────────┤
│ • Formula Validation    │
│ • Technical Terms       │
│ • AI Summary            │
└─────────────────────────┘
```
## Android App

LectureFlow is also available as an open-source Android application.

Repository:

https://github.com/kiaashkan/LectureFlow-app

Build it yourself, customize it, or connect it to your own deployment.

---

## Tech Stack

| Service            | Usage                              | Free Tier |
| ------------------ | ---------------------------------- | --------- |
| Groq               | Audio transcription (Whisper Large v3 / Turbo) | ✅ Free    |
| NVIDIA NIM         | Formula, terms & summary analysis (MiniMax M3.1 Flash, GLM-5.3 Flash) | Free endpoint* |
| Cloudflare Workers AI | Analysis fallback (Llama 3.3 70B) | ✅ Free    |
| Cloudflare Workers | Hosting & backend                  | ✅ Free    |

---

## Setup

### 1. Get API Keys

#### Groq (Transcription)

1. Go to https://console.groq.com
2. Create an account
3. Open API Keys
4. Create a new API key
5. Copy your key (`gsk_...`)

#### NVIDIA NIM (Lecture Analysis — MiniMax M3.1 Flash / GLM-5.3 Flash)

1. Go to https://build.nvidia.com
2. Create an account
3. Open API Keys
4. Generate a key
5. Copy your key (`nvapi-...`)

---

### 2. Deploy to Cloudflare Workers

1. Go to https://workers.cloudflare.com
2. Create a Worker
3. Replace the default code with `worker.js`
4. Deploy

---

### 3. Configure Secrets

Open your Worker dashboard.

Go to:

Settings → Variables and Secrets

Create the following secrets:

| Name           | Value     |
| -------------- | --------- |
| GROQ_API_KEY   | gsk_...   |
| NVIDIA_API_KEY | nvapi-... |

Optional bindings (used for the analysis fallback and the view counters):

| Binding   | Type             | Name       |
| --------- | ---------------- | ---------- |
| AI        | Workers AI       | —          |
| DB        | D1 database      | lecture-db |
| ANALYTICS | Analytics Engine | page_views |

Deploy again after saving.

* NVIDIA free endpoint availability and limits may change.

---

### 4. Start Using LectureFlow

Open your Worker URL:

```text
https://your-worker.workers.dev
```

Upload an audio file and let LectureFlow analyze it automatically.

---

## Supported Audio Formats

* mp3
* m4a
* wav
* ogg
* webm

Files are automatically converted to optimized WAV format before processing.

---

## Support the Project ❤️

### USDT (BSC / BEP20)

```text
0x9C3287392fA08EbF13D8B31fEe27bE070C3e56CD
```

### TRON (TRX / TRC20)

```text
TJiV8kgAVxHqXka743abkn2jk7mhDWqmCa
```

---

## Author

KiA Ashkan

Telegram:
https://t.me/kiaashkan
