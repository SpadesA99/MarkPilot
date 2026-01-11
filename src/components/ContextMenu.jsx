import React, { useEffect, useRef, useState } from 'react';
import { FolderPlus, Trash2, Pin, FolderInput, ChevronRight, Folder } from 'lucide-react';

const ContextMenu = ({ x, y, onClose, onCreateFolder, onDelete, target, onPinFolder, pinnedFolders = [], folders = [], onMoveBookmark, currentFolderId }) => {
    const menuRef = useRef(null);
    const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Determine if target is a bookmark (URL) or folder
    const isBookmark = target && target.url;
    const isFolder = target && !target.url && target.children !== undefined;

    // Filter available folders for move (exclude current folder and uncategorized)
    const availableFolders = folders.filter(f =>
        f.id !== currentFolderId &&
        f.id !== 'uncategorized' &&
        !f.url
    );

    const menuWidth = 160;
    const submenuWidth = 150;
    // Calculate menu height based on number of items (each item ~32px + padding)
    const bookmarkItemCount = (availableFolders.length > 0 && onMoveBookmark) ? 2 : 1;
    const itemCount = isBookmark ? bookmarkItemCount : isFolder ? (target.id !== 'uncategorized' ? 2 : 1) : 1;
    const menuHeight = itemCount * 32 + 8;

    // Check if submenu would overflow to the right
    const submenuOverflows = x + menuWidth + submenuWidth > window.innerWidth - 10;
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

    const adjustedStyle = {
        position: 'fixed',
        left: Math.max(10, adjustedX),
        top: Math.max(10, adjustedY),
        zIndex: 50
    };

    return (
        <div
            ref={menuRef}
            style={adjustedStyle}
            className="bg-vscode-sidebar border border-vscode-border rounded shadow-lg py-1 min-w-[160px]"
        >
            {/* Show options for bookmark */}
            {isBookmark && (
                <>
                    {/* Move to folder option with submenu */}
                    {availableFolders.length > 0 && onMoveBookmark && (
                        <div
                            className="relative"
                            onMouseEnter={() => setShowMoveSubmenu(true)}
                            onMouseLeave={() => setShowMoveSubmenu(false)}
                        >
                            <button
                                className="w-full px-3 py-1.5 flex items-center justify-between text-[13px] text-vscode-text hover:bg-vscode-hover cursor-pointer"
                            >
                                <span className="flex items-center gap-2">
                                    <FolderInput size={14} className="text-vscode-blue" />
                                    移动到...
                                </span>
                                <ChevronRight size={14} className="text-vscode-text-muted" />
                            </button>
                            {/* Submenu - position left or right based on available space */}
                            {showMoveSubmenu && (
                                <div className={`absolute top-0 bg-vscode-sidebar border border-vscode-border rounded shadow-lg py-1 min-w-[140px] max-h-[300px] overflow-y-auto ${submenuOverflows ? 'right-full mr-1' : 'left-full ml-1'}`}>
                                    {availableFolders.map(folder => (
                                        <button
                                            key={folder.id}
                                            onClick={() => {
                                                onMoveBookmark(target.id, folder.id);
                                                onClose();
                                            }}
                                            className="w-full px-3 py-1.5 flex items-center gap-2 text-[13px] text-vscode-text hover:bg-vscode-hover cursor-pointer"
                                        >
                                            <Folder size={14} className="text-vscode-yellow" />
                                            <span className="truncate">{folder.title}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        onClick={() => {
                            onDelete(target);
                            onClose();
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-[13px] text-vscode-text hover:bg-vscode-hover cursor-pointer"
                    >
                        <Trash2 size={14} className="text-vscode-red" />
                        删除书签
                    </button>
                </>
            )}
            {isFolder && (
                <>
                    {target.id !== 'uncategorized' && onPinFolder && (
                        <button
                            onClick={() => {
                                onPinFolder(target.id);
                                onClose();
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 text-[13px] text-vscode-text hover:bg-vscode-hover cursor-pointer"
                        >
                            <Pin size={14} className="text-vscode-blue" />
                            {pinnedFolders.includes(target.id) ? '取消置顶' : '置顶文件夹'}
                        </button>
                    )}
                    <button
                        onClick={() => {
                            onDelete(target);
                            onClose();
                        }}
                        className="w-full px-3 py-1.5 flex items-center gap-2 text-[13px] text-vscode-text hover:bg-vscode-hover cursor-pointer"
                    >
                        <Trash2 size={14} className="text-vscode-red" />
                        删除文件夹
                    </button>
                </>
            )}
            {/* Show create folder option if no target (right-click on empty area) */}
            {!target && (
                <button
                    onClick={() => {
                        onCreateFolder();
                        onClose();
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-[13px] text-vscode-text hover:bg-vscode-hover cursor-pointer"
                >
                    <FolderPlus size={14} className="text-vscode-yellow" />
                    新建文件夹
                </button>
            )}
        </div>
    );
};

export default ContextMenu;
