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

Built for students, researchers, educators, and anyone who needs AI-powered lecture or speech analysis.

![LectureFlow](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat\&logo=cloudflare)
![Groq](https://img.shields.io/badge/Groq-Whisper-orange?style=flat)
![NVIDIA](https://img.shields.io/badge/NVIDIA-NIM-76B900?style=flat)

🔗 **Live Demo:** [lf.kiaashkan.workers.dev](https://lf.kiaashkan.workers.dev)

📱 **Android App (Open Source):**
https://github.com/kiaashkan/LectureFlow-app

---

## Features

* 🎙 **Transcription** — converts audio to text using Groq Whisper
* 🧪 **Formula extraction & validation** — detects and validates spoken formulas from lectures
* 💊 **Technical terms extraction** — identifies important terminology
* 📋 **AI Summary** — generates concise lecture summaries
* 🧠 **Lecture analysis** — Mistral Large 4 via NVIDIA NIM
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
Groq Whisper
(Speech-to-Text)
      │
      ▼
Transcript
      │
      ▼
Mistral Large 4 via NVIDIA NIM
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
| Groq               | Audio transcription (Whisper)      | ✅ Free    |
| NVIDIA NIM         | Formula, terms & summary analysis (Mistral Large 4) | Free endpoint* |
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

#### NVIDIA NIM (Lecture Analysis — Mistral Large 4)

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
