/* ─────────────────────────────────────────────────────────────────────────
   HYPRLVX Free-Bots loader bridge
   The app build downloads a Free Bot's XML directly from Appwrite storage
   (storage.getFileView(botFilesBucketId, storageFileId) → a cloud.appwrite.io
   /storage/buckets/<bucket>/files/<id>/view URL). HYPRLVX serves its bots from
   its own backend instead of Appwrite, so we intercept that one request and
   reroute it to /api/appwrite/bot-xml?id=<id>, which returns the bot XML. The
   build only falls back to that endpoint on network errors, so a real Appwrite
   404 would otherwise surface as "Failed to download bot xml (404)".

   Must load before the bundle so window.fetch is patched before first use.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var origFetch = window.fetch.bind(window);
  // /storage/buckets/<bucket>/files/<fileId>/view  (Appwrite getFileView)
  var FILE_VIEW_RE = /\/storage\/buckets\/[^/]+\/files\/([^/?]+)\/view/;

  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (/appwrite/i.test(url)) {
        var m = url.match(FILE_VIEW_RE);
        if (m && m[1]) {
          return origFetch('/api/appwrite/bot-xml?id=' + encodeURIComponent(m[1]), init);
        }
      }
    } catch (e) { /* fall through to the original request */ }
    return origFetch(input, init);
  };
})();
