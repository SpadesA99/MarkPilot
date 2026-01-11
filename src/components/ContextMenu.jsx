import React, { useEffect, useRef } from 'react';
import { FolderPlus, Trash2 } from 'lucide-react';

const ContextMenu = ({ x, y, onClose, onCreateFolder, onDelete, target }) => {
    const menuRef = useRef(null);

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

    const menuWidth = 160;
    const menuHeight = 40;
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

    const adjustedStyle = {
        position: 'fixed',
        left: Math.max(10, adjustedX),
        top: Math.max(10, adjustedY),
        zIndex: 50
    };

    // Determine if target is a bookmark (URL) or folder
    const isBookmark = target && target.url;
    const isFolder = target && !target.url && target.children !== undefined;

    return (
        <div
            ref={menuRef}
            style={adjustedStyle}
            className="bg-vscode-sidebar border border-vscode-border rounded shadow-lg py-1 min-w-[160px]"
        >
            {/* Show delete option if target is a bookmark or folder */}
            {isBookmark && (
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
            )}
            {isFolder && (
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
