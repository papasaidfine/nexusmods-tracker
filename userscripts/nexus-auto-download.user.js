// ==UserScript==
// @name         Nexusmods Tracker: auto slow download
// @namespace    nexusmods-tracker
// @version      1.3
// @description  Clicks "Slow download" on file pages opened by Nexusmods Tracker, then closes the tab
// @match        https://www.nexusmods.com/*/mods/*
// @match        https://nexusmods.com/*/mods/*
// @updateURL    http://localhost:8000/userscript/nexus-auto-download.user.js
// @downloadURL  http://localhost:8000/userscript/nexus-auto-download.user.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // Only act on pages the tracker opened (it adds nmt=1). Remember it for this tab in
  // case Nexus redirects and drops the parameter.
  const MARK = "nexusmods-tracker-auto";
  if (new URLSearchParams(location.search).get("nmt") === "1") {
    sessionStorage.setItem(MARK, "1");
  }
  if (sessionStorage.getItem(MARK) !== "1") return;

  const POLL_MS = 250;
  const CLICK_DELAY_MS = 500 + Math.random() * 500; // short human-like pause; tabs are already 2s apart
  const CLOSE_AFTER_CLICK_MS = 6000;
  const MAX_EXTRA_WAIT_MS = 15000; // longest extra wait while a countdown is still showing
  const GIVE_UP_MS = 20000;

  function isSlowDownload(el) {
    const text = (el.textContent || "").toLowerCase();
    return text.includes("slow") && text.includes("download");
  }

  function findButton() {
    const byId = document.getElementById("slowDownloadButton");
    if (byId) return byId;
    // Newer pages render the buttons inside a web component
    const root = document.querySelector("mod-file-download")?.shadowRoot;
    for (const scope of [root, document]) {
      if (!scope) continue;
      for (const el of scope.querySelectorAll('button, a, [role="button"]')) {
        if (isSlowDownload(el)) return el;
      }
    }
    return null;
  }

  let bannerEl = null;
  function banner(message) {
    console.log(`[nexusmods-tracker] ${message}`);
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.style.cssText =
        "position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:8px 12px;" +
        "background:#1f2937;color:#fff;font:14px sans-serif;text-align:center";
      document.documentElement.appendChild(bannerEl);
    }
    bannerEl.textContent = `Nexusmods Tracker: ${message}`;
  }

  // Free downloads may show a short countdown before the file starts; closing the tab
  // during it would cancel the download. Nexus's markup isn't fixed, so match text.
  const COUNTDOWN = /(download|begin|start)[^.\n]{0,60}?\b\d+\s*(s\b|sec|second)/i;
  function countdownShowing() {
    return COUNTDOWN.test(document.body?.innerText || "");
  }

  function closeWhenStarted() {
    const deadline = Date.now() + MAX_EXTRA_WAIT_MS;
    let waited = false;
    const check = setInterval(() => {
      if (countdownShowing() && Date.now() < deadline) {
        waited = true;
        banner("waiting for the download countdown...");
        return;
      }
      clearInterval(check);
      // After a countdown, give the browser a moment to start the file
      setTimeout(() => window.close(), waited ? 2000 : 0);
    }, 500);
  }

  banner("looking for the Slow download button...");
  const started = Date.now();
  const timer = setInterval(() => {
    const button = findButton();
    if (button) {
      clearInterval(timer);
      banner("starting slow download...");
      setTimeout(() => {
        button.click();
        sessionStorage.removeItem(MARK);
        banner("download started; this tab closes shortly");
        setTimeout(closeWhenStarted, CLOSE_AFTER_CLICK_MS);
      }, CLICK_DELAY_MS);
    } else if (Date.now() - started > GIVE_UP_MS) {
      clearInterval(timer);
      sessionStorage.removeItem(MARK);
      banner("no Slow download button found within 20s; download this file manually");
    }
  }, POLL_MS);
})();
