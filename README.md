# LectureFlow 🎙

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
![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat)

---

## Features

* 🎙 **Transcription** — converts audio to text using Groq Whisper
* 🧪 **Formula extraction & validation** — detects and validates spoken formulas from lectures
* 💊 **Technical terms extraction** — identifies important terminology
* 📋 **AI Summary** — generates concise lecture summaries
* ⚡ **Two analysis modes**

  * Fast Mode (NVIDIA NIM)
  * Accurate Mode (NVIDIA NIM + Gemini)
* 🌙 **Dark / Light mode**
* 📱 **Mobile friendly**
* ☁️ **Serverless deployment on Cloudflare Workers**

---

## Architecture

Audio Recording

↓

Groq Whisper

↓

Transcript

↓

NVIDIA NIM

↓

Formula Detection

↓

Gemini

↓

Validation + Terms + Summary

---

## Tech Stack

| Service            | Usage                              | Free Tier |
| ------------------ | ---------------------------------- | --------- |
| Groq               | Audio transcription (Whisper)      | ✅ Free    |
| NVIDIA NIM         | Formula extraction (Llama 3.3 70B) | ✅ Free    |
| Google Gemini      | Summary, terms, validation         | ✅ Free    |
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

#### Google Gemini (Analysis)

1. Go to https://aistudio.google.com
2. Sign in
3. Click Get API Key
4. Create API Key
5. Copy your key (`AIza...`)

#### NVIDIA NIM (Formula Extraction)

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
| GEMINI_API_KEY | AIza...   |
| NVIDIA_API_KEY | nvapi-... |

Deploy again after saving.

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

If LectureFlow helps you and you'd like to support future development, donations are appreciated.

### USDT (EVM Networks)

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

Telegram: https://t.me/kiaashkan
