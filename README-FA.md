# LectureFlow 🎙

**AI-powered lecture assistant** — turns audio recordings into transcripts, formulas, terms & summaries.

دستیار هوش مصنوعی برای دانشجویان — فایل صوتی کلاس رو آپلود کن و در چند دقیقه متن کامل، فرمول‌ها، اصطلاحات و خلاصه درس رو بگیر.

![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat&logo=cloudflare) ![Groq](https://img.shields.io/badge/Groq-Whisper-orange?style=flat) ![NVIDIA](https://img.shields.io/badge/NVIDIA-NIM-76B900?style=flat) ![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat)

---

## Features / ویژگی‌ها

- 🎙 **Transcription** — تبدیل صوت به متن با Groq Whisper
- 🧪 **Formula extraction** — استخراج فرمول‌های گفته‌شده (آمار، شیمی، داروسازی، ریاضی)
- 💊 **Technical terms** — لیست اصطلاحات مهم درس
- 📋 **Summary** — خلاصه نکات کلیدی
- ⚡ **Two modes** — حالت سریع (NVIDIA) یا دقیق (NVIDIA + Gemini)
- 🌙 **Dark / Light mode**
- 📱 **Mobile friendly**

---

## Tech Stack

| Service | Usage | Free |
|---------|-------|------|
| [Groq](https://console.groq.com) | Audio → Text (Whisper) | ✅ |
| [NVIDIA NIM](https://build.nvidia.com) | Formula extraction (Llama 3.3 70B) | ✅ |
| [Google Gemini](https://aistudio.google.com) | Terms, summary, validation | ✅ |
| [Cloudflare Workers](https://workers.cloudflare.com) | Hosting & backend | ✅ |

---

## راه‌اندازی / Setup

### ۱. دریافت API Key ها

**Groq** (برای تبدیل صوت به متن):
1. برو به [console.groq.com](https://console.groq.com)
2. ثبت‌نام کن — بدون کارت بانکی
3. از منو **API Keys** → **Create API Key** رو بزن
4. کلید رو کپی کن (شروع میشه با `gsk_...`)

**Google Gemini** (برای آنالیز متن):
1. برو به [aistudio.google.com](https://aistudio.google.com)
2. با اکانت گوگل وارد شو
3. روی **Get API Key** → **Create API key** کلیک کن
4. کلید رو کپی کن (شروع میشه با `AIza...`)

**NVIDIA NIM** (برای استخراج فرمول):
1. برو به [build.nvidia.com](https://build.nvidia.com)
2. ثبت‌نام کن — بدون کارت بانکی
3. از پروفایل → **API Keys** → **Generate Key** رو بزن
4. کلید رو کپی کن (شروع میشه با `nvapi-...`)

---

### ۲. Deploy روی Cloudflare Workers

1. برو به [workers.cloudflare.com](https://workers.cloudflare.com) و ثبت‌نام کن (رایگانه)
2. روی **Create Worker** کلیک کن
3. کد پیش‌فرض رو پاک کن و محتوای `worker.js` رو جایگذاری کن
4. روی **Deploy** کلیک کن

---

### ۳. اضافه کردن API Key ها به Cloudflare

بعد از deploy، به تنظیمات Worker برو:

1. Worker رو توی داشبورد Cloudflare باز کن
2. برو به **Settings** → **Variables and Secrets**
3. روی **+ Add** کلیک کن و این سه secret رو اضافه کن:

| Name | Value |
|------|-------|
| `GROQ_API_KEY` | کلید Groq (`gsk_...`) |
| `GEMINI_API_KEY` | کلید Gemini (`AIza...`) |
| `NVIDIA_API_KEY` | کلید NVIDIA (`nvapi-...`) |

4. دوباره **Deploy** کن

---

### ۴. تموم شد! ✅

آدرس Worker رو باز کن (مثلاً `your-worker.workers.dev`) و فایل صوتی کلاست رو آپلود کن.

---

## فرمت‌های صوتی پشتیبانی‌شده

`mp3` · `m4a` · `wav` · `ogg` · `webm`

فایل‌ها قبل از ارسال به‌صورت خودکار به WAV با کیفیت بهینه تبدیل میشن تا حجم کمتری مصرف بشه.

---

## سازنده / Made by

[Kia Ashkan](https://github.com/kiaashkan) — with the help of Claude

Telegram: [@kiaashkan](https://t.me/kiaashkan)

---

## حمایت مالی / Support

اگه این پروژه بهت کمک کرد و خواستی حمایت کنی:

**USDT — شبکه اتریوم (Ethereum / ERC-20):**
```
0x9C3287392fA08EbF13D8B31fEe27bE070C3e56CD
```

**USDT — شبکه ترون (Tron / TRC-20):**
```
TJiV8kgAVxHqXka743abkn2jk7mhDWqmCa
```

> ⚠️ قبل از واریز، شبکه رو با آدرس مطابقت بده — اشتباه شبکه = از دست رفتن پول
