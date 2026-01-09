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
    return true;
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

// Handle alarm for auto-refresh feeds
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'feedRefresh') {
    console.log('Auto-refreshing feeds...');

    try {
      // Get subscriptions
      const result = await chrome.storage.local.get(['subscriptions', 'feed_notify_enabled']);
      const subscriptions = result.subscriptions || {};
      const notifyEnabled = result.feed_notify_enabled !== false;

      if (Object.keys(subscriptions).length === 0) {
        return;
      }

      let totalNewItems = 0;
      const updatedSubs = {};

      // Refresh each subscription
      for (const [id, sub] of Object.entries(subscriptions)) {
        try {
          const oldItems = sub.items || [];
          const response = await fetch(sub.feedUrl, {
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) continue;

          const text = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/xml');

          const items = [];
          const isAtom = text.includes('<feed');

          if (isAtom) {
            const entries = doc.querySelectorAll('entry');
            entries.forEach(entry => {
              const title = entry.querySelector('title')?.textContent || '';
              const linkEl = entry.querySelector('link[href]');
              const link = linkEl?.getAttribute('href') || '';
              const published = entry.querySelector('published')?.textContent ||
                               entry.querySelector('updated')?.textContent || '';
              items.push({ title: title.trim(), link, pubDate: published, description: '' });
            });
          } else {
            const rssItems = doc.querySelectorAll('item');
            rssItems.forEach(item => {
              const title = item.querySelector('title')?.textContent || '';
              const link = item.querySelector('link')?.textContent || '';
              const pubDate = item.querySelector('pubDate')?.textContent || '';
              items.push({ title: title.trim(), link: link.trim(), pubDate, description: '' });
            });
          }

          // Find new items
          const oldUrls = new Set(oldItems.map(i => i.link));
          const newItems = items.filter(i => !oldUrls.has(i.link));
          totalNewItems += newItems.length;

          updatedSubs[id] = {
            ...sub,
            items: items.slice(0, 50),
            lastChecked: new Date().toISOString()
          };
        } catch (e) {
          console.warn('Failed to refresh:', sub.title, e);
          updatedSubs[id] = sub;
        }
      }

      // Save updated subscriptions
      await chrome.storage.local.set({ subscriptions: updatedSubs });

      // Notify if there are new items
      if (totalNewItems > 0 && notifyEnabled) {
        const notificationId = 'markpilot-feed-' + Date.now();
        chrome.notifications.create(notificationId, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon48.png'),
          title: 'MarkPilot 订阅更新',
          message: `发现 ${totalNewItems} 条新内容，点击查看`,
          priority: 2
        }, (id) => {
          if (chrome.runtime.lastError) {
            console.error('Notification error:', chrome.runtime.lastError);
          } else {
            console.log('Notification created:', id);
          }
        });
      }

      console.log('Auto-refresh complete. New items:', totalNewItems);
    } catch (e) {
      console.error('Auto-refresh error:', e);
    }
  }
});

// Handle notification click - open feed page
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('markpilot-')) {
    chrome.tabs.create({ url: chrome.runtime.getURL('feed.html') });
    chrome.notifications.clear(notificationId);
  }
});

// Initialize alarm on install/update
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['feed_refresh_interval']);
  const interval = result.feed_refresh_interval || 60;

  if (interval > 0) {
    chrome.alarms.create('feedRefresh', {
      periodInMinutes: interval
    });
    console.log('Feed refresh alarm set for', interval, 'minutes');
  }
});
