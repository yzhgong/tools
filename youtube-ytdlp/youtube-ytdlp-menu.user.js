// ==UserScript==
// @name         YouTube → yt-dlp 下载菜单 (watch + shorts + live)
// @namespace    local.ytdlp
// @version      8.0
// @description  watch/shorts 下载按钮，可选 视频/音频/字幕/直播(从头/从现在)
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  let menu = null;

  const ITEMS = [
    ['🎬 视频（完整）', 'video'],
    ['🎵 仅音频', 'audio'],
    ['💬 仅字幕', 'subs'],
    ['🔴 直播·从头', 'livestart'],
    ['🔴 直播·从现在', 'livenow'],
  ];

  function buildMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.id = 'ytdlp-menu';
    menu.style.cssText =
      'position:fixed;z-index:2147483647;display:none;' +
      'background:#fff;color:#0f0f0f;border:1px solid #ccc;border-radius:10px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.25);overflow:hidden;min-width:160px;' +
      'font-family:Roboto,Arial,sans-serif;';
    ITEMS.forEach(([label, mode]) => {
      const it = document.createElement('div');
      it.textContent = label;
      it.style.cssText = 'padding:11px 16px;cursor:pointer;font-size:14px;white-space:nowrap;';
      it.onmouseenter = () => (it.style.background = '#f0f0f0');
      it.onmouseleave = () => (it.style.background = '');
      it.onclick = (e) => {
        e.stopPropagation();
        window.location.href = 'ytdlp://' + mode + '/' + encodeURIComponent(location.href);
        hideMenu();
      };
      menu.appendChild(it);
    });
    document.body.appendChild(menu);
    return menu;
  }

  function hideMenu() { if (menu) menu.style.display = 'none'; }

  function showMenuAt(btn) {
    const m = buildMenu();
    m.style.display = 'block';
    const r = btn.getBoundingClientRect();
    const mw = m.offsetWidth;
    let left = r.right - mw;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - 8 - mw;
    if (left < 8) left = 8;
    m.style.left = left + 'px';
    const mh = m.offsetHeight;
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - 6 - mh);
    m.style.top = top + 'px';
  }

  const BTN_STYLE =
    'padding:7px 14px;border:none;border-radius:18px;cursor:pointer;' +
    'background:#cc0000;color:#fff;font-size:13px;font-weight:600;' +
    'font-family:Roboto,Arial,sans-serif;white-space:nowrap;';

  function attachClick(btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (menu && menu.style.display === 'block') hideMenu();
      else showMenuAt(btn);
    };
  }

  function makeWatchButton() {
    if (document.getElementById('ytdlp-btn-watch')) return;
    const title = document.querySelector('ytd-watch-metadata #title') ||
                  document.querySelector('h1.ytd-watch-metadata');
    if (!title) return;
    const btn = document.createElement('button');
    btn.id = 'ytdlp-btn-watch';
    btn.textContent = '⬇ 下载';
    btn.style.cssText = 'margin-left:12px;vertical-align:middle;' + BTN_STYLE;
    attachClick(btn);
    title.appendChild(btn);
  }

  function shortsPlayerRect() {
    const sels = [
      'ytd-reel-video-renderer[is-active] video',
      '#shorts-player video',
      'ytd-shorts video',
      'video'
    ];
    for (const s of sels) {
      const v = document.querySelector(s);
      if (v) {
        const r = v.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return r;
      }
    }
    return null;
  }

  function positionShortsButton() {
    const btn = document.getElementById('ytdlp-btn-shorts');
    if (!btn) return;
    const r = shortsPlayerRect();
    if (r) {
      btn.style.top = (r.top + 12) + 'px';
      btn.style.left = (r.left + 12) + 'px';
    } else {
      btn.style.top = '64px';
      btn.style.left = '12px';
    }
  }

  function makeShortsButton() {
    if (!document.getElementById('ytdlp-btn-shorts')) {
      const btn = document.createElement('button');
      btn.id = 'ytdlp-btn-shorts';
      btn.textContent = '⬇ 下载';
      btn.style.cssText =
        'position:fixed;z-index:2147483646;box-shadow:0 2px 8px rgba(0,0,0,.35);' + BTN_STYLE;
      attachClick(btn);
      document.body.appendChild(btn);
    }
    positionShortsButton();
  }

  function rm(id) { const e = document.getElementById(id); if (e) e.remove(); }

  function check() {
    const p = location.pathname;
    if (p === '/watch') {
      rm('ytdlp-btn-shorts');
      makeWatchButton();
    } else if (p.startsWith('/shorts/')) {
      rm('ytdlp-btn-watch');
      makeShortsButton();
    } else {
      rm('ytdlp-btn-watch');
      rm('ytdlp-btn-shorts');
      hideMenu();
    }
  }

  document.addEventListener('click', hideMenu);
  window.addEventListener('scroll', () => { hideMenu(); positionShortsButton(); }, true);
  window.addEventListener('resize', positionShortsButton);
  setInterval(check, 1000);
  check();
})();
