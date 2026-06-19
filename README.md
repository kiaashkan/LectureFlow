# LectureFlow 🎙

AI-powered lecture assistant — turns audio recordings into transcripts, formulas, terms & summaries.

Built for students who record their university lectures and want to quickly extract the key content.

![LectureFlow](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare) ![Groq](https://img.shields.io/badge/Groq-Whisper-orange?style=flat) ![NVIDIA](https://img.shields.io/badge/NVIDIA-NIM-76B900?style=flat) ![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat)

---

## Features

- 🎙 **Transcription** — converts audio to text using Groq Whisper
- 🧪 **Formula extraction** — detects spoken formulas (statistics, chemistry, pharmacology, math)
- 💊 **Technical terms** — lists key terms from the lecture
- 📋 **Summary** — generates key takeaways
- ⚡ **Two analysis modes** — Fast (NVIDIA only) or Accurate (NVIDIA + Gemini)
- 🌙 **Dark / Light mode**
- 📱 **Mobile friendly**

---

## Tech Stack

| Service | Usage | Free tier |
|---------|-------|-----------|
| [Groq](https://console.groq.com) | Audio transcription (Whisper) | ✅ Free |
| [NVIDIA NIM](https://build.nvidia.com) | Formula extraction (Llama 3.3 70B) | ✅ Free |
| [Google Gemini](https://aistudio.google.com) | Terms, summary, formula validation | ✅ Free |
| [Cloudflare Workers](https://workers.cloudflare.com) | Hosting & backend | ✅ Free |

---

## Setup

### 1. Get API Keys

**Groq** (for transcription):
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with email — no credit card needed
3. Go to **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

**Google Gemini** (for analysis):
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Sign in with your Google account
3. Click **Get API Key** → **Create API key**
4. Copy the key (starts with `AIza...`)

**NVIDIA NIM** (for formula extraction):
1. Go to [build.nvidia.com](https://build.nvidia.com)
2. Sign up with email — no credit card needed
3. Click your profile → **API Keys** → **Generate Key**
4. Copy the key (starts with `nvapi-...`)

---

### 2. Deploy to Cloudflare Workers

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) and sign up (free)
2. Click **Create Worker**
3. Delete the default code and paste the contents of `worker.js`
4. Click **Deploy**

---

### 3. Add API Keys to Cloudflare

After deploying, go to your Worker's settings:

1. Open your Worker in the Cloudflare dashboard
2. Go to **Settings** → **Variables and Secrets**
3. Click **+ Add** and add these three secrets:

| Name | Value |
|------|-------|
| `GROQ_API_KEY` | your Groq key (`gsk_...`) |
| `GEMINI_API_KEY` | your Gemini key (`AIza...`) |
| `NVIDIA_API_KEY` | your NVIDIA key (`nvapi-...`) |

4. Click **Deploy** again

---

### 4. Done!

Open your Worker URL (e.g. `your-worker.workers.dev`) and start uploading lectures.

---

## Supported Audio Formats

`mp3` · `m4a` · `wav` · `ogg` · `webm`

Files are automatically converted to 8kHz mono WAV before upload to minimize data usage.

---

## Made by

KiA Ashkan Telegram: [@kiaashkan](https://t.me/kiaashkan)
