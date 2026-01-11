import React, { useState } from 'react';
import { RefreshCw, Trash2, ExternalLink, ChevronDown, ChevronUp, Rss, Globe, Star } from 'lucide-react';

function FeedCard({ subscription, isRefreshing, onRefresh, onDelete, onToggleFollow }) {
  const [expanded, setExpanded] = useState(false);
  const { title, url, feedType, items = [], lastChecked, followed = false } = subscription;

  const hostname = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url || 'unknown';
    }
  })();
  const displayItems = expanded ? items.slice(0, 20) : items.slice(0, 5);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;

      if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
      if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
      return date.toLocaleDateString('zh-CN');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-vscode-sidebar border border-vscode-border rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-vscode-border flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
            alt=""
            className="w-5 h-5 rounded"
            onError={(e) => e.target.style.display = 'none'}
          />
          <div className="min-w-0">
            <h3 className="text-[13px] font-medium truncate">{title}</h3>
            <div className="flex items-center gap-2 text-[11px] text-vscode-text-muted">
              {feedType === 'sitemap' ? (
                <Globe size={10} />
              ) : (
                <Rss size={10} className="text-vscode-orange" />
              )}
              <span>{feedType.toUpperCase()}</span>
              <span>•</span>
              <span>{items.length} 条</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleFollow}
            className={`p-1.5 hover:bg-vscode-hover rounded ${followed ? 'text-vscode-yellow' : 'text-vscode-text-muted hover:text-vscode-yellow'}`}
            title={followed ? '取消关注' : '关注 (AI简报)'}
          >
            <Star size={14} fill={followed ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-hover rounded"
            title="刷新"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-vscode-text-muted hover:text-vscode-red hover:bg-vscode-hover rounded"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-vscode-border">
        {displayItems.length > 0 ? (
          displayItems.map((item, index) => (
            <a
              key={index}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2.5 hover:bg-vscode-hover group"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-[12px] text-vscode-text group-hover:text-vscode-blue line-clamp-2">
                  {item.title || item.link}
                </h4>
                <ExternalLink size={12} className="text-vscode-text-muted opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
              </div>
              {item.description && (
                <p className="text-[11px] text-vscode-text-muted mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
              {item.pubDate && (
                <span className="text-[10px] text-vscode-text-muted mt-1 block">
                  {formatDate(item.pubDate)}
                </span>
              )}
            </a>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-[12px] text-vscode-text-muted">
            暂无内容，点击刷新获取
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-[12px] text-vscode-text-muted hover:text-vscode-text hover:bg-vscode-hover border-t border-vscode-border flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp size={14} />
              <span>收起</span>
            </>
          ) : (
            <>
              <ChevronDown size={14} />
              <span>显示更多 ({items.length - 5})</span>
            </>
          )}
        </button>
      )}

      {/* Last checked */}
      {lastChecked && (
        <div className="px-4 py-1.5 text-[10px] text-vscode-text-muted bg-vscode-bg border-t border-vscode-border">
          上次刷新: {formatDate(lastChecked)}
        </div>
      )}
    </div>
  );
}

export default FeedCard;
