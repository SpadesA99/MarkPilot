import React from 'react';
import Masonry from 'react-masonry-css';
import FolderGroup from './FolderGroup';
import { Folder } from 'lucide-react';

const BookmarkGrid = ({ items, onNavigate, onDelete, onOpen, clickStats, onAiReorganize }) => {
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

    // Sort folders by total click count (descending)
    if (clickStats) {
        allGroups.sort((a, b) => getTotalClicks(b) - getTotalClicks(a));
    }

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
                    onNavigate={onNavigate}
                    onDelete={onDelete}
                    onOpen={onOpen}
                    clickStats={clickStats}
                    onAiReorganize={onAiReorganize}
                />
            ))}
        </Masonry>
    );
};

export default BookmarkGrid;
