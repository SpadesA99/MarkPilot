import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Rss, Sparkles, Bell, BellOff, ChevronDown, ChevronUp, Search, Clock, Settings, Plus, X } from 'lucide-react';
import FeedCard from './FeedCard';
import { getSubscriptions, deleteSubscription, refreshSubscription, discoverFeed, saveSubscription, getIgnoredDomains, clearIgnoredDomains, getNoFeedDomains, addNoFeedDomains, clearNoFeedDomains, parseRSS } from '../services/feedService';

function Feed() {
  const [subscriptions, setSubscriptions] = useState({});
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [refreshing, setRefreshing] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(60); // minutes
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
          setBriefing(result.saved_briefing);
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
        'feed_refresh_interval'
      ]);
      setNotifyEnabled(result.feed_notify_enabled !== false);
      if (result.feed_refresh_interval) {
        setAutoRefreshInterval(result.feed_refresh_interval);
      }
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

      // Flatten to get all URLs
      const allUrls = [];
      const seenDomains = new Set();

      const traverse = (nodes) => {
        for (const node of nodes) {
          if (node.url) {
            try {
              const domain = new URL(node.url).hostname;
              // Deduplicate by domain
              if (!seenDomains.has(domain)) {
                seenDomains.add(domain);
                allUrls.push({ url: node.url, title: node.title, domain });
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

      setLogs(prev => [...prev, `找到 ${allUrls.length} 个不同域名的书签`]);
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

      // Filter out already subscribed, ignored, and no-feed domains
      const skippedSubscribedDomains = [];
      const skippedIgnoredDomains = [];
      const skippedNoFeedDomains = [];
      const urlsToCheck = allUrls.filter(({ domain }) => {
        if (existingDomains.has(domain)) {
          skippedSubscribedDomains.push(domain);
          return false;
        }
        if (ignoredDomains.has(domain)) {
          skippedIgnoredDomains.push(domain);
          return false;
        }
        if (noFeedDomains.has(domain)) {
          skippedNoFeedDomains.push(domain);
          return false;
        }
        return true;
      });

      if (skippedSubscribedDomains.length > 0) {
        setLogs(prev => [...prev, `⏭ 跳过 ${skippedSubscribedDomains.length} 个已订阅的域名`]);
      }
      if (skippedIgnoredDomains.length > 0) {
        setLogs(prev => [...prev, `🚫 跳过 ${skippedIgnoredDomains.length} 个已删除的域名`]);
      }
      if (skippedNoFeedDomains.length > 0) {
        setLogs(prev => [...prev, `⚪ 跳过 ${skippedNoFeedDomains.length} 个无订阅的域名`]);
      }
      const skipped = skippedSubscribedDomains.length + skippedIgnoredDomains.length + skippedNoFeedDomains.length;

      setLogs(prev => [...prev, `🚀 开始并发检查 ${urlsToCheck.length} 个域名 (并发数: 10)`]);

      let discovered = 0;
      let processed = 0;
      const BATCH_SIZE = 10; // Concurrent batch size
      const newNoFeedDomains = []; // Collect domains with no feeds

      // Process in batches
      for (let i = 0; i < urlsToCheck.length; i += BATCH_SIZE) {
        const batch = urlsToCheck.slice(i, i + BATCH_SIZE);

        // Log current batch URLs being checked
        const batchDomains = batch.map(b => b.domain).join(', ');
        setLogs(prev => [...prev, `🔍 检查: ${batchDomains}`]);

        // Process batch concurrently
        const results = await Promise.allSettled(
          batch.map(async ({ url, title, domain }) => {
            try {
              const feed = await discoverFeed(url);
              return { url, title, domain, feed };
            } catch (e) {
              return { url, title, domain, feed: null, error: e };
            }
          })
        );

        // Process results
        for (const result of results) {
          processed++;

          if (result.status === 'fulfilled') {
            const { url, title, domain, feed } = result.value;

            if (feed) {
              // Create subscription
              const subscription = {
                id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
                url,
                title: title || domain,
                feedUrl: feed.feedUrl,
                feedType: feed.type,
                feedTitle: feed.title,
                items: [],
                readItems: [],
                lastChecked: null,
                createdAt: new Date().toISOString()
              };

              await saveSubscription(subscription);
              existingDomains.add(domain);
              discovered++;
              setLogs(prev => [...prev, `✓ 发现订阅: ${domain} (${feed.type})`]);

              // Update state
              setSubscriptions(prev => ({
                ...prev,
                [subscription.id]: subscription
              }));
            } else {
              // Save domain as no-feed
              newNoFeedDomains.push(domain);
              setLogs(prev => [...prev, `✗ 无订阅: ${domain}`]);
            }
          }
        }

        // Update progress after each batch
        setDiscoveryProgress({ current: Math.min(i + BATCH_SIZE, urlsToCheck.length) + skipped, total: allUrls.length });
        setLogs(prev => [...prev, `📊 进度: ${processed}/${urlsToCheck.length} 已检查`]);
      }

      // Save all no-feed domains at once
      if (newNoFeedDomains.length > 0) {
        await addNoFeedDomains(newNoFeedDomains);
        setLogs(prev => [...prev, `💾 已记录 ${newNoFeedDomains.length} 个无订阅域名，下次将跳过`]);
      }

      setLogs(prev => [...prev, `\n✅ 完成！发现 ${discovered} 个新订阅，跳过 ${skipped} 个域名`]);
    } catch (e) {
      console.error('Discovery error:', e);
      setLogs(prev => [...prev, `✗ 错误: ${e.message}`]);
    } finally {
      setDiscovering(false);
      setDiscoveryProgress({ current: 0, total: 0 });
    }
  };

  const handleRefresh = async (subId) => {
    setRefreshing(subId);
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

      // Notify if enabled and has new items
      if (notifyEnabled && newItems.length > 0) {
        if (typeof chrome !== 'undefined' && chrome.notifications) {
          chrome.notifications.create('markpilot-feed-' + Date.now(), {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icon48.png'),
            title: `${updated.title} 有更新`,
            message: `发现 ${newItems.length} 条新内容`,
            priority: 2
          });
        }
      }

      return newItems.length;
    } catch (e) {
      console.error('Refresh failed:', e);
      return 0;
    } finally {
      setRefreshing(null);
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

  const handleGenerateBriefing = async (autoNotify = false) => {
    // Get unread items
    const allItems = Object.values(subscriptions)
      .flatMap(sub => {
        const readSet = new Set(sub.readItems || []);
        return sub.items
          .filter(item => !readSet.has(item.link))
          .slice(0, 10)
          .map(item => ({
            source: sub.title,
            ...item
          }));
      });

    if (allItems.length === 0) {
      if (!autoNotify) {
        alert('没有未读内容');
      }
      return;
    }

    setGenerating(true);
    setLogs([]);
    setBriefing('');

    try {
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

      setLogs(prev => [...prev, `正在分析 ${allItems.length} 条未读内容...`]);

      const contentForAI = allItems.map(item =>
        `[${item.source}] ${item.title}\n${item.description || ''}`
      ).join('\n\n').slice(0, 8000);

      const { generateBriefing } = await import('../services/aiService');
      const brief = await generateBriefing(contentForAI, settings, (msg) => {
        setLogs(prev => [...prev, msg]);
      });

      setBriefing(brief);

      // Save briefing
      await chrome.storage.local.set({ saved_briefing: brief });

      // Mark items as read
      const updatedSubs = { ...subscriptions };
      for (const sub of Object.values(updatedSubs)) {
        const readSet = new Set(sub.readItems || []);
        sub.items.slice(0, 10).forEach(item => readSet.add(item.link));
        sub.readItems = Array.from(readSet).slice(-500); // Keep last 500
        await saveSubscription(sub);
      }
      setSubscriptions(updatedSubs);

      // Notify
      if (autoNotify && typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create('markpilot-briefing-' + Date.now(), {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon48.png'),
          title: 'AI 简报已生成',
          message: `已分析 ${allItems.length} 条新内容，点击查看简报`,
          priority: 2
        });
      }

      setLogs(prev => [...prev, '✓ 简报生成完成']);
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

  return (
    <div className="min-h-screen bg-vscode-bg text-vscode-text">
      {/* Title Bar */}
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
            disabled={loading || refreshing || discovering}
            className="flex items-center gap-2 px-3 py-1.5 bg-vscode-hover hover:bg-vscode-active text-[13px] rounded disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>刷新全部</span>
          </button>

          <button
            onClick={() => handleGenerateBriefing(false)}
            disabled={generating || subscriptionList.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-vscode-blue hover:bg-vscode-blue-light text-white text-[13px] rounded disabled:opacity-50"
          >
            <Sparkles size={14} />
            <span>{generating ? '生成中...' : `AI 简报 (${unreadCount})`}</span>
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
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.notifications) {
                  chrome.notifications.create('markpilot-test-' + Date.now(), {
                    type: 'basic',
                    iconUrl: chrome.runtime.getURL('icon48.png'),
                    title: 'MarkPilot 通知测试',
                    message: '如果您看到此消息，说明通知功能正常工作！点击可打开订阅页面。',
                    priority: 2
                  }, (id) => {
                    if (chrome.runtime.lastError) {
                      alert('通知发送失败: ' + chrome.runtime.lastError.message);
                    } else {
                      console.log('Test notification created:', id);
                    }
                  });
                } else {
                  alert('通知 API 不可用');
                }
              }}
              className="text-[12px] text-vscode-blue hover:text-vscode-blue-light"
            >
              测试通知
            </button>
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
                const noFeedDomains = await getNoFeedDomains();
                if (noFeedDomains.size === 0) {
                  alert('没有缓存的无订阅域名');
                  return;
                }
                if (confirm(`确定要清除 ${noFeedDomains.size} 个无订阅域名的缓存吗？这将允许重新检查这些域名。`)) {
                  await clearNoFeedDomains();
                  alert('已清除无订阅缓存');
                }
              }}
              className="text-[12px] text-vscode-text-muted hover:text-vscode-orange"
            >
              清除无订阅缓存
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
      <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)]">
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
                  isRefreshing={refreshing === sub.id}
                  onRefresh={() => handleRefresh(sub.id)}
                  onDelete={() => handleDelete(sub.id)}
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
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] bg-vscode-blue/20 text-vscode-blue rounded">
                  {unreadCount} 未读
                </span>
              )}
            </div>
            {briefingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {briefingExpanded && (
            <div className="flex-1 overflow-y-auto">
              {briefing ? (
                <div className="p-4 text-[13px] leading-relaxed whitespace-pre-wrap">
                  {briefing}
                </div>
              ) : (
                <div className="p-4 text-[13px] text-vscode-text-muted">
                  {subscriptionList.length === 0
                    ? '先添加订阅，然后生成简报'
                    : unreadCount > 0
                      ? `有 ${unreadCount} 条未读内容，点击"AI 简报"生成摘要`
                      : '暂无未读内容'
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
