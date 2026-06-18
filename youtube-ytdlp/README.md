# YouTube → yt-dlp one-click downloader (macOS)

A red **⬇ 下载** button injected into YouTube pages. Clicking it opens a small
menu (video / audio / subtitles / live) and downloads the current video via a
local `yt-dlp`, with **no background server** and **no per-download terminal
typing**. macOS only.

---

## How it works (architecture)

```
Tampermonkey userscript (in browser, on youtube.com)
        │  click menu item → window.location = "ytdlp://<mode>/<urlencoded-page-url>"
        ▼
macOS Launch Services routes the ytdlp:// scheme
        ▼
/Applications/YtdlpHandler.app   (an AppleScript app, "on open location")
        │  strips scheme, splits "<mode>/<encoded-url>", URL-decodes via python3
        │  runs: bash download.sh <mode> <url>
        ▼
~/Library/Application Support/ytdlp/download.sh
        │  branches on <mode>, calls yt-dlp
        ▼
files land in ~/Downloads/yt   (+ macOS notification, or a Terminal window for live)
```

The browser cannot launch local programs directly (sandbox). The `ytdlp://`
custom URL scheme is the bridge: clicking fires the scheme, macOS launches the
handler on demand, nothing stays resident.

`<mode>` is one of: `video`, `audio`, `subs`, `livestart`, `livenow`.
The page URL is `encodeURIComponent`-encoded, so it contains no raw `/`; the
handler splits on the first `/` to separate mode from URL.

---

## Prerequisites

macOS only. Install the following before running the installer.

### Browser extension

