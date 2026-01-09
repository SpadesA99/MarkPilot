// Feed Service - RSS/Sitemap Discovery and Parsing

/**
 * Discover RSS/Atom/Sitemap feed from a URL
 * @param {string} url - Website URL
 * @returns {Promise<{type: string, feedUrl: string, title: string} | null>}
 */
export const discoverFeed = async (url) => {
  try {
    const baseUrl = new URL(url).origin;

    // 1. Try to fetch the page and look for RSS link in HTML
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const html = await response.text();

        // Look for RSS/Atom link tags
        const rssMatch = html.match(/<link[^>]*type=["']application\/(rss|atom)\+xml["'][^>]*>/gi);
        if (rssMatch) {
          for (const link of rssMatch) {
            const hrefMatch = link.match(/href=["']([^"']+)["']/i);
            if (hrefMatch) {
              let feedUrl = hrefMatch[1];
              // Handle relative URLs
              if (feedUrl.startsWith('/')) {
                feedUrl = baseUrl + feedUrl;
              } else if (!feedUrl.startsWith('http')) {
                feedUrl = baseUrl + '/' + feedUrl;
              }

              const titleMatch = link.match(/title=["']([^"']+)["']/i);
              return {
                type: link.includes('atom') ? 'atom' : 'rss',
                feedUrl,
                title: titleMatch ? titleMatch[1] : 'RSS Feed'
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch page for RSS discovery:', e);
    }

    // 2. Try common RSS/Atom paths
    const commonPaths = [
      '/feed',
      '/feed/',
      '/rss',
      '/rss.xml',
      '/atom.xml',
      '/feed.xml',
      '/index.xml',
      '/blog/feed',
      '/blog/rss',
      '/?feed=rss2',
      '/feeds/posts/default' // Blogger
    ];

    for (const path of commonPaths) {
      try {
        const feedUrl = baseUrl + path;
        const response = await fetch(feedUrl, {
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const text = await response.text();

          if (contentType.includes('xml') ||
              contentType.includes('rss') ||
              contentType.includes('atom') ||
              text.includes('<rss') ||
              text.includes('<feed') ||
              text.includes('<channel>')) {
            return {
              type: text.includes('<feed') ? 'atom' : 'rss',
              feedUrl,
              title: 'RSS Feed'
            };
          }
        }
      } catch (e) {
        // Continue to next path
      }
    }

    // 3. Try sitemap.xml as fallback
    try {
      const sitemapUrl = baseUrl + '/sitemap.xml';
      const response = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const text = await response.text();
        if (text.includes('<urlset') || text.includes('<sitemapindex')) {
          return {
            type: 'sitemap',
            feedUrl: sitemapUrl,
            title: 'Sitemap'
          };
        }
      }
    } catch (e) {
      // Sitemap not found
    }

    return null;
  } catch (e) {
    console.error('Feed discovery error:', e);
    return null;
  }
};

/**
 * Parse RSS/Atom feed
 * @param {string} feedUrl - Feed URL
 * @returns {Promise<Array<{title: string, link: string, pubDate: string, description: string}>>}
 */
export const parseRSS = async (feedUrl) => {
  try {
    const response = await fetch(feedUrl, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status}`);
    }

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    const items = [];

    // Check if it's Atom format
    const isAtom = text.includes('<feed');

    if (isAtom) {
      // Parse Atom
      const entries = doc.querySelectorAll('entry');
      entries.forEach(entry => {
        const title = entry.querySelector('title')?.textContent || '';
        const linkEl = entry.querySelector('link[href]');
        const link = linkEl?.getAttribute('href') || '';
        const published = entry.querySelector('published')?.textContent ||
                         entry.querySelector('updated')?.textContent || '';
        const summary = entry.querySelector('summary')?.textContent ||
                       entry.querySelector('content')?.textContent || '';

        items.push({
          title: title.trim(),
          link,
          pubDate: published,
          description: stripHtml(summary).slice(0, 300)
        });
      });
    } else {
      // Parse RSS
      const rssItems = doc.querySelectorAll('item');
      rssItems.forEach(item => {
        const title = item.querySelector('title')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent || '';
        const description = item.querySelector('description')?.textContent || '';

        items.push({
          title: title.trim(),
          link: link.trim(),
          pubDate,
          description: stripHtml(description).slice(0, 300)
        });
      });
    }

    return items.slice(0, 50); // Limit to 50 items
  } catch (e) {
    console.error('RSS parse error:', e);
    return [];
  }
};

/**
 * Parse Sitemap XML
 * @param {string} sitemapUrl - Sitemap URL
 * @returns {Promise<Array<{loc: string, lastmod: string}>>}
 */
export const parseSitemap = async (sitemapUrl) => {
  try {
    const response = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`);
    }

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    const items = [];

    // Check if it's a sitemap index
    const sitemaps = doc.querySelectorAll('sitemap');
    if (sitemaps.length > 0) {
      // Parse sitemap index - get URLs from child sitemaps
      for (const sitemap of Array.from(sitemaps).slice(0, 3)) {
        const loc = sitemap.querySelector('loc')?.textContent;
        if (loc) {
          const childItems = await parseSitemap(loc);
          items.push(...childItems);
        }
      }
    } else {
      // Parse regular sitemap
      const urls = doc.querySelectorAll('url');
      urls.forEach(url => {
        const loc = url.querySelector('loc')?.textContent || '';
        const lastmod = url.querySelector('lastmod')?.textContent || '';

        if (loc) {
          items.push({ loc, lastmod });
        }
      });
    }

    // Sort by lastmod (newest first) and limit
    return items
      .filter(item => item.loc)
      .sort((a, b) => {
        if (!a.lastmod) return 1;
        if (!b.lastmod) return -1;
        return new Date(b.lastmod) - new Date(a.lastmod);
      })
      .slice(0, 50);
  } catch (e) {
    console.error('Sitemap parse error:', e);
    return [];
  }
};

/**
 * Fetch page content and extract text
 * @param {string} url - Page URL
 * @returns {Promise<{title: string, content: string, excerpt: string}>}
 */
export const fetchPageContent = async (url) => {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Get title
    const title = doc.querySelector('title')?.textContent ||
                  doc.querySelector('h1')?.textContent ||
                  new URL(url).hostname;

    // Remove script, style, nav, header, footer
    ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript'].forEach(tag => {
      doc.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Try to find main content
    const mainContent = doc.querySelector('main') ||
                       doc.querySelector('article') ||
                       doc.querySelector('.content') ||
                       doc.querySelector('#content') ||
                       doc.body;

    const content = mainContent?.textContent || '';
    const cleanContent = content.replace(/\s+/g, ' ').trim();

    return {
      title: title.trim(),
      content: cleanContent.slice(0, 5000), // Limit content size
      excerpt: cleanContent.slice(0, 300)
    };
  } catch (e) {
    console.error('Fetch page content error:', e);
    return {
      title: new URL(url).hostname,
      content: '',
      excerpt: ''
    };
  }
};

/**
 * Get all subscriptions from storage
 * @returns {Promise<Object>}
 */
export const getSubscriptions = async () => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return {};
  }
  const result = await chrome.storage.local.get(['subscriptions']);
  return result.subscriptions || {};
};

