import React from 'react';
import Masonry from 'react-masonry-css';
import FolderGroup from './FolderGroup';
import { Folder } from 'lucide-react';

const BookmarkGrid = ({ items, onDelete, onOpen, clickStats, onAiReorganize, onMoveBookmark, onContextMenu, pinnedFolders = [], onPinFolder }) => {
    // Helper to get total clicks for a folder (recursive)
    const getTotalClicks = (node) => {
        if (node.url) return clickStats?.[node.url] || 0;
        if (node.children) {
            return node.children.reduce((sum, child) => sum + getTotalClicks(child), 0);
        }
        return 0;
    };

    // Separate folders and loose bookmarks
    const folders = items.filter(item => !item.url);
    const looseBookmarks = items.filter(item => item.url);

    // If we have loose bookmarks, treat them as a "Uncategorized" group
    const allGroups = [...folders];
    if (looseBookmarks.length > 0) {
        allGroups.push({
            id: 'uncategorized',
            title: '未分类',
            children: looseBookmarks
        });
    }

    // Sort folders: pinned first, then by click count
    allGroups.sort((a, b) => {
        const isPinnedA = pinnedFolders.includes(a.id);
        const isPinnedB = pinnedFolders.includes(b.id);
        if (isPinnedA && !isPinnedB) return -1;
        if (!isPinnedA && isPinnedB) return 1;
        return getTotalClicks(b) - getTotalClicks(a);
    });

    if (allGroups.length === 0) {
        return (
            <div className="text-center py-20 text-gray-400">
                <Folder className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>此文件夹为空</p>
            </div>
        );
    }

    const breakpointColumns = {
        default: 4,
        1280: 3,
        1024: 2,
        640: 1
    };

    return (
        <Masonry
            breakpointCols={breakpointColumns}
            className="flex -ml-3 w-auto"
            columnClassName="pl-3 bg-clip-padding"
        >
            {allGroups.map(group => (
                <FolderGroup
                    key={group.id}
                    folder={group}
                    onDelete={onDelete}
                    onOpen={onOpen}
                    clickStats={clickStats}
                    onAiReorganize={onAiReorganize}
                    onMoveBookmark={onMoveBookmark}
                    onContextMenu={onContextMenu}
                    isPinned={pinnedFolders.includes(group.id)}
                    onPinFolder={onPinFolder}
                />
            ))}
        </Masonry>
    );
};

export default BookmarkGrid;
