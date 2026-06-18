#!/bin/bash
# ============================================================
# 一次性安装 v5：视频/音频/字幕 + 直播(从头/从现在)。
# 运行：bash ~/Downloads/install-ytdlp-handler-v5.command
# ============================================================
set -e

APP="/Applications/YtdlpHandler.app"
SUPPORT="$HOME/Library/Application Support/ytdlp"
TMP="$(mktemp -d)"
mkdir -p "$SUPPORT"

cat > "$SUPPORT/download.sh" <<'SH'
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
MODE="$1"
URL="$2"
DEST="$HOME/Downloads/yt"
mkdir -p "$DEST"
OUT="$DEST/%(title)s [%(id)s].%(ext)s"
COMMON=(--js-runtimes node --extractor-args "youtube:player_js_variant=main")
VFMT="bestvideo[vcodec~='^vp0?9']+bestaudio[ext=m4a]/bestvideo[vcodec~='^vp0?9']+bestaudio/bestvideo+bestaudio[ext=m4a]/bv*+ba/b"
notify() { osascript -e "display notification \"$1\" with title \"yt-dlp\""; }

# 直播：写一个临时 .command 并用终端打开，方便看进度 / Ctrl+C 停止
open_live() {
  local LIVEFLAG="$1"
  local CMD; CMD="$(mktemp -d)/live-download.command"
  cat > "$CMD" <<EOF
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:\$PATH"
echo "🔴 直播下载中… 按 Ctrl+C 可随时停止并保存已下部分"
echo "----------------------------------------------------"
yt-dlp $LIVEFLAG --js-runtime node --extractor-args "youtube:formats=duplicate;player-client=web" -f "$VFMT" --merge-output-format mkv -o "$OUT" "$URL"
echo "----------------------------------------------------"
echo "结束。文件在 $DEST （此窗口可关闭）"
EOF
  chmod +x "$CMD"
  open "$CMD"
}

case "$MODE" in
  video)
    notify "开始下载视频…"
    if yt-dlp "${COMMON[@]}" -f "$VFMT" --merge-output-format mkv \
         -o "$OUT" "$URL" >> /tmp/ytdlp.log 2>&1; then
      notify "视频完成 ✅"
    else
      notify "视频失败，看 /tmp/ytdlp.log"
    fi
    ;;
  audio)
    notify "开始下载音频…"
    if yt-dlp "${COMMON[@]}" -f "bestaudio[ext=m4a]/bestaudio" \
         -o "$OUT" "$URL" >> /tmp/ytdlp.log 2>&1; then
      notify "音频完成 ✅"
    else
      notify "音频失败，看 /tmp/ytdlp.log"
    fi
    ;;
  subs)
    notify "开始下载字幕…"
    T="$(mktemp -d)"
    SUBOUT="$T/%(title)s [%(id)s].%(ext)s"
    yt-dlp "${COMMON[@]}" --skip-download --write-subs \
      --sub-langs "zh-Hans,zh,ja,en" --convert-subs srt -o "$SUBOUT" "$URL" >> /tmp/ytdlp.log 2>&1
    if ! ls "$T"/*.srt >/dev/null 2>&1; then
      yt-dlp "${COMMON[@]}" --skip-download --write-auto-subs \
        --sub-langs "zh-Hans,zh,ja,en" --convert-subs srt -o "$SUBOUT" "$URL" >> /tmp/ytdlp.log 2>&1
    fi
    if ls "$T"/*.srt >/dev/null 2>&1; then
      mv "$T"/*.srt "$DEST"/
      notify "字幕完成 ✅"
    else
      notify "没找到字幕"
    fi
    rm -rf "$T"
    ;;
  livestart)
    notify "打开直播下载(从头)…"
    open_live "--live-from-start"
    ;;
  livenow)
    notify "打开直播下载(从现在)…"
    open_live "--no-live-from-start"
    ;;
  *)
    notify "未知操作: $MODE"
    ;;
esac
SH
chmod +x "$SUPPORT/download.sh"

cat > "$TMP/handler.applescript" <<'OSA'
on open location this_URL
    set s to text 9 thru -1 of this_URL
    set ix to offset of "/" in s
    set theMode to text 1 thru (ix - 1) of s
    set encURL to text (ix + 1) thru -1 of s
    set theURL to do shell script "/usr/bin/python3 -c 'import sys,urllib.parse;print(urllib.parse.unquote(sys.argv[1]))' " & quoted form of encURL
    do shell script "bash \"$HOME/Library/Application Support/ytdlp/download.sh\" " & quoted form of theMode & " " & quoted form of theURL & " >/dev/null 2>&1 &"
end open location
OSA

rm -rf "$APP"
osacompile -o "$APP" "$TMP/handler.applescript"
PB="/usr/libexec/PlistBuddy"
PL="$APP/Contents/Info.plist"
$PB -c "Add :CFBundleURLTypes array" "$PL" 2>/dev/null || true
$PB -c "Add :CFBundleURLTypes:0 dict" "$PL"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLName string ytdlp-handler" "$PL"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PL"
$PB -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string ytdlp" "$PL"
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -f "$APP"

echo ""
echo "✅ 安装完成（v5：含直播）。文件存到 ~/Downloads/yt"
