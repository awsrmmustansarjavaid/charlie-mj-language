(() => {
  const b = document.getElementById('youtubeFavorites');
  if (b) b.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('src/favorites/favorites.html') });
})();
