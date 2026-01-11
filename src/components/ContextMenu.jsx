import React, { useEffect, useRef } from 'react';
import { FolderPlus } from 'lucide-react';

const ContextMenu = ({ x, y, onClose, onCreateFolder }) => {
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

    // Adjust position to keep menu within viewport
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

    return (
        <div
            ref={menuRef}
            style={adjustedStyle}
            className="bg-vscode-sidebar border border-vscode-border rounded shadow-lg py-1 min-w-[160px]"
        >
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
        </div>
    );
};

export default ContextMenu;
