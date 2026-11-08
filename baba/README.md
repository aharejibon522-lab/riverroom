# BABA

BABA is a personal joke vault and stand-up set builder. The Android app stores jokes locally so capture and rehearsal work offline. English and Bangla are supported for voice dictation and spoken playback; available device voices depend on Android's installed speech services.

## Android build
The GitHub Actions workflow builds a debug APK on pushes to the `baba-app` branch. Download it from the workflow run's Artifacts section.

## API
The Express API is in `server/`. Deploy it on Render using `server/render.yaml` (persistent disk keeps the JSON database across restarts). Set `BABA_API_URL` in the Android app only if remote sync is configured. The first version works offline and does not require an account or API key.

## Privacy
Jokes are saved on-device by default. Voice recognition uses Android speech recognition services. Do not save sensitive conversations without consent.
