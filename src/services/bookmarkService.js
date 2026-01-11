// Chrome Extension Bookmark Service

export const getBookmarksTree = async () => {
    const tree = await chrome.bookmarks.getTree();
    return tree[0].children; // Root -> [Bar, Other, Mobile]
};

export const deleteBookmark = async (id, isFolder) => {
    if (isFolder) {
        await chrome.bookmarks.removeTree(id);
    } else {
        await chrome.bookmarks.remove(id);
    }
};

export const createBookmark = async (bookmark) => {
    return await chrome.bookmarks.create(bookmark);
};

export const searchBookmarks = async (query) => {
    return await chrome.bookmarks.search(query);
};

export const trackClick = async (url) => {
    const result = await chrome.storage.local.get(['click_stats']);
    const stats = result.click_stats || {};
    stats[url] = (stats[url] || 0) + 1;
    await chrome.storage.local.set({ click_stats: stats });
};

export const getClickStats = async () => {
    const result = await chrome.storage.local.get(['click_stats']);
    return result.click_stats || {};
};

export const moveBookmark = async (id, destinationId) => {
    return await chrome.bookmarks.move(id, { parentId: destinationId });
};

// Fetch page title from URL
export const fetchPageTitle = async (url) => {
    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        }).catch(() => null);

        if (response && response.ok) {
            const html = await response.text();
            const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        // Fallback to hostname
        return new URL(url).hostname;
    } catch (e) {
        console.warn('Failed to fetch title for:', url, e);
        return new URL(url).hostname;
    }
};

// Update bookmark title
export const updateBookmarkTitle = async (id, title) => {
    return await chrome.bookmarks.update(id, { title });
};

// Fix empty titles for bookmarks (batch)
export const fixEmptyTitles = async (bookmarks, onProgress) => {
    const emptyTitleBookmarks = bookmarks.filter(b => b.url && !b.title);

    if (emptyTitleBookmarks.length === 0) return 0;

    let fixed = 0;
    for (let i = 0; i < emptyTitleBookmarks.length; i++) {
        const bookmark = emptyTitleBookmarks[i];
        try {
            if (onProgress) {
                onProgress(`正在获取标题 ${i + 1}/${emptyTitleBookmarks.length}: ${bookmark.url}`);
            }

            const title = await fetchPageTitle(bookmark.url);
            if (title && title !== new URL(bookmark.url).hostname) {
                await updateBookmarkTitle(bookmark.id, title);
                fixed++;
            } else {
                // Use hostname as fallback title
                await updateBookmarkTitle(bookmark.id, new URL(bookmark.url).hostname);
                fixed++;
            }
        } catch (e) {
            console.warn('Failed to fix title for:', bookmark.url, e);
        }
    }

    return fixed;
};



// Helper to parse Netscape Bookmark HTML
const parseNetscapeHTML = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // In Netscape bookmark format, structure is:
    // <DL>
    //   <DT><H3>Folder Name</H3>
    //   <DL>...children...</DL>  <- DL is sibling of DT, not child!
    //   <DT><A>Bookmark</A>
    // </DL>

    const parseNode = (dl) => {
        const items = [];
        const children = Array.from(dl.children);

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.tagName !== 'DT') continue;

            const h3 = child.querySelector('h3');
            const a = child.querySelector('a');

            if (h3) {
                // Folder - look for the next sibling DL
                let subDl = null;
                // Check next siblings for DL
                for (let j = i + 1; j < children.length; j++) {
                    if (children[j].tagName === 'DL') {
                        subDl = children[j];
                        break;
                    }
                    // Stop if we hit another DT
                    if (children[j].tagName === 'DT') break;
                }

                items.push({
                    title: h3.textContent.trim(),
                    children: subDl ? parseNode(subDl) : []
                });
            } else if (a) {
                // Bookmark
                items.push({
                    title: a.textContent.trim(),
                    url: a.href
                });
            }
        }
        return items;
    };

    // Start from the main DL
    const rootDl = doc.querySelector('dl');
    if (rootDl) {
        return parseNode(rootDl);
    }
    return [];
};

export const importHtmlBookmarks = async (htmlContent, parentId) => {
    const tree = parseNetscapeHTML(htmlContent);

    const createRecursive = async (items, pid) => {
        for (const item of items) {
            if (item.children) {
                // Folder
                const folder = await createBookmark({
                    parentId: pid,
                    title: item.title
                });
                if (folder) {
                    await createRecursive(item.children, folder.id);
                }
            } else {
                // Bookmark
                await createBookmark({
                    parentId: pid,
                    title: item.title,
                    url: item.url
                });
            }
        }
    };

    await createRecursive(tree, parentId);
};

