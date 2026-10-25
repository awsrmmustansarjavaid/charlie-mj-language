/* YouTube page helpers (single-page-app aware). */
(() => {
  const root = window.YTP = window.YTP || {};
  root.isShorts = () => location.pathname.startsWith("/shorts/");
  root.isWatchPage = () => location.pathname === "/watch" || root.isShorts();
  root.getVideoId = () => new URL(location.href).searchParams.get("v") || (root.isShorts() ? location.pathname.split("/")[2] : "");
  root.getVideo = () => document.querySelector("#movie_player video.html5-main-video") || document.querySelector("video.html5-main-video") || document.querySelector("video");
  root.getVideoTitle = () =>
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() ||
    document.querySelector("ytd-reel-video-renderer[is-active] h2")?.textContent?.trim() ||
    document.title.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "").trim();
})();
