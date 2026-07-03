Vaak Setu
A Hindi · Marathi · English translation system. Translate text, or transcribe audio/video → translate → synthesize speech and subtitles. Includes a native mobile app.

Pipeline: speech in → transcribe (faster-whisper) → translate (IndicTrans2) → speak the result back in a gender-matched voice (edge-tts) + generate SRT subtitles.

Features
Text translation between English, Hindi, Marathi (IndicTrans2).

Speech & video translation — transcribe audio/video, translate, and get the translation as synthesized speech + downloadable SRT subtitles.

Speaker gender → matched voice — the input speaker's gender is detected from pitch, and the spoken translation uses a matching male/female neural voice. See Speaker gender → voice.

Mobile app (mobile/) — an Expo / React Native client (Text + Speech tabs, mic recording, file upload, TTS playback).

Three interfaces over one engine:

Interface	File	Audience
REST API	api.py	the mobile app + any HTTP client
Gradio web UI	app.py	desktop / browser
Mobile app	mobile/	Android / iOS via Expo Go
Repo layout
vaak-setu/
  app.py                 translation engine (BAIFTranslator) + Gradio UI
  api.py                 FastAPI REST bridge over the engine (for the app)
  download_models.py     first-run model downloader (gated HF repos)
  requirements.txt       core ML deps (Python 3.14 compatible)
  requirements-api.txt   extra API deps (FastAPI / Uvicorn)
  mobile/                Expo React Native app  (see mobile/README.md)
  models/                downloaded IndicTrans2 weights (created on first run)
  outputs/               generated TTS / SRT / burned-video artifacts
Prerequisites
Python 3.10–3.14 (developed/tested on 3.14; see Implementation notes).
ffmpeg on your PATH (needed for video audio extraction & subtitle burn).
Windows: winget install Gyan.FFmpeg (then restart the terminal)
macOS: brew install ffmpeg
A Hugging Face account + token (the IndicTrans2 models are gated — see step 3 below).
~5 GB free disk + internet on first run (models download automatically).
Starting the API server
The API powers the mobile app. Run these from the repo root (C:\apps\vaak-setu).

1. (Recommended) Create and activate a virtual environment
Windows (PowerShell):

python -m venv .venv
.\.venv\Scripts\Activate.ps1
macOS / Linux:

python3 -m venv .venv
source .venv/bin/activate
2. Install dependencies
pip install -r requirements.txt -r requirements-api.txt
requirements-api.txt adds the API bridge deps (FastAPI, Uvicorn, python-multipart) on top of the core ML deps.

Python 3.14 note: whisperx doesn't support 3.14, so transcription uses faster-whisper directly (segment-level subtitle timing). Translation uses torch 2.12 + transformers. All deps ship cp314 wheels. To run with full whisperx fidelity instead, use Python 3.13 — but 3.14 is fully supported here.

3. Authenticate with Hugging Face (required)
The IndicTrans2 translation models are gated on the HF Hub, so a token is required to download them on first run.

Create a token (read scope): https://huggingface.co/settings/tokens

Request access — click "Agree and access repository" on both:

https://huggingface.co/ai4bharat/indictrans2-en-indic-dist-200M
https://huggingface.co/ai4bharat/indictrans2-indic-en-dist-200M
Make the token available to the app, either:

$env:HF_TOKEN = "hf_xxxxxxxx"     # current PowerShell session
# or persist it for new terminals:
setx HF_TOKEN "hf_xxxxxxxx"
# or log in interactively:
hf auth login
The models download only once, then run fully offline.

4. Start the server
python api.py
This serves the API on http://0.0.0.0:8000 (reachable on your LAN).

First launch is slow. On the very first run it downloads the models (IndicTrans2 en↔indic, faster-whisper small — a few GB) via download_models.py, then loads them into memory. Wait until you see Uvicorn report Application startup complete before sending requests. Later launches are fast because the models are cached.

Alternatively, run it with auto-reload during development:

uvicorn api:app --host 0.0.0.0 --port 8000 --reload
5. Verify it's up
In another terminal (or a browser):

curl http://localhost:8000/health
You should get {"success": true, "data": {"status": "ok", "device": "cpu", ...}}. Interactive API docs are available at http://localhost:8000/docs.

6. Find your LAN IP (for the mobile app)
A phone can't reach localhost on your computer — it needs the machine's LAN IP.

Windows: run ipconfig and read the IPv4 Address under your Wi-Fi adapter (e.g. 192.168.1.6). macOS: ipconfig getifaddr en0 Linux: hostname -I

Make sure the phone and the computer are on the same Wi-Fi network. If you can't connect, allow port 8000 through your firewall (Windows may prompt the first time python opens the port — choose Allow).

API endpoints
Method	Path	Purpose
GET	/health	liveness + device (cpu/cuda) info
GET	/languages	supported languages
POST	/translate	JSON {text, src, tgt} → translated text + stats
POST	/transcribe	multipart file upload → transcription, translation, gender, TTS + SRT URLs
GET	/outputs/<file>	download generated TTS / SRT / video artifacts
Languages: en, hi, mr. All responses use the envelope { "success": bool, "data": ... }.

Text translation:

curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"नमस्ते दुनिया\", \"src\": \"hi\", \"tgt\": \"en\"}"
Speech translation (/transcribe) takes multipart form fields file, input_type (Audio|Video), src, tgt, burn_subs, and returns:

{
  "success": true,
  "data": {
    "translated": "Hi my name is Rahul and I am from Pune city.",
    "original_text": "नमस्ते, मेरा नाम राहुल है ...",
    "src": "hi", "tgt": "en",
    "gender": "male", "pitch": 111.1, "voice": "en-IN-PrabhatNeural",
    "tts_url": "/outputs/tts_122743.mp3",
    "srt_url": "/outputs/subtitles_122743.srt",
    "video_url": null
  }
}
Speaker gender → voice
For audio/video input, the speaker's gender is detected from pitch (median fundamental frequency via autocorrelation; < 165 Hz → male, otherwise female) and the translated speech is synthesized in a matching neural voice via edge-tts:

Language	Male voice	Female voice
English	en-IN-PrabhatNeural	en-IN-NeerjaNeural
Hindi	hi-IN-MadhurNeural	hi-IN-SwaraNeural
Marathi	mr-IN-ManoharNeural	mr-IN-AarohiNeural
The detected gender + pitch are returned in the API response and shown in the mobile app. If detection fails (silence/noise), it defaults to a female voice; if edge-tts is unreachable it falls back to Google Translate TTS.

Pitch-based detection is a heuristic — reliable for clearly male/female speakers, but it can misclassify borderline pitches, children, or very noisy audio.

Running the mobile app
See mobile/README.md for the Expo app. In short: start this API server, then in mobile/ run npm install and npx expo start, and point the app at http://<your-LAN-IP>:8000 from its ⚙ settings (the phone and PC must be on the same Wi‑Fi, and port 8000 must be allowed through the firewall).

Running the Gradio web UI instead
python app.py     # serves http://localhost:7860
Implementation notes (Python 3.14)
This project was ported to run on Python 3.14, which required swapping a few dependencies (all changes are reflected in requirements.txt):

Transcription uses faster-whisper, not whisperx. whisperx caps at Python < 3.14 and pins torch~=2.8. faster-whisper (same CTranslate2 engine) supports 3.14; subtitle timing is segment-level.
transformers is pinned <5. IndicTrans2's trust_remote_code imports transformers.onnx, which was removed in transformers 5.x.
moviepy<2 keeps the moviepy.editor video API working.
torch (CPU), ctranslate2, sentencepiece, etc. all ship cp314 wheels.
To run instead with full whisperx fidelity (word-level subtitle alignment), use Python 3.13 — but 3.14 is fully supported here.