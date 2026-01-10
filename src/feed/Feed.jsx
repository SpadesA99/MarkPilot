import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Rss, Sparkles, Bell, BellOff, ChevronDown, ChevronUp, Search, Clock, Settings, Plus, X } from 'lucide-react';
import FeedCard from './FeedCard';
import { getSubscriptions, deleteSubscription, refreshSubscription, discoverFeed, saveSubscription, getIgnoredDomains, clearIgnoredDomains, getNoFeedDomains, addNoFeedDomains, clearNoFeedDomains, parseRSS } from '../services/feedService';

function Feed({ embedded = false }) {
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [briefing, setBriefing] = useState([]); // Array of {title, content}
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60); // minutes
  const [barkKey, setBarkKey] = useState(''); // Bark notification key
  const [showSettings, setShowSettings] = useState(false);
  const [logs, setLogs] = useState([]);
  const [discoveryProgress, setDiscoveryProgress] = useState({ current: 0, total: 0 });
  const logRef = useRef(null);

  // Manual add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [addError, setAddError] = useState('');

  // Load subscriptions on mount
  useEffect(() => {
    loadSubscriptions();
    loadSettings();
  }, []);

  // Auto scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // ESC key to close modals
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (showAddModal) {
          setShowAddModal(false);
          setManualUrl('');
          setManualTitle('');
          setAddError('');
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showAddModal]);

  // Setup auto refresh alarm
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      // Clear existing alarm
      chrome.alarms.clear('feedRefresh');

      if (autoRefreshInterval > 0) {
        // Create new alarm
        chrome.alarms.create('feedRefresh', {
          periodInMinutes: autoRefreshInterval
        });
      }

      // Save setting
      chrome.storage.local.set({ feed_refresh_interval: autoRefreshInterval });
    }
  }, [autoRefreshInterval]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const subs = await getSubscriptions();
      setSubscriptions(subs);

      // Load saved briefing
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['saved_briefing']);
        if (result.saved_briefing) {
          // Handle both old string format and new array format
          if (Array.isArray(result.saved_briefing)) {
            setBriefing(result.saved_briefing);
          } else if (typeof result.saved_briefing === 'string') {
            // Convert old format to new
            setBriefing([{ title: '简报', content: result.saved_briefing }]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load subscriptions:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get([
        'feed_notify_enabled',
        'feed_refresh_interval',
        'bark_key'
      ]);
      setNotifyEnabled(result.feed_notify_enabled !== false);
      if (result.feed_refresh_interval) {
        setAutoRefreshInterval(result.feed_refresh_interval);
      }
      if (result.bark_key) {
        setBarkKey(result.bark_key);
      }
    }
  };

  // Send Bark notification
  const sendBarkNotification = async (title, message, forceNotify = false, articleUrl = null) => {
    // Always fetch latest bark_key from storage
    let currentBarkKey = barkKey;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(['bark_key', 'feed_notify_enabled']);
      console.log('Bark notification - storage result:', result);
      currentBarkKey = result.bark_key || '';
      const currentNotifyEnabled = result.feed_notify_enabled !== false;
      if (!currentBarkKey) {
        console.log('Bark notification skipped: no bark_key configured, result was:', result);
        return false;
      }
      if (!currentNotifyEnabled && !forceNotify) {
        console.log('Bark notification skipped: notifications disabled');
        return false;
      }
    } else {
      console.log('Bark notification - chrome.storage not available, using state:', barkKey);
      if (!currentBarkKey) return false;
      if (!notifyEnabled && !forceNotify) return false;
    }

    try {
      // Build Bark API URL with optional article URL parameter
      let apiUrl = `https://api.day.app/${currentBarkKey}/${encodeURIComponent(title)}/${encodeURIComponent(message)}`;
      if (articleUrl) {
        apiUrl += `?url=${encodeURIComponent(articleUrl)}`;
      }
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        console.log('Bark notification sent:', title, articleUrl ? `(URL: ${articleUrl})` : '');
        return true;
      } else {
        console.error('Bark notification failed:', response.status);
        return false;
      }
    } catch (e) {
      console.error('Bark notification error:', e);
      return false;
    }
  };

  // Discover feeds from all bookmarks (concurrent processing)
  const handleDiscoverAll = async () => {
    setDiscovering(true);
    setLogs([]);

    try {
      // Check if bookmarks API is available
      if (typeof chrome === 'undefined' || !chrome.bookmarks) {
        setLogs(prev => [...prev, '✗ 书签 API 不可用']);
        return;
      }

      // Get all bookmarks
      const tree = await chrome.bookmarks.getTree();

      // Flatten to get all URLs and extract subpaths
      const allUrls = [];
      const seenKeys = new Set(); // domain or domain+subpath

      // Subpath patterns to extract from URLs
      const subpathPatterns = ['/blog', '/posts', '/articles', '/news', '/updates', '/changelog'];

      const traverse = (nodes) => {
        for (const node of nodes) {
          if (node.url) {
            try {
              const urlObj = new URL(node.url);
              const domain = urlObj.hostname;
              const pathname = urlObj.pathname;

              // Add base domain if not seen
              if (!seenKeys.has(domain)) {
                seenKeys.add(domain);
                allUrls.push({ url: urlObj.origin, title: node.title, domain, key: domain });
              }

              // Check for subpaths in the URL
              for (const pattern of subpathPatterns) {
                if (pathname.toLowerCase().includes(pattern)) {
                  // Extract the subpath (e.g., /blog or /blog/category)
                  const patternIndex = pathname.toLowerCase().indexOf(pattern);
                  const subpath = pathname.substring(0, patternIndex + pattern.length);
                  const subpathKey = domain + subpath;

                  if (!seenKeys.has(subpathKey)) {
                    seenKeys.add(subpathKey);
                    allUrls.push({
                      url: urlObj.origin + subpath,
                      title: `${node.title} (${subpath})`,
                      domain,
                      key: subpathKey,
                      isSubpath: true
                    });
                  }
                  break; // Only add first matching subpath
                }
              }
            } catch (e) {
              // Invalid URL
            }
          }
          if (node.children) {
            traverse(node.children);
          }
        }
      };
      traverse(tree);

      const baseCount = allUrls.filter(u => !u.isSubpath).length;
      const subpathCount = allUrls.filter(u => u.isSubpath).length;
      setLogs(prev => [...prev, `找到 ${baseCount} 个域名 + ${subpathCount} 个子路径，共 ${allUrls.length} 个待检查`]);
      setDiscoveryProgress({ current: 0, total: allUrls.length });

      // Check each URL for feeds
      const existingSubs = await getSubscriptions();
      const existingDomains = new Set(
        Object.values(existingSubs).map(s => {
          try {
            return new URL(s.url).hostname;
          } catch {
            return null;
          }
        }).filter(Boolean)
      );

      // Get ignored domains (previously deleted subscriptions)
      const ignoredDomains = await getIgnoredDomains();
      // Get domains known to have no feeds
      const noFeedDomains = await getNoFeedDomains();

      // Filter out already subscribed, ignored, and no-feed URLs
      const skippedSubscribed = [];
      const skippedIgnored = [];
      const skippedNoFeed = [];
      const urlsToCheck = allUrls.filter(({ domain, key }) => {
        // Check if domain is already subscribed
        if (existingDomains.has(domain)) {
          skippedSubscribed.push(key);
          return false;
        }
        // Check if domain was deleted (ignored)
        if (ignoredDomains.has(domain)) {
          skippedIgnored.push(key);
          return false;
        }
        // Check if this specific URL (key) has no feed
        if (noFeedDomains.has(key)) {
          skippedNoFeed.push(key);
          return false;
        }
        return true;
      });

      if (skippedSubscribed.length > 0) {
        setLogs(prev => [...prev, `⏭ 跳过 ${skippedSubscribed.length} 个已订阅的 URL`]);
      }
      if (skippedIgnored.length > 0) {
        setLogs(prev => [...prev, `🚫 跳过 ${skippedIgnored.length} 个已删除的域名`]);
      }
      if (skippedNoFeed.length > 0) {
        setLogs(prev => [...prev, `⚪ 跳过 ${skippedNoFeed.length} 个无订阅的 URL`]);
      }
      const skipped = skippedSubscribed.length + skippedIgnored.length + skippedNoFeed.length;

      const POOL_SIZE = 10; // Task pool size
      setLogs(prev => [...prev, `🚀 开始任务池检查 ${urlsToCheck.length} 个 URL (并发数: ${POOL_SIZE})`]);

      let discovered = 0;
      let processed = 0;
      let taskIndex = 0;
      let idCounter = 0; // Counter for unique IDs
      const newNoFeedKeys = []; // Collect keys (domain or domain+subpath) with no feeds

      // Task pool implementation
      const processTask = async ({ url, title, domain, key }) => {
        try {
          const feed = await discoverFeed(url);
          if (feed) {
            // Verify feed has content by parsing it
            const items = await parseRSS(feed.feedUrl);
            if (!items || items.length === 0) {
              // Feed exists but has no items - treat as no feed
              return { url, title, domain, key, feed: null, success: true, reason: 'empty' };
            }
            return { url, title, domain, key, feed, items, success: true };
          }
          return { url, title, domain, key, feed: null, success: true };
        } catch (e) {
          return { url, title, domain, key, feed: null, success: false, error: e };
        }
      };

      const handleResult = async (result) => {
        processed++;
        const { url, title, domain, key, feed, items, reason } = result;

        if (feed && items && items.length > 0) {
          // Create subscription with unique ID using counter
          idCounter++;
          const subscription = {
            id: Date.now().toString() + '-' + idCounter + '-' + Math.random().toString(36).slice(2, 7),
            url,
            title: title || domain,
            feedUrl: feed.feedUrl,
            feedType: feed.type,
            feedTitle: feed.title,
            items: items.slice(0, 50), // Save first 50 items
            readItems: [],
            lastChecked: new Date().toISOString(),
            createdAt: new Date().toISOString()
          };

          await saveSubscription(subscription);
          existingDomains.add(domain);
          discovered++;
          setLogs(prev => [...prev, `✓ 发现订阅: ${key} (${feed.type}, ${items.length} 条)`]);

          // Update state
          setSubscriptions(prev => ({
            ...prev,
            [subscription.id]: subscription
          }));
        } else {
          // Save key as no-feed (allows granular caching for subpaths)
          newNoFeedKeys.push(key);
          if (reason === 'empty') {
            setLogs(prev => [...prev, `⚠ 空订阅: ${key} (无内容)`]);
          } else {
            setLogs(prev => [...prev, `✗ 无订阅: ${key}`]);
          }
        }

        // Update progress
        setDiscoveryProgress({ current: processed + skipped, total: allUrls.length });
      };

      // Run task pool
      const runTaskPool = async () => {
        const activePromises = new Map();

        const startNextTask = () => {
          if (taskIndex < urlsToCheck.length) {
            const task = urlsToCheck[taskIndex];
            const taskId = taskIndex;
            taskIndex++;

            setLogs(prev => [...prev, `🔍 检查: ${task.key}`]);

            const promise = processTask(task).then(async (result) => {
              activePromises.delete(taskId);
              await handleResult(result);
              // Start next task immediately when one completes
              startNextTask();
            });

            activePromises.set(taskId, promise);
          }
        };

        // Start initial pool of tasks
        for (let i = 0; i < Math.min(POOL_SIZE, urlsToCheck.length); i++) {
          startNextTask();
        }

        // Wait for all tasks to complete
        while (activePromises.size > 0) {
          await Promise.race(activePromises.values());
        }
      };

      await runTaskPool();

      // Save all no-feed keys at once
      if (newNoFeedKeys.length > 0) {
        await addNoFeedDomains(newNoFeedKeys);
        setLogs(prev => [...prev, `💾 已记录 ${newNoFeedKeys.length} 个无订阅 URL，下次将跳过`]);
      }

      setLogs(prev => [...prev, `\n✅ 完成！发现 ${discovered} 个新订阅，跳过 ${skipped} 个 URL`]);
    } catch (e) {
      console.error('Discovery error:', e);
      setLogs(prev => [...prev, `✗ 错误: ${e.message}`]);
    } finally {
      setDiscovering(false);
      setDiscoveryProgress({ current: 0, total: 0 });
    }
  };

  const handleRefresh = async (subId) => {
    setRefreshingIds(prev => new Set(prev).add(subId));
    try {
      const sub = subscriptions[subId];
      const oldItems = sub.items || [];
      const updated = await refreshSubscription(sub);

      // Find new items
      const oldUrls = new Set(oldItems.map(i => i.link));
      const newItems = updated.items.filter(i => !oldUrls.has(i.link));

      setSubscriptions(prev => ({
        ...prev,
        [subId]: updated
      }));

      // Notify via Bark if enabled and has new items
      if (newItems.length > 0) {
        await sendBarkNotification(
          `${updated.title} 有更新`,
          `发现 ${newItems.length} 条新内容`
        );
      }

      return newItems.length;
    } catch (e) {
      console.error('Refresh failed:', e);
      return 0;
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(subId);
        return next;
      });
    }
  };

  const handleRefreshAll = async () => {
    const ids = Object.keys(subscriptions);
    if (ids.length === 0) return;

    // Concurrent refresh all subscriptions
    const results = await Promise.allSettled(
      ids.map(id => handleRefresh(id))
    );

    const totalNew = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + (r.value || 0), 0);

    if (totalNew > 0 && notifyEnabled) {
      // Auto generate briefing for new content
      await handleGenerateBriefing(true);
    }
  };

  const handleDelete = async (subId) => {
    if (!confirm('确定要删除这个订阅吗?')) return;

    try {
      await deleteSubscription(subId);
      setSubscriptions(prev => {
        const updated = { ...prev };
        delete updated[subId];
        return updated;
      });
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  // Toggle follow status for a subscription
  const handleToggleFollow = async (subId) => {
    const sub = subscriptions[subId];
    if (!sub) return;

    const updatedSub = { ...sub, followed: !sub.followed };
    await saveSubscription(updatedSub);
    setSubscriptions(prev => ({
      ...prev,
      [subId]: updatedSub
    }));
  };

  // Fetch full article content from URL
  const fetchArticleContent = async (url) => {
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Extract text content from HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove script, style, nav, header, footer elements
      const elementsToRemove = doc.querySelectorAll('script, style, nav, header, footer, aside, .nav, .header, .footer, .sidebar, .advertisement, .ad');
      elementsToRemove.forEach(el => el.remove());

      // Try to find article content
      const article = doc.querySelector('article, .article, .post, .content, .entry-content, main, #content') || doc.body;

      // Get text content and clean it up
      let text = article?.textContent || '';
      text = text.replace(/\s+/g, ' ').trim();

      // Limit to first 3000 characters
      return text.slice(0, 3000);
    } catch (e) {
      console.error('Failed to fetch article:', url, e);
      return null;
    }
  };

  const handleGenerateBriefing = async (autoNotify = false) => {
    // Only get unread items from FOLLOWED subscriptions
    const followedSubs = Object.values(subscriptions).filter(sub => sub.followed);

    if (followedSubs.length === 0) {
      if (!autoNotify) {
        alert('没有关注的订阅源，请先点击星标关注订阅源');
      }
      return;
    }

    const allItems = followedSubs.flatMap(sub => {
      const readSet = new Set(sub.readItems || []);
      return sub.items
        .filter(item => !readSet.has(item.link))
        .slice(0, 5) // Limit to 5 items per subscription
        .map(item => ({
          source: sub.title,
          subId: sub.id,
          ...item
        }));
    });

    if (allItems.length === 0) {
      if (!autoNotify) {
        alert('关注的订阅源没有未读内容');
      }
      return;
    }

    setGenerating(true);
    setLogs([]);
    setBriefing([]);

    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        alert('存储 API 不可用');
        setGenerating(false);
        return;
      }

      const result = await chrome.storage.local.get(['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url']);
      const settings = {
        provider: result.ai_provider || 'openai',
        apiKey: result.ai_api_key,
        model: result.ai_model,
        baseUrl: result.ai_base_url
      };

      if (!settings.apiKey) {
        if (!autoNotify) {
          alert('请先在书签管理器设置中配置 AI API Key');
        }
        setGenerating(false);
        return;
      }

      setLogs(prev => [...prev, `📰 关注订阅: ${followedSubs.length} 个，未读内容: ${allItems.length} 条`]);

      const { analyzeArticle } = await import('../services/aiService');
      const briefItems = [];

      // Process each article
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        setLogs(prev => [...prev, `🔍 [${i + 1}/${allItems.length}] 抓取: ${item.title.slice(0, 30)}...`]);

        // Fetch full article content
        const fullContent = await fetchArticleContent(item.link);

        if (!fullContent || fullContent.length < 100) {
          setLogs(prev => [...prev, `⚠ 内容抓取失败，使用摘要`]);
        }

        const contentToAnalyze = fullContent || item.description || item.title;

        setLogs(prev => [...prev, `🤖 AI 分析中...`]);

        try {
          // AI analyze each article
          const analysis = await analyzeArticle(
            item.title,
            contentToAnalyze,
            settings
          );

          briefItems.push({
            title: item.title,
            content: analysis,
            url: item.link,
            source: item.source
          });

          setLogs(prev => [...prev, `✓ 完成: ${item.title.slice(0, 30)}...`]);

          // Send Bark notification for each article (always send)
          await sendBarkNotification(
            `[${item.source}] ${item.title}`,
            analysis.slice(0, 200),
            false, // not force notify
            item.link // include URL
          );
        } catch (e) {
          console.error('Article analysis failed:', e);
          setLogs(prev => [...prev, `✗ 分析失败: ${item.title.slice(0, 20)}...`]);

          // Still add to briefing with original description
          const fallbackContent = item.description || '(AI 分析失败)';
          briefItems.push({
            title: item.title,
            content: fallbackContent,
            url: item.link,
            source: item.source
          });

          // Still send notification with original content (always send)
          await sendBarkNotification(
            `[${item.source}] ${item.title}`,
            (item.description || '').slice(0, 200) || '点击查看详情',
            false,
            item.link
          );
        }
      }

      setBriefing(briefItems);

      // Save briefing
      await chrome.storage.local.set({ saved_briefing: briefItems });

      // Mark items as read for followed subscriptions only
      const updatedSubs = { ...subscriptions };
      for (const sub of followedSubs) {
        const readSet = new Set(sub.readItems || []);
        sub.items.slice(0, 5).forEach(item => readSet.add(item.link));
        updatedSubs[sub.id] = {
          ...updatedSubs[sub.id],
          readItems: Array.from(readSet).slice(-500)
        };
        await saveSubscription(updatedSubs[sub.id]);
      }
      setSubscriptions(updatedSubs);

      setLogs(prev => [...prev, `✓ 简报生成完成，共 ${briefItems.length} 条`]);
    } catch (e) {
      console.error('Briefing generation failed:', e);
      setLogs(prev => [...prev, `✗ 生成失败: ${e.message}`]);
      if (!autoNotify) {
        alert('简报生成失败: ' + e.message);
      }
    } finally {
      setGenerating(false);
    }
  };

  const toggleNotify = async () => {
    const newValue = !notifyEnabled;
    setNotifyEnabled(newValue);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ feed_notify_enabled: newValue });
    }
  };

  // Handle manual RSS subscription
  const handleManualAdd = async () => {
    if (!manualUrl.trim()) {
      setAddError('请输入 RSS 地址');
      return;
    }

    setAddingManual(true);
    setAddError('');

    try {
      let feedUrl = manualUrl.trim();

      // Ensure URL has protocol
      if (!feedUrl.startsWith('http://') && !feedUrl.startsWith('https://')) {
        feedUrl = 'https://' + feedUrl;
      }

      // Try to parse as RSS first
      const items = await parseRSS(feedUrl);

      if (items.length === 0) {
        // Try to discover feed from the URL
        const feed = await discoverFeed(feedUrl);
        if (feed) {
          feedUrl = feed.feedUrl;
        } else {
          throw new Error('无法解析该地址，请确保是有效的 RSS/Atom 订阅地址');
        }
      }

      // Check if already subscribed
      const domain = new URL(feedUrl).hostname;
      const existingSubs = Object.values(subscriptions);
      const alreadyExists = existingSubs.some(s => {
        try {
          return new URL(s.feedUrl).hostname === domain;
        } catch {
          return false;
        }
      });

      if (alreadyExists) {
        throw new Error('该订阅源已存在');
      }

      // Create subscription
      const subscription = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
        url: feedUrl,
        title: manualTitle.trim() || domain,
        feedUrl: feedUrl,
        feedType: 'rss',
        feedTitle: manualTitle.trim() || 'RSS Feed',
        items: items,
        readItems: [],
        lastChecked: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await saveSubscription(subscription);

      // Update state
      setSubscriptions(prev => ({
        ...prev,
        [subscription.id]: subscription
      }));

      // Reset form
      setManualUrl('');
      setManualTitle('');
      setShowAddModal(false);

      alert(`成功添加订阅: ${subscription.title}`);
    } catch (e) {
      console.error('Manual add error:', e);
      setAddError(e.message || '添加失败，请检查地址是否正确');
    } finally {
      setAddingManual(false);
    }
  };

  const subscriptionList = Object.values(subscriptions);
  const unreadCount = subscriptionList.reduce((sum, sub) => {
    const readSet = new Set(sub.readItems || []);
    return sum + (sub.items?.filter(i => !readSet.has(i.link)).length || 0);
  }, 0);

  // Count unread items from followed subscriptions only (for AI briefing)
  const followedUnreadCount = subscriptionList
    .filter(sub => sub.followed)
    .reduce((sum, sub) => {
      const readSet = new Set(sub.readItems || []);
      return sum + (sub.items?.filter(i => !readSet.has(i.link)).slice(0, 5).length || 0);
    }, 0);

  return (
    <div className={embedded ? "flex flex-col h-full" : "min-h-screen bg-vscode-bg text-vscode-text"}>
      {/* Title Bar - only show in standalone mode */}
      {!embedded && (
        <div className="h-8 bg-vscode-sidebar border-b border-vscode-border flex items-center justify-between px-3 select-none">
          <div className="flex items-center gap-2 text-[13px] text-vscode-text-muted">
            <Rss size={14} className="text-vscode-orange" />
            <span className="text-vscode-text">MarkPilot Subscriptions</span>
            <span>-</span>
            <span>{subscriptionList.length} 订阅 / {unreadCount} 未读</span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="index.html"
              className="px-2 py-0.5 text-[12px] text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-hover rounded"
            >
              返回书签
            </a>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <header className="bg-vscode-sidebar border-b border-vscode-border px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleDiscoverAll}
            disabled={discovering}
            className="flex items-center gap-2 px-3 py-1.5 bg-vscode-orange/20 hover:bg-vscode-orange/30 text-vscode-orange text-[13px] rounded disabled:opacity-50"
          >
            <Search size={14} className={discovering ? 'animate-pulse' : ''} />
            <span>{discovering ? `发现中 (${discoveryProgress.current}/${discoveryProgress.total})` : '一键发现订阅'}</span>
          </button>

          <button
            onClick={handleRefreshAll}
            disabled={loading || refreshingIds.size > 0 || discovering}
            className="flex items-center gap-2 px-3 py-1.5 bg-vscode-hover hover:bg-vscode-active text-[13px] rounded disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshingIds.size > 0 ? 'animate-spin' : ''} />
            <span>{refreshingIds.size > 0 ? `刷新中 (${refreshingIds.size})` : '刷新全部'}</span>
          </button>

          <button
            onClick={() => handleGenerateBriefing(false)}
            disabled={generating || subscriptionList.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-vscode-blue hover:bg-vscode-blue-light text-white text-[13px] rounded disabled:opacity-50"
          >
            <Sparkles size={14} />
            <span>{generating ? '生成中...' : `AI 简报 (${followedUnreadCount})`}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-vscode-green/20 hover:bg-vscode-green/30 text-vscode-green text-[13px] rounded"
          >
            <Plus size={14} />
            <span>手动添加</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-hover rounded"
          >
            <Settings size={16} />
          </button>

          <button
            onClick={toggleNotify}
            className="flex items-center gap-1.5 px-2 py-1 text-[12px] text-vscode-text-muted hover:text-vscode-text"
          >
            {notifyEnabled ? <Bell size={14} /> : <BellOff size={14} />}
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-vscode-sidebar border-b border-vscode-border px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-vscode-text-muted" />
              <span className="text-[12px] text-vscode-text-muted">自动刷新间隔:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-vscode-bg border border-vscode-border rounded px-2 py-1 text-[12px]"
              >
                <option value={0}>关闭</option>
                <option value={15}>15 分钟</option>
                <option value={30}>30 分钟</option>
                <option value={60}>1 小时</option>
                <option value={120}>2 小时</option>
                <option value={360}>6 小时</option>
                <option value={720}>12 小时</option>
                <option value={1440}>24 小时</option>
              </select>
            </div>
            <span className="text-[11px] text-vscode-text-muted">
              {autoRefreshInterval > 0 ? `每 ${autoRefreshInterval} 分钟自动刷新并生成简报` : '自动刷新已关闭'}
            </span>
            <div className="border-l border-vscode-border h-4 mx-2"></div>
            <button
              onClick={async () => {
                if (confirm('确定要清除已删除订阅的记录吗？这将允许重新发现之前删除的订阅。')) {
                  await clearIgnoredDomains();
                  alert('已清除删除记录');
                }
              }}
              className="text-[12px] text-vscode-text-muted hover:text-vscode-red"
            >
              清除删除记录
            </button>
            <div className="border-l border-vscode-border h-4 mx-2"></div>
            <button
              onClick={async () => {
                const noFeedKeys = await getNoFeedDomains();
                if (noFeedKeys.size === 0) {
                  alert('没有缓存的无订阅 URL');
                  return;
                }
                if (confirm(`确定要清除 ${noFeedKeys.size} 个无订阅 URL 的缓存吗？这将允许重新检查这些 URL。`)) {
                  await clearNoFeedDomains();
                  alert('已清除无订阅缓存');
                }
              }}
              className="text-[12px] text-vscode-text-muted hover:text-vscode-orange"
            >
              清除无订阅缓存
            </button>
            <div className="border-l border-vscode-border h-4 mx-2"></div>
            <button
              onClick={async () => {
                if (Object.keys(subscriptions).length === 0) {
                  alert('没有订阅源');
                  return;
                }
                if (confirm(`确定要删除全部 ${Object.keys(subscriptions).length} 个订阅源吗？此操作不可恢复。`)) {
                  await chrome.storage.local.set({ subscriptions: {} });
                  setSubscriptions({});
                  alert('已删除所有订阅源');
                }
              }}
              className="text-[12px] text-vscode-text-muted hover:text-vscode-red"
            >
              删除所有订阅
            </button>
            <div className="border-l border-vscode-border h-4 mx-2"></div>
            <button
              onClick={async () => {
                const subCount = Object.keys(subscriptions).length;
                const ignoredDomains = await getIgnoredDomains();
                const noFeedKeys = await getNoFeedDomains();
                const totalItems = subCount + ignoredDomains.size + noFeedKeys.size;

                if (totalItems === 0) {
                  alert('没有缓存数据');
                  return;
                }

                if (confirm(`确定要清除所有缓存数据吗？\n\n包括:\n- ${subCount} 个订阅源\n- ${ignoredDomains.size} 个删除记录\n- ${noFeedKeys.size} 个无订阅缓存\n\n此操作不可恢复。`)) {
                  await chrome.storage.local.set({ subscriptions: {} });
                  await clearIgnoredDomains();
                  await clearNoFeedDomains();
                  setSubscriptions({});
                  alert('已清除所有缓存数据');
                }
              }}
              className="text-[12px] text-vscode-red hover:text-red-400"
            >
              清除所有数据
            </button>
          </div>
        </div>
      )}

      {/* Discovery/Generation Progress - Modal Style */}
      {(discovering || generating) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-vscode-sidebar border border-vscode-border rounded-lg w-full max-w-2xl mx-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vscode-green opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-vscode-green"></span>
                </div>
                <span className="text-[14px] font-medium">
                  {discovering ? '发现订阅中...' : '生成简报中...'}
                </span>
                {discoveryProgress.total > 0 && (
                  <span className="text-[12px] text-vscode-text-muted">
                    ({discoveryProgress.current}/{discoveryProgress.total})
                  </span>
                )}
              </div>
            </div>
            {/* Progress Bar */}
            {discoveryProgress.total > 0 && (
              <div className="px-4 pt-3">
                <div className="h-1.5 bg-vscode-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-vscode-green transition-all duration-300"
                    style={{ width: `${(discoveryProgress.current / discoveryProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {/* Log Output */}
            <div ref={logRef} className="h-80 overflow-y-auto p-4 font-mono text-[11px] space-y-1">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${
                    log.startsWith('✓') ? 'text-vscode-green' :
                    log.startsWith('✗') ? 'text-vscode-red' :
                    log.startsWith('🔍') ? 'text-vscode-blue' :
                    log.startsWith('📊') ? 'text-vscode-yellow' :
                    i === logs.length - 1 ? 'text-vscode-text' : 'text-vscode-text-muted'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-vscode-sidebar border border-vscode-border rounded-lg w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-vscode-border">
              <div className="flex items-center gap-2 text-[14px] font-medium">
                <Plus size={16} className="text-vscode-green" />
                <span>手动添加订阅</span>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setManualUrl('');
                  setManualTitle('');
                  setAddError('');
                }}
                className="p-1 hover:bg-vscode-hover rounded"
              >
                <X size={16} className="text-vscode-text-muted" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[12px] text-vscode-text-muted mb-1">
                  RSS/Atom 订阅地址 <span className="text-vscode-red">*</span>
                </label>
                <input
                  type="text"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full px-3 py-2 bg-vscode-bg border border-vscode-border rounded text-[13px] focus:border-vscode-blue focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] text-vscode-text-muted mb-1">
                  订阅名称 (可选)
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="自动从订阅源获取"
                  className="w-full px-3 py-2 bg-vscode-bg border border-vscode-border rounded text-[13px] focus:border-vscode-blue focus:outline-none"
                />
              </div>

              {addError && (
                <div className="text-[12px] text-vscode-red bg-vscode-red/10 px-3 py-2 rounded">
                  {addError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setManualUrl('');
                    setManualTitle('');
                    setAddError('');
                  }}
                  className="px-4 py-1.5 text-[13px] text-vscode-text-muted hover:bg-vscode-hover rounded"
                >
                  取消
                </button>
                <button
                  onClick={handleManualAdd}
                  disabled={addingManual || !manualUrl.trim()}
                  className="px-4 py-1.5 bg-vscode-green hover:opacity-90 text-white text-[13px] rounded disabled:opacity-50"
                >
                  {addingManual ? '添加中...' : '添加订阅'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex flex-col lg:flex-row ${embedded ? 'flex-1 overflow-hidden' : 'h-[calc(100vh-120px)]'}`}>
        {/* Left: Subscriptions */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="animate-spin text-vscode-text-muted" size={24} />
            </div>
          ) : subscriptionList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-vscode-text-muted">
              <Rss size={48} className="mb-4 opacity-50" />
              <p>暂无订阅</p>
              <p className="text-[12px] mt-2">点击"一键发现订阅"从书签中搜索 RSS 源</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {subscriptionList.map(sub => (
                <FeedCard
                  key={sub.id}
                  subscription={sub}
                  isRefreshing={refreshingIds.has(sub.id)}
                  onRefresh={() => handleRefresh(sub.id)}
                  onDelete={() => handleDelete(sub.id)}
                  onToggleFollow={() => handleToggleFollow(sub.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Briefing Panel */}
        <div className="lg:w-96 border-t lg:border-t-0 lg:border-l border-vscode-border bg-vscode-sidebar flex flex-col">
          <div
            className="flex items-center justify-between px-4 py-2 border-b border-vscode-border cursor-pointer hover:bg-vscode-hover"
            onClick={() => setBriefingExpanded(!briefingExpanded)}
          >
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <Sparkles size={14} className="text-vscode-purple" />
              <span>AI 简报</span>
              {followedUnreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-vscode-blue/20 text-vscode-blue rounded">
                  {followedUnreadCount} 关注未读
                </span>
              )}
            </div>
            {briefingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {briefingExpanded && (
            <div className="flex-1 overflow-y-auto">
              {briefing.length > 0 ? (
                <div className="p-4 space-y-4">
                  {briefing.map((item, index) => (
                    <div key={index} className="space-y-2 pb-3 border-b border-vscode-border last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {item.url ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[12px] font-medium text-vscode-blue hover:underline line-clamp-2"
                            >
                              {item.title}
                            </a>
                          ) : (
                            <div className={`text-[12px] font-medium ${item.title === '总结' ? 'text-vscode-blue' : 'text-vscode-orange'}`}>
                              {item.title}
                            </div>
                          )}
                          {item.source && (
                            <div className="text-[10px] text-vscode-text-muted mt-0.5">
                              来源: {item.source}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-[12px] leading-relaxed text-vscode-text whitespace-pre-wrap">
                        {item.content}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-[13px] text-vscode-text-muted">
                  {subscriptionList.length === 0
                    ? '先添加订阅，然后生成简报'
                    : Object.values(subscriptions).some(s => s.followed)
                      ? followedUnreadCount > 0
                        ? `关注订阅有 ${followedUnreadCount} 条未读内容，点击"AI 简报"生成摘要`
                        : '关注订阅暂无未读内容'
                      : '请先点击星标关注订阅源，AI 简报仅分析关注的订阅'
                  }
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Feed;