- [Tampermonkey](https://www.tampermonkey.net/) — runs the in-page userscript

### Command-line tools (via [Homebrew](https://brew.sh))

```bash
brew install yt-dlp ffmpeg node
```

| Tool | What it does here |
|------|-------------------|
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | does all the actual downloading |
| [ffmpeg](https://ffmpeg.org/) | merges separate video + audio streams into one file; converts subtitles to `.srt` |
| [Node.js](https://nodejs.org/) | yt-dlp uses it as a JS runtime (`--js-runtimes node`) to solve YouTube's player challenges |

### System tools (pre-installed on macOS, no action needed)

| Tool | What it does here |
|------|-------------------|
| `python3` (`/usr/bin/python3`) | URL-decodes the YouTube link inside the AppleScript handler. On a fresh Mac it triggers a one-time Xcode Command Line Tools prompt. |
| `osascript` | Compiles and runs the AppleScript handler; sends macOS notifications |
| `bash` | Runs `download.sh` |

### PATH note

The handler hardcodes `PATH=/opt/homebrew/bin:/usr/local/bin` (Apple Silicon and Intel Homebrew paths). If you installed tools elsewhere, adjust the `export PATH=...` line in `install-ytdlp-handler.command` before running it.

---

## Files

| File | Purpose |
|------|---------|
| `youtube-ytdlp-menu.user.js` | Tampermonkey userscript — the in-page button + menu |
| `install-ytdlp-handler.command` | One-time installer: builds `/Applications/YtdlpHandler.app` and writes `~/Library/Application Support/ytdlp/download.sh` |

The installer is the single source of truth for the handler and `download.sh`.
To apply changes, edit the installer and re-run it (or edit the installed
`download.sh` directly for quick tweaks).

---

## Install

1. Run the installer once:
   ```bash
   bash ./install-ytdlp-handler.command
   ```
   It compiles the handler app, declares the `ytdlp://` scheme in its
   `Info.plist`, and registers it with Launch Services.

2. Open Tampermonkey → create a new script → paste the contents of
   `youtube-ytdlp-menu.user.js` → save. Reload YouTube.

3. First click triggers a browser prompt ("open YtdlpHandler?"). Tick
   **always allow youtube.com…** and it never asks again.

---

## Usage

- **/watch pages**: button sits at the end of the video title.
- **/shorts/ pages**: floating button anchored to the top-left of the current
  Short's player (tracks as you scroll).

Menu options:

| Label | mode | Behavior |
|-------|------|----------|
| 🎬 视频（完整） | `video` | best VP9 video + best m4a audio, merged to **mkv** (with fallback chain) |
| 🎵 仅音频 | `audio` | `bestaudio[ext=m4a]` (falls back to any best audio) |
| 💬 仅字幕 | `subs` | manual subs preferred, auto-subs as fallback; converted to `.srt` |
| 🔴 直播·从头 | `livestart` | `--live-from-start` (needs the stream's DVR/rewind enabled) |
| 🔴 直播·从现在 | `livenow` | `--no-live-from-start` (records from the live edge forward — yt-dlp default) |

Live modes open a **Terminal window** so you can watch progress and press
**Ctrl+C** to stop early (already-downloaded part is kept). Non-live modes run
silently in the background and post a macOS notification on finish.

Everything saves to `~/Downloads/yt`. Progress/errors for non-live downloads:
`/tmp/ytdlp.log`.

---

## Format / codec notes

Video downloads use this fallback chain (graceful per-stream degradation):

```
bestvideo[vcodec~='^vp0?9']+bestaudio[ext=m4a]      # VP9 + m4a (ideal)
 / bestvideo[vcodec~='^vp0?9']+bestaudio            # VP9 + any audio
 / bestvideo+bestaudio[ext=m4a]                     # any video + m4a
 / bv*+ba                                           # any + any
 / b                                                # best pre-muxed
```

`vcodec~='^vp0?9'` is a regex match that catches both `vp9` and `vp09.xx`.

**Container:** VP9 + m4a(AAC) fits neither mp4 (VP9 non-standard) nor webm
(AAC not allowed), so merged output is **mkv** (`--merge-output-format mkv`),
which accepts any codec combo.

**mkv → mp4?** Lossless container swap is possible:
```bash
ffmpeg -i in.mkv -c copy out.mp4
```
But because the video is VP9, the resulting mp4 won't play in many players
(QuickTime, most devices). For a universally-playable mp4, download H.264
(`avc1`) + m4a instead — native mp4, lossless merge, but capped at 1080p on
YouTube (1440p/4K require VP9/AV1, i.e. stay on mkv).

---

## Customization points

All in `~/Library/Application Support/ytdlp/download.sh` (mirror changes into
`install-ytdlp-handler.command` so a re-install doesn't revert them):

- **Download folder** — `DEST="$HOME/Downloads/yt"`.
- **Subtitle languages / priority** — the two `--sub-langs "zh-Hans,zh,ja,en"` lines.
- **Video format** — `VFMT=...`.
- **Live extractor args** — inside `open_live()`.

Userscript (`youtube-ytdlp-menu.user.js`):

- **Shorts button position** — `positionShortsButton()` (the `r.top + 12` / `r.left + 12` offsets).
- **Shorts player selector** — `shortsPlayerRect()` selector list.
- **Menu items** — the `ITEMS` array.

---

## Troubleshooting

- **Button click does nothing, no notification** → check `/tmp/ytdlp.log`.
  - Has yt-dlp output → it ran; likely a missing tool or format issue.
  - Empty → the `ytdlp://` scheme didn't fire. Confirm the browser "always
    allow" prompt was accepted; re-run the installer.
- **"No application can open ytdlp:// URLs"** → handler not registered; re-run installer.
- **Downloads to a protected folder** → first time macOS may prompt for folder access; allow it.
- **Uninstall** → delete `/Applications/YtdlpHandler.app` and `~/Library/Application Support/ytdlp/`.

---

## Known quirks

- **JS-runtime flag inconsistency.** Normal modes use `--js-runtimes node` (plural). Live modes use `--js-runtime node` (singular), preserved from a working saved command. If live errors on the flag, align them.
- **Shorts selector fragility.** `shortsPlayerRect()` relies on YouTube's Shorts DOM; a layout change may require updating the selector list.
- **No de-dup / queue.** Rapid clicks start parallel yt-dlp processes.

---

## Credits

This tool is a thin wrapper around open-source software:

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — the actual downloader (Unlicense)
- [ffmpeg](https://ffmpeg.org/) — audio/video muxing and subtitle conversion (LGPL/GPL)
- [Node.js](https://nodejs.org/) — used by yt-dlp as a JS runtime for YouTube extraction
- [Tampermonkey](https://www.tampermonkey.net/) — browser extension that runs the userscript
