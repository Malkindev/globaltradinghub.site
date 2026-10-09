/* ─────────────────────────────────────────────────────────────────────────
   Global Trading Hub Free-Bots bridge.
   - Merges the locally hosted bot metadata into Appwrite "bots" and
     "bot_folders" list responses, preserving any existing remote records.
   - Routes this bot's Appwrite storage-file request to the local XML endpoint.
   The bridge loads before the application bundle.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var origFetch = window.fetch.bind(window);
  var LOCAL_BOT_IDS = ['gth-digit-over-1-1hz10v'];
  var FILE_VIEW_RE = /\/storage\/buckets\/[^/]+\/files\/([^/?]+)\/view/;
  var DOCUMENTS_RE = /\/databases\/[^/]+\/collections\/([^/?]+)\/documents(?:[/?]|$)/;

  function requestUrl(input) {
    return typeof input === 'string' ? input : (input && input.url) || '';
  }

  function requestMethod(input, init) {
    return String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
  }

  function toAppwriteDocument(bot, collection) {
    var common = {
      $id: bot.id,
      id: bot.id,
      $collectionId: collection,
      $databaseId: '694ed011002cfa2f8929',
      $createdAt: bot.createdAt || new Date().toISOString(),
      $updatedAt: bot.createdAt || new Date().toISOString(),
      $permissions: []
    };

    if (collection === 'bot_folders') {
      return Object.assign(common, {
        name: bot.folderName || 'Free Bots',
        displayName: bot.folderName || 'Free Bots',
        folderName: bot.folderName || 'Free Bots',
        folder_name: bot.folderName || 'Free Bots',
        title: bot.folderName || 'Free Bots'
      }, { $id: bot.folderId || 'free-bots', id: bot.folderId || 'free-bots' });
    }

    return Object.assign(common, {
      name: bot.displayName,
      displayName: bot.displayName,
      display_name: bot.displayName,
      description: bot.description,
      folderId: bot.folderId,
      folder_id: bot.folderId,
      folderName: bot.folderName,
      folder_name: bot.folderName,
      category: bot.category,
      storageFileId: bot.id,
      storage_file_id: bot.id,
      fileId: bot.id,
      file_id: bot.id,
      file: bot.file
    });
  }

  function localDocuments(collection) {
    return origFetch('/api/appwrite/bots', { cache: 'no-store' })
      .then(function (response) {
        if (!response.ok) throw new Error('Local bot library unavailable');
        return response.json();
      })
      .then(function (payload) {
        var bots = payload && Array.isArray(payload.bots) ? payload.bots : [];
        var documents = [];
        if (collection === 'bot_folders') {
          var seen = {};
          bots.forEach(function (bot) {
            var folderId = bot.folderId || 'free-bots';
            if (!seen[folderId]) {
              seen[folderId] = true;
              documents.push(toAppwriteDocument(bot, collection));
            }
          });
        } else {
          documents = bots.map(function (bot) {
            return toAppwriteDocument(bot, collection);
          });
        }
        return { total: documents.length, documents: documents };
      });
  }

  function mergedDocuments(response, collection) {
    var remoteDataPromise = response && response.ok
      ? response.clone().json().catch(function () { return null; })
      : Promise.resolve(null);

    return Promise.all([remoteDataPromise, localDocuments(collection)])
      .then(function (results) {
        var remoteData = results[0];
        var localData = results[1];
        var data = remoteData && Array.isArray(remoteData.documents)
          ? remoteData
          : { total: 0, documents: [] };
        var documents = data.documents.slice();
        var added = 0;

        localData.documents.forEach(function (localDoc) {
          var index = documents.findIndex(function (doc) {
            return doc && (doc.$id === localDoc.$id || doc.id === localDoc.id);
          });
          if (index === -1) {
            documents.push(localDoc);
            added += 1;
          } else {
            documents[index] = Object.assign({}, documents[index], localDoc);
          }
        });

        var output = Object.assign({}, data, {
          total: Math.max((Number(data.total) || data.documents.length) + added, documents.length),
          documents: documents
        });
        return new Response(JSON.stringify(output), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      })
      .catch(function () {
        return localDocuments(collection).then(function (data) {
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
          });
        });
      });
  }

  window.fetch = function (input, init) {
    var url = requestUrl(input);
    var method = requestMethod(input, init);

    try {
      if (/appwrite/i.test(url)) {
        var documentsMatch = url.match(DOCUMENTS_RE);
        if (documentsMatch && method === 'GET') {
          var collection = decodeURIComponent(documentsMatch[1]);
          if (collection === 'bots' || collection === 'bot_folders') {
            return origFetch(input, init).then(
              function (response) { return mergedDocuments(response, collection); },
              function () { return mergedDocuments(null, collection); }
            );
          }
        }

        var fileMatch = url.match(FILE_VIEW_RE);
        if (fileMatch && fileMatch[1] && LOCAL_BOT_IDS.indexOf(decodeURIComponent(fileMatch[1])) !== -1) {
          return origFetch('/bots/digit-over-1-1hz10v.xml', init);
        }
      }
    } catch (e) {
      /* Fall through to the original request if URL parsing fails. */
    }

    return origFetch(input, init);
  };
})();
