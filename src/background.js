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

// Parse RSS/Atom XML using regex (service worker doesn't have DOMParser)
function parseXMLFeed(text) {
  const items = [];
  const isAtom = text.includes('<feed');

  if (isAtom) {
    // Parse Atom entries
    const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = entryRegex.exec(text)) !== null) {
      const entry = match[1];
      const title = (entry.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
      const link = (entry.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1] || '';
      const published = (entry.match(/<published>([^<]*)<\/published>/i) || [])[1] ||
                       (entry.match(/<updated>([^<]*)<\/updated>/i) || [])[1] || '';
      const summary = (entry.match(/<summary[^>]*>([^<]*)<\/summary>/i) || [])[1] || '';
      items.push({
        title: title.trim(),
        link,
        pubDate: published,
        description: summary.slice(0, 300)
      });
    }
  } else {
    // Parse RSS items
    const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const title = (item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || '';
      const link = (item.match(/<link[^>]*>([^<]*)<\/link>/i) || [])[1] || '';
      const pubDate = (item.match(/<pubDate>([^<]*)<\/pubDate>/i) || [])[1] || '';
      const description = (item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1] || '';
      items.push({
        title: title.trim(),
        link: link.trim(),
        pubDate,
        description: description.replace(/<[^>]*>/g, '').slice(0, 300)
      });
    }
  }

  return items.slice(0, 50);
}

// Handle alarm for auto-refresh feeds
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'feedRefresh') {
    console.log('Auto-refreshing feeds...');

    try {
      // Get subscriptions and settings
      const result = await chrome.storage.local.get(['subscriptions', 'feed_notify_enabled', 'bark_key']);
      const subscriptions = result.subscriptions || {};
      const notifyEnabled = result.feed_notify_enabled !== false;
      const barkKey = result.bark_key || '';

      if (Object.keys(subscriptions).length === 0) {
        return;
      }

      let totalNewItems = 0;
      const updatedSubs = {};
      const newItemsList = []; // Collect new items for notification

      // Refresh each subscription
      for (const [id, sub] of Object.entries(subscriptions)) {
        try {
          const oldItems = sub.items || [];
          const response = await fetch(sub.feedUrl, {
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) continue;

          const text = await response.text();
          const items = parseXMLFeed(text);

          // Find new items
          const oldUrls = new Set(oldItems.map(i => i.link));
          const newItems = items.filter(i => i.link && !oldUrls.has(i.link));

          // Only count for followed subscriptions
          if (sub.followed && newItems.length > 0) {
            totalNewItems += newItems.length;
            newItemsList.push(...newItems.slice(0, 5).map(item => ({
              ...item,
              source: sub.title,
              subId: id
            })));
          }

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

      // Notify via Bark if there are new items from followed subscriptions
      if (totalNewItems > 0 && notifyEnabled && barkKey) {
        try {
          // Send summary notification
          const title = encodeURIComponent('MarkPilot 订阅更新');
          const message = encodeURIComponent(`关注的订阅有 ${totalNewItems} 条新内容`);
          const url = `https://api.day.app/${barkKey}/${title}/${message}`;
          await fetch(url, { signal: AbortSignal.timeout(10000) });
          console.log('Bark notification sent');

          // Also send individual notifications for each new item (max 5)
          for (const item of newItemsList.slice(0, 5)) {
            try {
              const itemTitle = encodeURIComponent(`[${item.source}] ${item.title.slice(0, 50)}`);
              const itemMsg = encodeURIComponent(item.description?.slice(0, 100) || '点击查看');
              let itemUrl = `https://api.day.app/${barkKey}/${itemTitle}/${itemMsg}`;
              if (item.link) {
                itemUrl += `?url=${encodeURIComponent(item.link)}`;
              }
              await fetch(itemUrl, { signal: AbortSignal.timeout(10000) });
            } catch (e) {
              // Ignore individual notification errors
            }
          }
        } catch (e) {
          console.error('Bark notification error:', e);
        }
      }

      console.log('Auto-refresh complete. New items from followed:', totalNewItems);
    } catch (e) {
      console.error('Auto-refresh error:', e);
    }
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
