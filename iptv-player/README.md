# 📺 IPTV Live Player

A set of **single-file, dependency-free, local-first** HLS (m3u8) live TV players that run entirely in the browser. No build step, no server — just open an HTML file and watch. Channels are searchable, favoritable, and you can copy a ready-to-run `yt-dlp` command for any stream.

> The UI is in Chinese (简体中文).

## Contents

| File | What it is |
| --- | --- |
| `index.html` | Landing page linking to the three tools |
| `japan-tv.html` | **Desktop** player with 63 Japanese channels — search, favorites, import, right-click to copy a `yt-dlp` download command |
| `explore.html` | **Desktop** explorer for the global [iptv-org](https://github.com/iptv-org/iptv) list — load, search, try, and favorite channels |
| `mobile.html` | **Mobile** version of the Japan player — single-column, sticky player, touch-friendly |
| `data/japan-channels.m3u` | The source playlist the Japan player is built from |

## Usage

Just open any of the HTML files in a browser (double-click, or drag into the window). Everything runs locally; favorites are saved in the browser's `localStorage`.

- **Left-click** a channel → play
- **❤️ button** → favorite (favorites are pinned to the top)
- **Right-click** a channel (desktop) → copy a `yt-dlp` download command for that stream
- **Import** → load any other `.m3u` / `.m3u8` / `.txt` playlist (file or URL)

### Explore mode (global channels)

`explore.html` pulls the iptv-org list (tens of thousands of channels). Because it's huge, results only render once you type a search term, capped at 300 per query.

Loading the list directly from the URL is usually **blocked by CORS** when the page is opened from `file://` (see Limitations). The reliable path is built in:

1. Click **⬇️ 下载列表** to download the `.m3u` (a normal browser download is not subject to CORS)
2. Click **📁 导入文件** and pick the downloaded file

A proxy fallback is also attempted automatically, but it's unreliable for large files.

## Limitations (please read)

This is a **browser-based** player, so it inherits browser sandbox limits. Streams that play fine in VLC / IINA may not play here. The usual reasons:

1. **CORS** — the browser requires the stream server to send cross-origin headers; many IPTV servers don't, so the browser refuses to read them. Native players (VLC) have no such restriction.
2. **Codecs** — `<video>` only decodes a few codecs (mainly H.264 + AAC). Streams using H.265/HEVC video or AC3/E-AC3 audio won't play.
3. **Protocols** — only HLS (m3u8) works. `rtmp://`, `rtsp://`, raw `.ts`/`.flv` etc. are unsupported in the browser.
4. **Custom headers** — some streams need a specific `User-Agent`/`Referer`; the browser forbids JS from setting these protected headers (so `#EXTVLCOPT` hints can't be applied).

To diagnose a specific stream, open DevTools (F12) → Console: CORS errors say so explicitly; codec issues report a media/decode error.

### About hosting on GitHub Pages

You can deploy this repo to GitHub Pages, but note: Pages is served over **HTTPS**, and browsers block **HTTP streams on an HTTPS page** (mixed content). Many IPTV streams are plain `http://`, so they'll fail when the page is hosted on Pages — even though they work when you open the same file locally from `file://`. For `http://` streams, **local use is recommended.**

## yt-dlp download

Right-click any channel (desktop) to copy a command in this form:

```
yt-dlp -S 'proto' --js-runtimes node --extractor-args "youtube:player_js_variant=main" "<STREAM_URL>"
```

Paste it into a terminal to record the live stream. (The page itself can't run yt-dlp — browsers can't execute local commands.)

## Tech

Plain HTML/CSS/JS. Playback via [hls.js](https://github.com/video-dev/hls.js) (loaded from a CDN); on iOS Safari, native HLS is used instead. No frameworks, no bundler.

## Credits

- Global channel data: [iptv-org/iptv](https://github.com/iptv-org/iptv)
- Playback: [hls.js](https://github.com/video-dev/hls.js)

## License

MIT — see [LICENSE](LICENSE).

The channel playlists are aggregated from public sources and are not part of the license; their availability and legality vary by region. Use responsibly.