/**
 * Save subscription
 * @param {Object} subscription
 */
export const saveSubscription = async (subscription) => {
  const subscriptions = await getSubscriptions();
  subscriptions[subscription.id] = subscription;
  await chrome.storage.local.set({ subscriptions });
  return subscription;
};

/**
 * Delete subscription and save to ignored list
 * @param {string} id
 */
export const deleteSubscription = async (id) => {
  const subscriptions = await getSubscriptions();
  const sub = subscriptions[id];

  // Save to ignored list to prevent re-discovery
  if (sub) {
    try {
      const domain = new URL(sub.url).hostname;
      await addIgnoredDomain(domain);
    } catch (e) {
      // Invalid URL, just delete
    }
  }

  delete subscriptions[id];
  await chrome.storage.local.set({ subscriptions });
};

/**
 * Get ignored domains (deleted subscriptions)
 * @returns {Promise<Set<string>>}
 */
export const getIgnoredDomains = async () => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return new Set();
  }
  const result = await chrome.storage.local.get(['ignored_feed_domains']);
  return new Set(result.ignored_feed_domains || []);
};

/**
 * Add domain to ignored list
 * @param {string} domain
 */
export const addIgnoredDomain = async (domain) => {
  const ignored = await getIgnoredDomains();
  ignored.add(domain);
  await chrome.storage.local.set({ ignored_feed_domains: Array.from(ignored) });
};

/**
 * Remove domain from ignored list
 * @param {string} domain
 */
export const removeIgnoredDomain = async (domain) => {
  const ignored = await getIgnoredDomains();
  ignored.delete(domain);
  await chrome.storage.local.set({ ignored_feed_domains: Array.from(ignored) });
};

/**
 * Clear all ignored domains
 */
export const clearIgnoredDomains = async () => {
  await chrome.storage.local.set({ ignored_feed_domains: [] });
};

/**
 * Get domains that have no RSS feeds (discovered during scan)
 * @returns {Promise<Set<string>>}
 */
export const getNoFeedDomains = async () => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return new Set();
  }
  const result = await chrome.storage.local.get(['no_feed_domains']);
  return new Set(result.no_feed_domains || []);
};

/**
 * Add multiple domains to no-feed list (batch)
 * @param {string[]} domains
 */
export const addNoFeedDomains = async (domains) => {
  const noFeed = await getNoFeedDomains();
  domains.forEach(d => noFeed.add(d));
  await chrome.storage.local.set({ no_feed_domains: Array.from(noFeed) });
};

/**
 * Clear all no-feed domains
 */
export const clearNoFeedDomains = async () => {
  await chrome.storage.local.set({ no_feed_domains: [] });
};

/**
 * Refresh a subscription's content
 * @param {Object} subscription
 * @returns {Promise<Object>} Updated subscription with new items
 */
export const refreshSubscription = async (subscription) => {
  let items = [];

  if (subscription.feedType === 'sitemap') {
    const sitemapItems = await parseSitemap(subscription.feedUrl);
    items = sitemapItems.map(item => ({
      title: item.loc.split('/').pop() || item.loc,
      link: item.loc,
      pubDate: item.lastmod,
      description: ''
    }));
  } else {
    items = await parseRSS(subscription.feedUrl);
  }

  const updated = {
    ...subscription,
    items,
    lastChecked: new Date().toISOString()
  };

  await saveSubscription(updated);
  return updated;
};

/**
 * Create a new subscription from URL
 * @param {string} url - Bookmark URL
 * @param {string} title - Bookmark title
 * @returns {Promise<Object|null>}
 */
export const createSubscription = async (url, title) => {
  const feed = await discoverFeed(url);

  if (!feed) {
    return null;
  }

  const subscription = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
    url,
    title: title || new URL(url).hostname,
    feedUrl: feed.feedUrl,
    feedType: feed.type,
    feedTitle: feed.title,
    items: [],
    lastChecked: null,
    createdAt: new Date().toISOString()
  };

  // Initial fetch
  return await refreshSubscription(subscription);
};

// Helper: Strip HTML tags (safe regex-based approach)
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
