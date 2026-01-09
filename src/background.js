// Background Service Worker for MarkPilot

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title,
          favIconUrl: tabs[0].favIconUrl
        });
      } else {
        sendResponse(null);
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'addBookmark') {
    chrome.bookmarks.create({
      parentId: request.parentId,
      title: request.title,
      url: request.url
    }, (bookmark) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, bookmark });
      }
    });
    return true;
  }

  if (request.action === 'getFolders') {
    chrome.bookmarks.getTree((tree) => {
      const folders = [];
      const traverse = (nodes, depth = 0) => {
        for (const node of nodes) {
          if (!node.url && node.id !== '0') {
            folders.push({
              id: node.id,
              title: node.title || 'Root',
              depth
            });
          }
          if (node.children) {
            traverse(node.children, depth + 1);
          }
        }
      };
      traverse(tree);
      sendResponse(folders);
    });
    return true;
  }
});
