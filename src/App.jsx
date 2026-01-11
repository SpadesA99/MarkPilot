import React, { useState, useEffect, useRef } from 'react';
import { Search, Settings, Sparkles, Rss, Bookmark } from 'lucide-react';
import BookmarkGrid from './components/BookmarkGrid';
import SettingsPanel from './components/SettingsPanel';
import ContextMenu from './components/ContextMenu';
import Feed from './feed/Feed';
import { getBookmarksTree, deleteBookmark, createBookmark, searchBookmarks, moveBookmark, trackClick, flattenBookmarks, clearAllBookmarks, rebuildTree } from './services/bookmarkService';

function App() {
  const [bookmarks, setBookmarks] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sortMode] = useState('frequency'); // Always sort by click count
  const [currentView, setCurrentView] = useState('bookmarks'); // 'bookmarks' | 'feed'
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [processingLogs, setProcessingLogs] = useState([]);
  const [clickStats, setClickStats] = useState({});
  const [totalBookmarkCount, setTotalBookmarkCount] = useState(0);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, target? }
  const [pinnedFolders, setPinnedFolders] = useState([]); // Array of pinned folder IDs
  const logContainerRef = useRef(null);

  // Auto scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [processingLogs]);



  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['click_stats', 'pinned_folders']);
        if (result.click_stats) setClickStats(result.click_stats);
        if (result.pinned_folders) setPinnedFolders(result.pinned_folders);
      }
    };
    loadSettings();
  }, []);

  // Refresh stats when bookmarks change (optional, but good for sync)
  useEffect(() => {
    // We already loaded stats on mount, but if we want to keep them fresh:
    // getClickStats().then(setClickStats);
    // Actually, let's just keep the initial load for now to avoid loops, 
    // or only update when we track clicks.
  }, [bookmarks]);

  const sortedBookmarks = React.useMemo(() => {
    let items = [...bookmarks];
    // Always folders first
    items.sort((a, b) => {
      if (!a.url && b.url) return -1;
      if (a.url && !b.url) return 1;
      return 0;
    });

    if (sortMode === 'frequency') {
      // Helper to get click count for a node (recursive for folders)
      const getClicks = (node) => {
        if (node.url) return clickStats[node.url] || 0;
        if (node.children) {
          return node.children.reduce((sum, child) => sum + getClicks(child), 0);
        }
        return 0;
      };

      items.sort((a, b) => {
        const isFolderA = !a.url;
        const isFolderB = !b.url;

        // Pinned folders always first
        if (isFolderA && isFolderB) {
          const isPinnedA = pinnedFolders.includes(a.id);
          const isPinnedB = pinnedFolders.includes(b.id);
          if (isPinnedA && !isPinnedB) return -1;
          if (!isPinnedA && isPinnedB) return 1;
        }

        // If both are folders or both are files, sort by clicks
        if (isFolderA === isFolderB) {
          return getClicks(b) - getClicks(a);
        }
        // Otherwise maintain folder-first order (already sorted above)
        return 0;
      });
    }
    return items;
  }, [bookmarks, sortMode, clickStats, pinnedFolders]);

  // Initial Load
  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const tree = await getBookmarksTree();
      // Default to Bookmarks Bar (usually id '1') or root
      const bar = tree.find(n => n.id === '1') || tree[0];

      // Calculate total bookmark count (only URLs, not folders)
      const countBookmarks = (nodes) => {
        let count = 0;
        for (const node of nodes) {
          if (node.url) count++;
          if (node.children) count += countBookmarks(node.children);
        }
        return count;
      };
      setTotalBookmarkCount(countBookmarks(tree));

      navigateTo(bar);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (folder) => {
    setCurrentFolder(folder);
    setBookmarks(folder.children || []);
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query) {
      if (currentFolder) navigateTo(currentFolder);
      return;
    }
    const results = await searchBookmarks(query);
    setBookmarks(results);
  };

  const handleDelete = async (item) => {
    if (confirm(`确定要删除 "${item.title}" 吗?`)) {
      await deleteBookmark(item.id, !item.url);
      // Refresh
      if (currentFolder) {
        // We need to reload the tree to get fresh data
        // This is a bit inefficient but safe
        const tree = await getBookmarksTree();
        // Find current folder in new tree
        // Helper to find node
        const findNode = (nodes, id) => {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
              const found = findNode(node.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const newFolder = findNode(tree, currentFolder.id);
        if (newFolder) {
          setCurrentFolder(newFolder);
          setBookmarks(newFolder.children || []);
        } else {
          loadBookmarks(); // Fallback
        }
      }
    }
  };

  const handleOpen = async (item) => {
    await trackClick(item.url);
    // Update local click stats
    setClickStats(prev => ({
      ...prev,
      [item.url]: (prev[item.url] || 0) + 1
    }));
    window.open(item.url, '_blank');
  };

  // Handle moving bookmark to another folder
  const handleMoveBookmark = async (bookmarkId, targetFolderId) => {
    console.log('handleMoveBookmark called:', bookmarkId, targetFolderId);
    try {
      // Handle virtual "uncategorized" folder - move to root instead
      const actualTargetId = targetFolderId === 'uncategorized' ? currentFolder.id : targetFolderId;
      console.log('Moving to actual target:', actualTargetId);
      await moveBookmark(bookmarkId, actualTargetId);
      console.log('Move completed successfully');
      // Refresh
      const tree = await getBookmarksTree();
      const findNode = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const newFolder = findNode(tree, currentFolder.id);
      if (newFolder) {
        setCurrentFolder(newFolder);
        setBookmarks(newFolder.children || []);
      } else {
        loadBookmarks();
      }
    } catch (e) {
      console.error('Move failed:', e);
    }
  };

  // Handle creating new folder via context menu
  const handleCreateFolder = async () => {
    const name = prompt('请输入文件夹名称:');
    if (!name || !name.trim()) return;

    try {
      await createBookmark({
        parentId: currentFolder.id,
        title: name.trim()
      });
      // Refresh
      const tree = await getBookmarksTree();
      const findNode = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const newFolder = findNode(tree, currentFolder.id);
      if (newFolder) {
        setCurrentFolder(newFolder);
        setBookmarks(newFolder.children || []);
      } else {
        loadBookmarks();
      }
    } catch (e) {
      console.error('Create folder failed:', e);
      alert('创建文件夹失败: ' + e.message);
    }
  };

  // Handle pin/unpin folder
  const handlePinFolder = async (folderId) => {
    const newPinned = pinnedFolders.includes(folderId)
      ? pinnedFolders.filter(id => id !== folderId)
      : [...pinnedFolders, folderId];
    setPinnedFolders(newPinned);
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ pinned_folders: newPinned });
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (e, target = null) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  };

  const handleImport = async (content, type, useAiReorg) => {
    setIsSettingsOpen(false); // Close settings panel when import starts
    setLoading(true);
    setProcessingLogs([]); // Clear logs
    try {
      let importedBookmarks = [];

      // 1. Parse Imported Content
      if (type === 'json') {
        const json = JSON.parse(content);
        importedBookmarks = json.map(item => ({ title: item.title, url: item.url, id: 'imported_' + Date.now() + Math.random() }));
      } else if (type === 'backup') {
        // Confirm before restore since it will clear all existing data
        if (!confirm('警告：恢复备份将清除所有现有书签、设置和统计数据，并替换为备份中的数据。是否继续？')) {
          setLoading(false);
          return;
        }
        const { importData } = await import('./services/bookmarkService');
        await importData(content);
        alert('恢复成功！页面将刷新。');
        window.location.reload();
        return;
      } else if (type === 'export') {
        // ... existing export logic ...
        const { exportData } = await import('./services/bookmarkService');
        const json = await exportData();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmark_manager_backup_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setLoading(false);
        return;
      }

      // 2. Perform Import (Standard or AI)
      if (useAiReorg) {
        if (!confirm('警告：此操作将删除所有现有文件夹结构，并使用 AI 重新分类整理所有书签（包括新导入的）。是否继续？')) {
          setLoading(false);
          return;
        }

        // A. Import first (to merge everything)
        if (type === 'json') {
          for (const item of importedBookmarks) {
            await createBookmark({ parentId: currentFolder.id, title: item.title, url: item.url });
          }
        } else if (type === 'html') {
          const { importHtmlBookmarks } = await import('./services/bookmarkService');
          await importHtmlBookmarks(content, currentFolder.id);
        }

        // B. Get Full Tree
        const fullTree = await getBookmarksTree();

        // C. Flatten
        const allBookmarks = await flattenBookmarks(fullTree);

        if (allBookmarks.length === 0) {
          alert('没有找到书签');
          setLoading(false);
          return;
        }

        // D. Categorize
        // Get AI Settings
        const result = await chrome.storage.local.get(['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url', 'openai_api_key']);
        const settings = {
          provider: result.ai_provider || 'openai',
          apiKey: result.ai_api_key || result.openai_api_key,
          model: result.ai_model,
          baseUrl: result.ai_base_url
        };

        if (!settings.apiKey) {
          alert('请先配置 AI API Key');
          setIsSettingsOpen(true);
          setLoading(false);
          return;
        }

        const { categorizeBookmarks } = await import('./services/aiService');

        // Clear logs before starting
        setProcessingLogs([]);

        // Progress callback with log support
        const onProgress = (msg, logItems) => {
          if (msg) setLoadingMessage(msg);
          if (logItems && logItems.length > 0) {
            setProcessingLogs(prev => [...prev, ...logItems].slice(-200)); // Keep last 200 logs
          }
        };

        const categories = await categorizeBookmarks(allBookmarks, settings, onProgress);

        // E. Clear & Rebuild
        // Clear ALL bookmark locations (Bar, Other, Mobile, etc.)
        const allRootIds = fullTree.map(node => node.id);
        await clearAllBookmarks(allRootIds);

        // Rebuild into Bookmarks Bar (usually id '1')
        const targetRootId = fullTree[0]?.id || '1';
        await rebuildTree(categories, allBookmarks, targetRootId);

        alert('AI 整理完成！');
        window.location.reload();

      } else {
        // Standard Import
        if (type === 'json') {
          for (const item of importedBookmarks) {
            await createBookmark({
              parentId: currentFolder.id,
              title: item.title,
              url: item.url
            });
          }
        } else if (type === 'html') {
          const { importHtmlBookmarks } = await import('./services/bookmarkService');
          await importHtmlBookmarks(content, currentFolder.id);
        }

        // Refresh
        const tree = await getBookmarksTree();
        const findNode = (nodes, id) => {
          for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children) {
              const found = findNode(node.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const newFolder = findNode(tree, currentFolder.id);
        if (newFolder) {
          setCurrentFolder(newFolder);
          setBookmarks(newFolder.children || []);
        } else {
          loadBookmarks();
        }
      }

    } catch (e) {
      console.error(e);
      alert('导入/整理失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCategorize = async () => {
    setLoading(true);
    setProcessingLogs([]);
    try {
      // Get AI Settings
      const result = await chrome.storage.local.get(['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url', 'openai_api_key']);

      const settings = {
        provider: result.ai_provider || 'openai',
        apiKey: result.ai_api_key || result.openai_api_key,
        model: result.ai_model,
        baseUrl: result.ai_base_url
      };

      if (!settings.apiKey) {
        alert('请先在设置中配置 AI API Key');
        setIsSettingsOpen(true);
        setLoading(false);
        return;
      }

      // Get current folder's bookmarks
      // We only categorize the current view to be safe
      const itemsToCategorize = bookmarks.filter(b => b.url); // Only files

      if (itemsToCategorize.length === 0) {
        alert('当前文件夹没有可分类的书签');
        setLoading(false);
        return;
      }

      const { categorizeBookmarks, generateTitles } = await import('./services/aiService');
      const { updateBookmarkTitle } = await import('./services/bookmarkService');

      // Progress callback with log support
      const onProgress = (msg, logItems) => {
        if (msg) setLoadingMessage(msg);
        if (logItems && logItems.length > 0) {
          setProcessingLogs(prev => [...prev, ...logItems].slice(-200));
        }
      };

      // Fix empty titles first
      const emptyTitleItems = itemsToCategorize.filter(b => !b.title);
      if (emptyTitleItems.length > 0) {
        onProgress(`发现 ${emptyTitleItems.length} 个无标题书签，正在生成标题...`);
        const titles = await generateTitles(emptyTitleItems, settings, onProgress);
        for (const [id, title] of Object.entries(titles)) {
          try {
            await updateBookmarkTitle(id, title);
            // Update local data
            const item = itemsToCategorize.find(b => b.id === id);
            if (item) item.title = title;
          } catch (e) {
            console.warn('Failed to update title:', id, e);
          }
        }
      }

      const categories = await categorizeBookmarks(itemsToCategorize, settings, onProgress);

      // Process results
      // categories: { "id": "Category" }

      // 1. Create folders if needed
      // We need to know existing folders in current view
      const existingFolders = bookmarks.filter(b => !b.url);
      const folderMap = {}; // "CategoryName" -> folderId

      existingFolders.forEach(f => folderMap[f.title] = f.id);

      for (const [id, category] of Object.entries(categories)) {
        let folderId = folderMap[category];

        // Create folder if not exists
        if (!folderId) {
          const newFolder = await createBookmark({
            parentId: currentFolder.id,
            title: category
          });
          folderId = newFolder.id;
          folderMap[category] = folderId;
        }

        // Move bookmark
        await moveBookmark(id, folderId);
      }

      // Delete empty folders after reorganization
      for (const existingFolder of existingFolders) {
        try {
          const updatedFolder = await chrome.bookmarks.getSubTree(existingFolder.id);
          if (updatedFolder[0] && (!updatedFolder[0].children || updatedFolder[0].children.length === 0)) {
            await deleteBookmark(existingFolder.id, true);
          }
        } catch (e) {
          console.warn('Could not check/delete empty folder:', e);
        }
      }

      alert('整理完成！');
      // Refresh
      const tree = await getBookmarksTree();
      const findNode = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const newFolder = findNode(tree, currentFolder.id);
      if (newFolder) {
        setCurrentFolder(newFolder);
        setBookmarks(newFolder.children || []);
      } else {
        loadBookmarks();
      }

    } catch (e) {
      console.error(e);
      alert('分类失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiReorganizeFolder = async (folder) => {
    // Re-categorize items in a specific folder (e.g., "未分类")
    if (!folder.children || folder.children.length === 0) {
      alert('该文件夹为空');
      return;
    }

    setLoading(true);
    setProcessingLogs([]);
    try {
      // Get AI Settings
      const result = await chrome.storage.local.get(['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url', 'openai_api_key']);

      const settings = {
        provider: result.ai_provider || 'openai',
        apiKey: result.ai_api_key || result.openai_api_key,
        model: result.ai_model,
        baseUrl: result.ai_base_url
      };

      if (!settings.apiKey) {
        alert('请先在设置中配置 AI API Key');
        setIsSettingsOpen(true);
        setLoading(false);
        return;
      }

      // Get bookmarks from the folder
      const itemsToCategorize = folder.children.filter(b => b.url);

      if (itemsToCategorize.length === 0) {
        alert('该文件夹没有可分类的书签');
        setLoading(false);
        return;
      }

      const { categorizeBookmarks, generateTitles } = await import('./services/aiService');
      const { updateBookmarkTitle } = await import('./services/bookmarkService');

      // Progress callback with log support
      const onProgress = (msg, logItems) => {
        if (msg) setLoadingMessage(msg);
        if (logItems && logItems.length > 0) {
          setProcessingLogs(prev => [...prev, ...logItems].slice(-200));
        }
      };

      // Fix empty titles first
      const emptyTitleItems = itemsToCategorize.filter(b => !b.title);
      if (emptyTitleItems.length > 0) {
        onProgress(`发现 ${emptyTitleItems.length} 个无标题书签，正在生成标题...`);
        const titles = await generateTitles(emptyTitleItems, settings, onProgress);
        for (const [id, title] of Object.entries(titles)) {
          try {
            await updateBookmarkTitle(id, title);
            const item = itemsToCategorize.find(b => b.id === id);
            if (item) item.title = title;
          } catch (e) {
            console.warn('Failed to update title:', id, e);
          }
        }
      }

      const categories = await categorizeBookmarks(itemsToCategorize, settings, onProgress);

      // Get existing folders in current view
      const existingFolders = bookmarks.filter(b => !b.url);
      const folderMap = {}; // "CategoryName" -> folderId

      existingFolders.forEach(f => folderMap[f.title] = f.id);

      for (const [id, category] of Object.entries(categories)) {
        let folderId = folderMap[category];

        // Create folder if not exists
        if (!folderId) {
          const newFolder = await createBookmark({
            parentId: currentFolder.id,
            title: category
          });
          folderId = newFolder.id;
          folderMap[category] = folderId;
        }

        // Move bookmark
        await moveBookmark(id, folderId);
      }

      // Delete source folder if it's now empty (for real folders, not virtual "uncategorized")
      if (folder.id !== 'uncategorized') {
        try {
          // Refresh folder to check if empty
          const updatedFolder = await chrome.bookmarks.getSubTree(folder.id);
          if (updatedFolder[0] && (!updatedFolder[0].children || updatedFolder[0].children.length === 0)) {
            await deleteBookmark(folder.id, true);
          }
        } catch (e) {
          console.warn('Could not check/delete empty folder:', e);
        }
      }

      alert('重新分类完成！');

      // Refresh
      const tree = await getBookmarksTree();
      const findNode = (nodes, id) => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.children) {
            const found = findNode(node.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      const newFolder = findNode(tree, currentFolder.id);
      if (newFolder) {
        setCurrentFolder(newFolder);
        setBookmarks(newFolder.children || []);
      } else {
        loadBookmarks();
      }

    } catch (e) {
      console.error(e);
      alert('重新分类失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vscode-bg text-vscode-text">
      <div className="flex flex-col h-screen">
        {/* VS Code Toolbar */}
        <header className="bg-vscode-sidebar border-b border-vscode-border px-3 py-2 flex items-center justify-between gap-4">
          {/* Search - VS Code Command Palette style - only show in bookmarks view */}
          {currentView === 'bookmarks' ? (
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-vscode-text-muted w-4 h-4" />
              <input
                type="text"
                placeholder="搜索书签... (Ctrl+P)"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-vscode-bg border border-vscode-border rounded text-[13px] text-vscode-text placeholder-vscode-text-muted focus:border-vscode-blue focus:outline-none"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[13px] text-vscode-text-muted">
              <Rss size={14} className="text-vscode-orange" />
              <span className="text-vscode-text font-medium">RSS 订阅管理</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            {currentView === 'bookmarks' ? (
              <>
                <button
                  onClick={handleAutoCategorize}
                  className="flex items-center gap-2 px-3 py-1.5 bg-vscode-blue hover:bg-vscode-blue-light text-white text-[13px] rounded"
                >
                  <Sparkles size={14} />
                  <span>智能整理</span>
                </button>
                <button
                  onClick={() => setCurrentView('feed')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-vscode-orange hover:opacity-90 text-white text-[13px] rounded"
                  title="RSS 订阅管理"
                >
                  <Rss size={14} />
                  <span>订阅</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setCurrentView('bookmarks')}
                className="flex items-center gap-2 px-3 py-1.5 bg-vscode-green hover:opacity-90 text-white text-[13px] rounded"
                title="返回书签"
              >
                <Bookmark size={14} />
                <span>书签</span>
              </button>
            )}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-hover rounded"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Stats bar - only show in bookmarks view */}
        {currentView === 'bookmarks' && !searchQuery && (
          <nav className="bg-vscode-bg border-b border-vscode-border px-3 py-1 flex items-center justify-end">
            <div className="flex items-center gap-3 text-[12px] text-vscode-text-muted">
              <span>{sortedBookmarks.length} 项</span>
              <span className="text-vscode-green">{totalBookmarkCount} 总书签</span>
            </div>
          </nav>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {currentView === 'feed' ? (
            <Feed embedded={true} />
          ) : loading ? (
            <div className="fixed inset-0 bg-vscode-bg/95 flex items-center justify-center z-50">
              <div className="w-full max-w-2xl mx-4">
                <div className="text-center mb-6">
                  {/* VS Code style loader */}
                  <div className="relative w-12 h-12 mx-auto mb-4">
                    <div className="absolute inset-0 border-2 border-vscode-border rounded-full"></div>
                    <div className="absolute inset-0 border-2 border-transparent border-t-vscode-blue rounded-full animate-spin"></div>
                  </div>
                  <p className="text-vscode-text text-[14px]">{loadingMessage || '加载中...'}</p>
                </div>
                {processingLogs.length > 0 && (
                  <div className="bg-vscode-sidebar border border-vscode-border rounded">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-vscode-border text-[12px]">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vscode-green opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-vscode-green"></span>
                      </span>
                      <span className="text-vscode-text-muted">OUTPUT</span>
                    </div>
                    <div ref={logContainerRef} className="h-56 overflow-y-auto font-mono text-[12px] p-2">
                      {processingLogs.map((log, index) => (
                        <div
                          key={index}
                          className={`${index === processingLogs.length - 1 ? 'text-vscode-green' : 'text-vscode-text-muted'} truncate py-0.5`}
                        >
                          <span className="text-vscode-text-muted mr-2 select-none">[{String(index + 1).padStart(4, '0')}]</span>
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4" onContextMenu={handleContextMenu}>
              <BookmarkGrid
                items={sortedBookmarks}
                onDelete={handleDelete}
                onOpen={handleOpen}
                clickStats={clickStats}
                onAiReorganize={handleAiReorganizeFolder}
                onMoveBookmark={handleMoveBookmark}
                onContextMenu={handleContextMenu}
                pinnedFolders={pinnedFolders}
                onPinFolder={handlePinFolder}
              />
            </div>
          )}
        </div>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onImport={handleImport}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDelete}
          onPinFolder={handlePinFolder}
          pinnedFolders={pinnedFolders}
        />
      )}
    </div>
  );
}

export default App;