export const exportData = async () => {
    const tree = await getBookmarksTree();
    const stats = await getClickStats();
    const settings = await chrome.storage.local.get(null);

    const data = {
        type: 'backup',
        timestamp: Date.now(),
        bookmarks: tree,
        stats: stats,
        settings: settings
    };
    return JSON.stringify(data, null, 2);
};

export const importData = async (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        if (data.type !== 'backup') {
            throw new Error('Invalid backup file format');
        }

        // Validate backup data
        if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
            throw new Error('Invalid backup: missing bookmarks data');
        }

        // Get current tree to find root folder ids
        const currentTree = await getBookmarksTree();
        const rootIds = currentTree.map(f => f.id);

        // Clear all existing bookmarks first
        await clearAllBookmarks(rootIds);

        // Clear all existing storage data
        await chrome.storage.local.clear();

        // Restore settings (includes click_stats if present)
        if (data.settings) {
            await chrome.storage.local.set(data.settings);
        }

        // Restore stats (for backward compatibility with older backups that stored stats separately)
        if (data.stats && !data.settings?.click_stats) {
            await chrome.storage.local.set({ click_stats: data.stats });
        }

        // Restore bookmarks to their original locations
        const createRecursive = async (nodes, pid) => {
            for (const node of nodes) {
                if (node.children) {
                    const folder = await chrome.bookmarks.create({
                        parentId: pid,
                        title: node.title
                    });
                    await createRecursive(node.children, folder.id);
                } else if (node.url) {
                    await chrome.bookmarks.create({
                        parentId: pid,
                        title: node.title,
                        url: node.url
                    });
                }
            }
        };

        // For each top-level folder in backup, find matching folder in current tree and restore contents
        for (const backupFolder of data.bookmarks) {
            // Find matching folder by id or title
            const targetFolder = currentTree.find(f => f.id === backupFolder.id || f.title === backupFolder.title);

            if (targetFolder && backupFolder.children) {
                // Restore children into the matching folder
                await createRecursive(backupFolder.children, targetFolder.id);
            }
        }

        return true;
    } catch (e) {
        console.error('Import failed', e);
        throw e;
    }
};
export const flattenBookmarks = async (tree) => {
    const bookmarks = [];
    const seenUrls = new Set(); // Track URLs to prevent duplicates

    const traverse = (nodes) => {
        for (const node of nodes) {
            if (node.url) {
                // Only add if we haven't seen this URL before
                if (!seenUrls.has(node.url)) {
                    seenUrls.add(node.url);
                    bookmarks.push({
                        title: node.title,
                        url: node.url,
                        id: node.id
                    });
                }
            }
            if (node.children) {
                traverse(node.children);
            }
        }
    };
    traverse(tree);
    return bookmarks;
};

export const clearAllBookmarks = async (rootIds) => {
    const ids = Array.isArray(rootIds) ? rootIds : [rootIds];

    for (const rootId of ids) {
        try {
            const tree = await chrome.bookmarks.getSubTree(rootId);
            if (tree[0] && tree[0].children) {
                for (const child of tree[0].children) {
                    try {
                        await chrome.bookmarks.removeTree(child.id);
                    } catch (e) {
                        console.warn('Failed to remove:', child.id, e);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to get subtree for:', rootId, e);
        }
    }
};

export const rebuildTree = async (categories, bookmarks, rootId) => {
    // Deduplicate bookmarks by URL before processing
    const seenUrls = new Set();
    const uniqueBookmarks = bookmarks.filter(b => {
        if (seenUrls.has(b.url)) {
            return false;
        }
        seenUrls.add(b.url);
        return true;
    });

    console.log(`Rebuilding ${uniqueBookmarks.length} unique bookmarks (filtered from ${bookmarks.length})`);

    // 1. Create Category Folders
    const categoryMap = {}; // Name -> ID
    for (const category of new Set(Object.values(categories))) {
        const folder = await chrome.bookmarks.create({
            parentId: rootId,
            title: category
        });
        categoryMap[category] = folder.id;
    }

    // 2. Create "Uncategorized" folder if needed
    let uncategorizedId = null;

    // 3. Create Bookmarks (deduplicated)
    for (const bookmark of uniqueBookmarks) {
        const category = categories[bookmark.id];
        let parentId = rootId;

        if (category && categoryMap[category]) {
            parentId = categoryMap[category];
        } else {
            if (!uncategorizedId) {
                const folder = await chrome.bookmarks.create({
                    parentId: rootId,
                    title: '未分类'
                });
                uncategorizedId = folder.id;
                categoryMap['未分类'] = folder.id;
            }
            parentId = uncategorizedId;
        }

        await chrome.bookmarks.create({
            parentId: parentId,
            title: bookmark.title,
            url: bookmark.url
        });
    }
};
