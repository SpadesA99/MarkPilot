import React, { useState } from 'react';
import { Folder, ChevronDown, ChevronUp, Trash2, Sparkles } from 'lucide-react';

const FolderGroup = ({ folder, onDelete, onOpen, clickStats, onAiReorganize, onMoveBookmark }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const DISPLAY_LIMIT = 12;

    let items = folder.children ? [...folder.children] : [];

    const getClicks = (node) => {
        if (node.url) return clickStats?.[node.url] || 0;
        if (node.children) {
            return node.children.reduce((sum, child) => sum + getClicks(child), 0);
        }
        return 0;
    };

    const totalClicks = items.reduce((sum, item) => sum + getClicks(item), 0);

    if (clickStats) {
        items.sort((a, b) => getClicks(b) - getClicks(a));
    }

    const visibleItems = isExpanded ? items : items.slice(0, DISPLAY_LIMIT);
    const hasMore = items.length > DISPLAY_LIMIT;

    // Drag handlers for bookmark items
    const handleDragStart = (e, item) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            id: item.id,
            title: item.title,
            url: item.url,
            sourceFolder: folder.id
        }));
        e.dataTransfer.effectAllowed = 'move';
    };

    // Drop handlers for folder
    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        // Only set false if leaving the container entirely (not entering a child)
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            console.log('Drop data:', data, 'Target folder:', folder.id, 'Has onMoveBookmark:', !!onMoveBookmark);
            if (data.id && data.sourceFolder !== folder.id && onMoveBookmark) {
                console.log('Moving bookmark', data.id, 'to folder', folder.id);
                onMoveBookmark(data.id, folder.id);
            } else {
                console.log('Move skipped - same folder or missing handler');
            }
        } catch (err) {
            console.error('Drop failed:', err);
        }
    };

    return (
        <div
            className={`bg-vscode-sidebar border rounded overflow-hidden mb-3 transition-colors ${isDragOver ? 'border-vscode-blue ring-2 ring-vscode-blue/30' : 'border-vscode-border'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Header - VS Code Explorer style */}
            <div
                className={`px-2 py-1.5 flex items-center justify-between bg-vscode-sidebar border-b transition-colors ${isDragOver ? 'bg-vscode-blue/20 border-vscode-blue' : 'border-vscode-border'}`}
            >
                <div
                    className="flex items-center gap-1.5 text-vscode-text flex-1 min-w-0"
                >
                    <Folder size={16} className={`flex-shrink-0 ${isDragOver ? 'text-vscode-blue' : 'text-vscode-yellow'}`} />
                    <span className="text-[13px] font-normal truncate">{folder.title}</span>
                    <span className="text-[11px] text-vscode-text-muted ml-1">
                        {items.length}{totalClicks > 0 ? ` · ${totalClicks}` : ''}
                    </span>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 hover:opacity-100">
                    {folder.title === '未分类' && onAiReorganize && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAiReorganize(folder); }}
                            className="p-1 text-vscode-text-muted hover:text-vscode-purple hover:bg-vscode-active rounded"
                            title="AI 重新分类"
                        >
                            <Sparkles size={14} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(folder); }}
                        className="p-1 text-vscode-text-muted hover:text-vscode-red hover:bg-vscode-active rounded"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Content - File list style */}
            <div className="bg-vscode-bg">
                {visibleItems.length > 0 ? (
                    <div>
                        {visibleItems.map(item => (
                            <div
                                key={item.id}
                                draggable={!!item.url}
                                onDragStart={(e) => item.url && handleDragStart(e, item)}
                                className={`group flex items-center justify-between px-2 py-1 border-l-2 border-transparent ${item.url ? 'hover:bg-vscode-hover cursor-grab active:cursor-grabbing hover:border-vscode-blue' : ''}`}
                                onClick={() => item.url && onOpen(item)}
                                title={item.title || item.url || '无标题'}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0 pl-4">
                                    {item.url ? (
                                        <img
                                            src={`https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}&sz=32`}
                                            alt=""
                                            className="w-4 h-4 flex-shrink-0"
                                            onError={(e) => { e.target.style.opacity = '0.3'; }}
                                        />
                                    ) : (
                                        <Folder size={16} className="text-vscode-yellow flex-shrink-0" />
                                    )}
                                    <span className={`text-[13px] text-vscode-text truncate ${item.url ? 'group-hover:text-vscode-text-bright' : 'text-vscode-text-muted'}`}>
                                        {item.title || (item.url ? new URL(item.url).hostname : '无标题')}
                                    </span>
                                </div>

                                {/* Hover Actions */}
                                <div className="flex items-center opacity-0 group-hover:opacity-100">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(item); }}
                                        className="p-0.5 text-vscode-text-muted hover:text-vscode-red"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-4 text-center text-[12px] text-vscode-text-muted">
                        暂无内容
                    </div>
                )}

                {/* Expand button */}
                {hasMore && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full py-1.5 flex items-center justify-center gap-1 text-[12px] text-vscode-text-muted hover:text-vscode-blue hover:bg-vscode-hover border-t border-vscode-border"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp size={14} />
                                收起
                            </>
                        ) : (
                            <>
                                <ChevronDown size={14} />
                                显示更多 ({items.length - DISPLAY_LIMIT})
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export default FolderGroup;
