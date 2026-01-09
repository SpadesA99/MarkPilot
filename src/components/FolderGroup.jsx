import React, { useState } from 'react';
import { Folder, ChevronDown, ChevronUp, Trash2, Sparkles, ChevronRight } from 'lucide-react';

const FolderGroup = ({ folder, onNavigate, onDelete, onOpen, clickStats, onAiReorganize }) => {
    const [isExpanded, setIsExpanded] = useState(false);
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

    return (
        <div className="bg-vscode-sidebar border border-vscode-border rounded overflow-hidden mb-3">
            {/* Header - VS Code Explorer style */}
            <div className="px-2 py-1.5 flex items-center justify-between bg-vscode-sidebar hover:bg-vscode-hover border-b border-vscode-border">
                <div
                    className="flex items-center gap-1.5 text-vscode-text hover:text-vscode-text-bright cursor-pointer flex-1 min-w-0"
                    onClick={() => onNavigate(folder)}
                >
                    <ChevronRight size={16} className="text-vscode-text-muted flex-shrink-0" />
                    <Folder size={16} className="text-vscode-yellow flex-shrink-0" />
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
                                className="group flex items-center justify-between px-2 py-1 hover:bg-vscode-hover cursor-pointer border-l-2 border-transparent hover:border-vscode-blue"
                                onClick={() => item.url ? onOpen(item) : onNavigate(item)}
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
                                    <span className="text-[13px] text-vscode-text truncate group-hover:text-vscode-text-bright">
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
