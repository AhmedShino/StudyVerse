# StudyVerse

StudyVerse is a browser-first development project built with HTML, CSS, JavaScript and Capacitor 6. Develop and test the web experience without building or downloading an APK for every change.

## Fastest way to try it

### Option A: Replit (works from a phone)
1. Download `studyverse-project.zip` and extract it, or upload the project files to a new Replit project.
2. Ensure the project files are in the workspace root (the `www/` folder should be at the root).
3. In the Replit Shell, run `npm install`.
4. Run `npm run dev -- --host 0.0.0.0`.
5. Open the web preview URL Replit provides. Keep that preview open while editing files; Vite automatically refreshes the page when code changes.

Replit's interface and free-tier availability can change; if it does not expose a preview URL, use Option B on a computer.

### Option B: Local development on a computer
Requirements: Node.js 20+ recommended.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. To test on a phone connected to the same Wi-Fi, open `http://COMPUTER-LAN-IP:5173` on the phone, replacing `COMPUTER-LAN-IP` with the computer's local IP. Allow the development server through the computer firewall if prompted. Vite live reload updates the browser as files change.

## What currently works locally

- Responsive Arabic RTL dashboard, dark/light theme toggle.
- Personal timer: 15/25/45/60-minute presets, subject selection, pause/resume/reset, optional 5-minute break.
- Local session history, daily goal, weekly minutes, streak, XP and challenge progress.
- Local room drafts and profile preferences.
- Export local state to JSON.
- Initial Supabase schema in `supabase/schema.sql`.

## Not implemented/verified yet

- Rooms created in this version are local to the device; there is no real multi-user room sync yet.
- Authentication, friend requests, global leaderboard, and server-verified rewards are not connected.
- Native Android timer-end notifications/audio are not wired up yet. JavaScript timers may be suspended by Android in the background.
- English interface support is partial.
- No APK build or real Android device test has been run in this environment.

## Why browser testing helps

Most UI, timer logic, challenge screens, and local state can be developed in a browser without an APK. Features that depend on Android APIs (native notifications, lock-screen behavior, app lifecycle) still need a device test later. The final APK is built from this same `www/` app using Capacitor.

## Capacitor / Android build (only near the end)

```bash
npx cap add android
npx cap sync android
npx cap open android
```

Build the APK from Android Studio, or on Linux/macOS after generating the Android project:

```bash
cd android && ./gradlew assembleDebug
```

Expected output: `android/app/build/outputs/apk/debug/app-debug.apk`. The generated `android/` folder is intentionally not included in this source archive.

## Timer behavior notes

- The app persists an absolute `endsAt` timestamp while running. On resume, remaining time is recalculated from the timestamp.
- Local records are stored in browser local storage. Browser data can be cleared by the browser, so use the JSON export for a backup.
- A device clock change can affect local timer behavior. Shared rooms need a server-authoritative time source.

## Shared-room architecture planned for Supabase

1. Authenticate users with Supabase Auth.
2. Create rooms and memberships using a trusted RPC/Edge Function.
3. Store `started_at` and `ends_at` on the server in UTC.
4. Subscribe to room changes using Supabase Realtime; use server timestamps as authoritative.
5. Clients display `max(0, ends_at - server-adjusted-now)`; do not write a countdown every second.
6. Only authorized server-side operations can start, pause, resume, or finish a room.
7. Do not award public XP from client-provided values.

## Supabase security checklist

The SQL file is a starting schema, not a production-ready deployment. Complete and test RLS policies and trusted server-side functions before enabling real social features. Only the project URL and anon/publishable key belong in client code; never ship the service-role key.

## Project layout

```text
studyverse/
├── www/
│   ├── index.html
│   ├── css/app.css
│   └── js/ (app.js, timer.js, storage.js, challenges.js)
├── supabase/schema.sql
├── vite.config.js
├── capacitor.config.json
├── package.json
└── README.md
```
