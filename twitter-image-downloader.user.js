// ==UserScript==
// @name         Twitter / X 图片下载器
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  在推文图片上添加下载按钮，文件名格式：用户名_日期_序号
// @author       you
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      pbs.twimg.com
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    saveDir: '',
  };

  const style = document.createElement('style');
  style.textContent = `
    .twdl-overlay {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 5px;
      z-index: 99999;
      opacity: 0;
      transition: opacity 0.18s ease;
      pointer-events: none;
    }
    .twdl-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }

    /* 展开的按钮组，默认隐藏 */
    .twdl-expanded {
      display: flex;
      flex-direction: row;
      gap: 5px;
      opacity: 0;
      transform: translateX(8px);
      transition: opacity 0.15s ease, transform 0.15s ease;
      pointer-events: none;
    }
    .twdl-overlay.expanded .twdl-expanded {
      opacity: 1;
      transform: translateX(0);
      pointer-events: auto;
    }

    /* 小圆形触发按钮 */
    .twdl-trigger {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.65);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      backdrop-filter: blur(6px);
      transition: background 0.15s;
    }
    .twdl-trigger:hover {
      background: rgba(29, 155, 240, 0.85);
    }

    /* 展开後の普通ボタン */
    .twdl-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 6px 11px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      backdrop-filter: blur(6px);
      transition: background 0.15s;
      font-family: -apple-system, sans-serif;
    }
    .twdl-btn:hover { background: rgba(29, 155, 240, 0.85); }
    .twdl-btn svg { flex-shrink: 0; }
  `;
  document.head.appendChild(style);

  const iconDl = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1v9M4 7l4 4 4-4M2 13h12" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const iconAll = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H9z" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  function getImagesInTweet(tweetEl) {
    return [...tweetEl.querySelectorAll('[data-testid="tweetPhoto"]')];
  }

  function getBgUrl(tweetPhoto) {
    // X.com now renders images as <img> tags instead of CSS background-image
    const img = tweetPhoto.querySelector('img[src*="pbs.twimg.com/media"]');
    if (img) return img.src;
    // Fallback for the old background-image style
    const bgDiv = tweetPhoto.querySelector('[style*="pbs.twimg.com/media"]');
    if (!bgDiv) return null;
    const s = bgDiv.getAttribute('style') || '';
    const match = s.match(/url\(&quot;([^&]+)&quot;\)/) || s.match(/url\("([^"]+)"\)/);
    return match ? match[1] : null;
  }

  function getTweetMeta(tweetEl) {
    let username = 'unknown';
    const userNameEl = tweetEl.querySelector('[data-testid="User-Name"]');
    const userLink = userNameEl
      ? userNameEl.querySelector('a[href^="/"]')
      : tweetEl.querySelector('a[href^="/"][role="link"]:not([href*="/status/"])');
    if (userLink) {
      const match = userLink.getAttribute('href').match(/^\/([^/?#]+)$/);
      if (match) username = match[1];
    }

    let dateStr = 'unknown';
    const timeEl = tweetEl.querySelector('time[datetime]');
    if (timeEl) {
      const dt = new Date(timeEl.getAttribute('datetime'));
      if (!isNaN(dt)) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        dateStr = `${y}${m}${d}`;
      }
    }
    return { username, dateStr };
  }

  function getExt(src) {
    try {
      const fmt = new URL(src).searchParams.get('format');
      return fmt || 'jpg';
    } catch { return 'jpg'; }
  }

  function buildFilename(src, username, dateStr, index) {
    const ext = getExt(src);
    const name = `${username}_${dateStr}_${index + 1}.${ext}`;
    return CONFIG.saveDir ? `${CONFIG.saveDir}/${name}` : name;
  }

  function toOrigUrl(src) {
    try {
      const url = new URL(src);
      url.searchParams.set('name', 'orig');
      if (!url.searchParams.get('format')) url.searchParams.set('format', 'jpg');
      return url.toString();
    } catch { return src; }
  }

  function downloadImage(src, filename) {
    const origUrl = toOrigUrl(src);
    GM_xmlhttpRequest({
      method: 'GET',
      url: origUrl,
      responseType: 'blob',
      onload: (resp) => {
        const blobUrl = URL.createObjectURL(resp.response);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      },
      onerror: () => GM_download({ url: origUrl, name: filename })
    });
  }

  function addButtonToDiv(tweetPhoto, tweetEl) {
    if (tweetPhoto.dataset.twdlDone) return;
    tweetPhoto.dataset.twdlDone = '1';

    const container = tweetPhoto.parentElement;

    const overlay = document.createElement('div');
    overlay.className = 'twdl-overlay';

    tweetPhoto.addEventListener('mouseenter', () => {
      overlay.classList.add('visible');
    });
    tweetPhoto.addEventListener('mouseleave', () => {
      overlay.classList.remove('visible');
      overlay.classList.remove('expanded');
    });
    overlay.addEventListener('mouseenter', () => {
      overlay.classList.add('visible');
    });
    overlay.addEventListener('mouseleave', () => {
      overlay.classList.remove('visible');
      overlay.classList.remove('expanded');
    });

    const allPhotos = getImagesInTweet(tweetEl);
    const safeIndex = Math.max(allPhotos.indexOf(tweetPhoto), 0);

    const expanded = document.createElement('div');
    expanded.className = 'twdl-expanded';

    const btnSingle = document.createElement('button');
    btnSingle.className = 'twdl-btn';
    btnSingle.innerHTML = `${iconDl} 下载原图`;
    btnSingle.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const src = getBgUrl(tweetPhoto);
      if (!src) return;
      const { username, dateStr } = getTweetMeta(tweetEl);
      const filename = buildFilename(src, username, dateStr, safeIndex);
      downloadImage(src, filename);
    });
    expanded.appendChild(btnSingle);

    if (allPhotos.length > 1) {
      const btnAll = document.createElement('button');
      btnAll.className = 'twdl-btn';
      btnAll.innerHTML = `${iconAll} 全部(${allPhotos.length}张)`;
      btnAll.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const { username, dateStr } = getTweetMeta(tweetEl);
        allPhotos.forEach((photo, i) => {
          const src = getBgUrl(photo);
          if (!src) return;
          setTimeout(() => {
            const filename = buildFilename(src, username, dateStr, i);
            downloadImage(src, filename);
          }, i * 300);
        });
      });
      expanded.appendChild(btnAll);
    }

    const trigger = document.createElement('button');
    trigger.className = 'twdl-trigger';
    trigger.innerHTML = iconDl;
    trigger.title = '下载图片';
    trigger.addEventListener('mouseenter', () => {
      overlay.classList.add('expanded');
    });
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (allPhotos.length === 1) {
        const src = getBgUrl(tweetPhoto);
        if (!src) return;
        const { username, dateStr } = getTweetMeta(tweetEl);
        const filename = buildFilename(src, username, dateStr, safeIndex);
        downloadImage(src, filename);
      }
    });

    overlay.appendChild(expanded);
    overlay.appendChild(trigger);
    container.appendChild(overlay);
  }

  function processTweets() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach((tweet) => {
      getImagesInTweet(tweet).forEach((photo) => addButtonToDiv(photo, tweet));
    });
  }

  new MutationObserver(processTweets).observe(document.body, { childList: true, subtree: true });
  processTweets();
})();
