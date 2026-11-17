# LectureFlow 🎙

🌐 Documentation:

* 🇺🇸 [English](https://github.com/kiaashkan/LectureFlow/blob/main/README.md)
* 🇮🇷 [فارسی](https://github.com/kiaashkan/LectureFlow/blob/main/README-FA.md)


AI-powered speech-to-text for lectures.

Upload a lecture recording and get the **full transcript** — nothing more, nothing less. LectureFlow does one job and does it well: turning lecture audio into accurate text.

Built for students, researchers, educators, and anyone who needs a lecture as text. LectureFlow is designed for real classroom recordings: long files (an hour or more), recorded from the back of the room, with all the noise that comes with that.

![LectureFlow](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare)
![Groq](https://img.shields.io/badge/Groq-Whisper-orange?style=flat)

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
* 📋 **Copy & download** — copy the transcript, or download it as a `.txt` file or PDF
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
Browser: convert to 16 kHz WAV and split into chunks
      │
      ▼
Groq Whisper (Large v3 or Turbo — your choice)
(Speech-to-Text, English)
      │
      ▼
Full Transcript — copy it, or download .txt / PDF
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
| Cloudflare Workers | Hosting & backend                  | ✅ Free    |

---

## Setup

### 1. Get an API Key

#### Groq (Transcription)

1. Go to https://console.groq.com
2. Create an account
3. Open API Keys
4. Create a new API key
5. Copy your key (`gsk_...`)

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

Create the following secret:

| Name           | Value     |
| -------------- | --------- |
| GROQ_API_KEY   | gsk_...   |

Optional bindings (used for the view counters):

| Binding   | Type             | Name       |
| --------- | ---------------- | ---------- |
| DB        | D1 database      | lecture-db |
| ANALYTICS | Analytics Engine | page_views |

Deploy again after saving.

---

### 4. Start Using LectureFlow

Open your Worker URL:

```text
https://your-worker.workers.dev
```

Upload an audio file and let LectureFlow transcribe it automatically.

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
