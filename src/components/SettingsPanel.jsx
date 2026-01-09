import React, { useState, useEffect } from 'react';
import { X, Upload, Save, Settings, Bell, Loader2, CheckCircle, XCircle } from 'lucide-react';

const SettingsPanel = ({ isOpen, onClose, onImport, onSortChange, currentSort }) => {
    const [aiSettings, setAiSettings] = useState({
        provider: 'openai',
        apiKey: '',
        model: '',
        baseUrl: ''
    });

    const [useAiReorg, setUseAiReorg] = useState(false);
    const [barkKey, setBarkKey] = useState('');
    const [testingAi, setTestingAi] = useState(false);
    const [aiTestResult, setAiTestResult] = useState(null); // 'success' | 'error' | null
    const [testingBark, setTestingBark] = useState(false);
    const [barkTestResult, setBarkTestResult] = useState(null); // 'success' | 'error' | null

    useEffect(() => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['ai_provider', 'ai_api_key', 'ai_model', 'ai_base_url', 'openai_api_key', 'use_ai_reorg', 'bark_key'], (result) => {
                setAiSettings({
                    provider: result.ai_provider || 'openai',
                    apiKey: result.ai_api_key || result.openai_api_key || '',
                    model: result.ai_model || 'claude-haiku-4-5-20251001',
                    baseUrl: result.ai_base_url || ''
                });
                if (result.use_ai_reorg !== undefined) {
                    setUseAiReorg(result.use_ai_reorg);
                }
                if (result.bark_key) {
                    setBarkKey(result.bark_key);
                }
            });
        }
        // Reset test results when panel opens
        setAiTestResult(null);
        setBarkTestResult(null);
    }, [isOpen]);

    const handleAiReorgChange = (checked) => {
        setUseAiReorg(checked);
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ use_ai_reorg: checked });
        }
    };

    const handleSaveAiSettings = () => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({
                ai_provider: aiSettings.provider,
                ai_api_key: aiSettings.apiKey,
                ai_model: aiSettings.model,
                ai_base_url: aiSettings.baseUrl,
                openai_api_key: aiSettings.apiKey
            }, () => {
                alert('AI 设置已保存');
            });
        } else {
            alert('AI 设置已保存 (Mock)');
        }
    };

    // Test AI API connection
    const handleTestAi = async () => {
        if (!aiSettings.apiKey) {
            alert('请先输入 API Key');
            return;
        }

        setTestingAi(true);
        setAiTestResult(null);

        try {
            const { testConnection } = await import('../services/aiService');
            const success = await testConnection(aiSettings);
            setAiTestResult(success ? 'success' : 'error');
            if (success) {
                // Auto save on successful test
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.set({
                        ai_provider: aiSettings.provider,
                        ai_api_key: aiSettings.apiKey,
                        ai_model: aiSettings.model,
                        ai_base_url: aiSettings.baseUrl,
                        openai_api_key: aiSettings.apiKey
                    });
                }
            }
        } catch (e) {
            console.error('AI test failed:', e);
            setAiTestResult('error');
        } finally {
            setTestingAi(false);
        }
    };

    // Save Bark Key
    const handleSaveBarkKey = () => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set({ bark_key: barkKey }, () => {
                alert('Bark Key 已保存');
            });
        }
    };

    // Test Bark notification
    const handleTestBark = async () => {
        if (!barkKey) {
            alert('请先输入 Bark Key');
            return;
        }

        setTestingBark(true);
        setBarkTestResult(null);

        try {
            const url = `https://api.day.app/${barkKey}/${encodeURIComponent('MarkPilot 通知测试')}/${encodeURIComponent('如果您在手机上看到此消息，说明 Bark 通知已配置成功！')}`;
            const response = await fetch(url, {
                signal: AbortSignal.timeout(10000)
            });

            if (response.ok) {
                setBarkTestResult('success');
                // Auto save on successful test
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    chrome.storage.local.set({ bark_key: barkKey });
                }
            } else {
                setBarkTestResult('error');
            }
        } catch (e) {
            console.error('Bark test failed:', e);
            setBarkTestResult('error');
        } finally {
            setTestingBark(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="bg-vscode-sidebar w-full max-w-md border border-vscode-border shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* VS Code Modal Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-vscode-bg border-b border-vscode-border">
                    <div className="flex items-center gap-2 text-[13px] text-vscode-text">
                        <Settings size={16} className="text-vscode-blue" />
                        <span>设置</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-vscode-hover rounded text-vscode-text-muted hover:text-vscode-text"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Sort Preference */}
                    <div>
                        <label className="block text-[12px] text-vscode-text-muted mb-1.5 uppercase tracking-wide">排序方式</label>
                        <select
                            value={currentSort}
                            onChange={(e) => onSortChange(e.target.value)}
                            className="w-full p-2 bg-vscode-bg border border-vscode-border rounded text-[13px] text-vscode-text focus:border-vscode-blue focus:outline-none"
                        >
                            <option value="default">默认 (文件夹优先)</option>
                            <option value="frequency">访问频率 (点击次数)</option>
                        </select>
                    </div>

                    {/* AI Settings */}
                    <div className="space-y-3">
                        <label className="block text-[12px] text-vscode-text-muted uppercase tracking-wide">AI 设置</label>

                        <div>
                            <label className="text-[11px] text-vscode-text-muted mb-1 block">提供商</label>
                            <select
                                value={aiSettings.provider}
                                onChange={(e) => setAiSettings({ ...aiSettings, provider: e.target.value })}
                                className="w-full p-2 bg-vscode-bg border border-vscode-border rounded text-[13px] text-vscode-text focus:border-vscode-blue focus:outline-none"
                            >
                                <option value="openai">OpenAI</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                                <option value="custom">自定义 (OpenAI 兼容)</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[11px] text-vscode-text-muted mb-1 block">API Key</label>
                            <input
                                type="password"
                                value={aiSettings.apiKey}
                                onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                                placeholder="sk-..."
                                className="w-full p-2 bg-vscode-bg border border-vscode-border rounded text-[13px] text-vscode-text placeholder-vscode-text-muted focus:border-vscode-blue focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] text-vscode-text-muted mb-1 block">模型名称</label>
                            <input
                                type="text"
                                value={aiSettings.model}
                                onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                                placeholder={aiSettings.provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-3.5-turbo'}
                                className="w-full p-2 bg-vscode-bg border border-vscode-border rounded text-[13px] text-vscode-text placeholder-vscode-text-muted focus:border-vscode-blue focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] text-vscode-text-muted mb-1 block">Base URL (选填)</label>
                            <input
                                type="text"
                                value={aiSettings.baseUrl}
                                onChange={(e) => setAiSettings({ ...aiSettings, baseUrl: e.target.value })}
                                placeholder="https://api.openai.com/v1"
                                className="w-full p-2 bg-vscode-bg border border-vscode-border rounded text-[13px] text-vscode-text placeholder-vscode-text-muted focus:border-vscode-blue focus:outline-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleTestAi}
                                disabled={testingAi || !aiSettings.apiKey}
                                className="flex-1 p-2 bg-vscode-green/20 hover:bg-vscode-green/30 text-vscode-green rounded text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {testingAi ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : aiTestResult === 'success' ? (
                                    <CheckCircle size={14} />
                                ) : aiTestResult === 'error' ? (
                                    <XCircle size={14} className="text-vscode-red" />
                                ) : (
                                    <Settings size={14} />
                                )}
                                <span>{testingAi ? '测试中...' : aiTestResult === 'success' ? '连接成功' : aiTestResult === 'error' ? '连接失败' : '测试连接'}</span>
                            </button>
                            <button
                                onClick={handleSaveAiSettings}
                                className="flex-1 p-2 bg-vscode-blue hover:bg-vscode-blue-light text-white rounded text-[13px] flex items-center justify-center gap-2"
                            >
                                <Save size={14} />
                                <span>保存设置</span>
                            </button>
                        </div>
                        {aiTestResult === 'success' && (
                            <p className="text-[11px] text-vscode-green mt-1">AI 设置已自动保存</p>
                        )}
                        {aiTestResult === 'error' && (
                            <p className="text-[11px] text-vscode-red mt-1">请检查 API Key 和设置是否正确</p>
                        )}
                    </div>

                    {/* Bark Notification Settings */}
                    <div className="space-y-3 pt-3 border-t border-vscode-border">
                        <label className="block text-[12px] text-vscode-text-muted uppercase tracking-wide">Bark 推送通知</label>
                        <p className="text-[11px] text-vscode-text-muted">配置 Bark Key 后可在 iOS 设备上接收订阅更新推送</p>

                        <div>
                            <label className="text-[11px] text-vscode-text-muted mb-1 block">Bark Key</label>
                            <input
                                type="text"
                                value={barkKey}
                                onChange={(e) => setBarkKey(e.target.value)}
                                placeholder="从 Bark App 获取的 Key"
                                className="w-full p-2 bg-vscode-bg border border-vscode-border rounded text-[13px] text-vscode-text placeholder-vscode-text-muted focus:border-vscode-blue focus:outline-none"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleTestBark}
                                disabled={testingBark || !barkKey}
                                className="flex-1 p-2 bg-vscode-orange/20 hover:bg-vscode-orange/30 text-vscode-orange rounded text-[13px] flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {testingBark ? (
                                    <Loader2 size={14} className="animate-spin" />
                                ) : barkTestResult === 'success' ? (
                                    <CheckCircle size={14} />
                                ) : barkTestResult === 'error' ? (
                                    <XCircle size={14} className="text-vscode-red" />
                                ) : (
                                    <Bell size={14} />
                                )}
                                <span>{testingBark ? '发送中...' : barkTestResult === 'success' ? '发送成功' : barkTestResult === 'error' ? '发送失败' : '测试通知'}</span>
                            </button>
                            <button
                                onClick={handleSaveBarkKey}
                                className="flex-1 p-2 bg-vscode-blue hover:bg-vscode-blue-light text-white rounded text-[13px] flex items-center justify-center gap-2"
                            >
                                <Save size={14} />
                                <span>保存 Key</span>
                            </button>
                        </div>
                        {barkTestResult === 'success' && (
                            <p className="text-[11px] text-vscode-green">Bark Key 已自动保存，请检查手机通知</p>
                        )}
                        {barkTestResult === 'error' && (
                            <p className="text-[11px] text-vscode-red">发送失败，请检查 Bark Key 是否正确</p>
                        )}
                    </div>

                    {/* Import Section */}
                    <div className="pt-3 border-t border-vscode-border">
                        <label className="block text-[12px] text-vscode-text-muted mb-2 uppercase tracking-wide">导入书签</label>

                        <div className="flex items-center gap-2 mb-3 bg-vscode-active p-2 rounded border border-vscode-border">
                            <input
                                type="checkbox"
                                id="useAiReorg"
                                checked={useAiReorg}
                                className="rounded border-vscode-border bg-vscode-bg text-vscode-blue focus:ring-vscode-blue"
                                onChange={(e) => handleAiReorgChange(e.target.checked)}
                            />
                            <label htmlFor="useAiReorg" className="text-[12px] text-vscode-orange cursor-pointer select-none">
                                导入时使用 AI 重新分类 (警告: 将重置目录结构)
                            </label>
                        </div>

                        <div className="space-y-2">
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => {
                                        if (e.target.files[0]) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => onImport(ev.target.result, 'json', useAiReorg);
                                            reader.readAsText(e.target.files[0]);
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-vscode-hover text-vscode-green border border-vscode-border rounded text-[13px] hover:bg-vscode-active">
                                    <Upload size={14} />
                                    <span>导入 JSON 文件</span>
                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".html"
                                    onChange={(e) => {
                                        if (e.target.files[0]) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => onImport(ev.target.result, 'html', useAiReorg);
                                            reader.readAsText(e.target.files[0]);
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-vscode-hover text-vscode-blue border border-vscode-border rounded text-[13px] hover:bg-vscode-active">
                                    <Upload size={14} />
                                    <span>导入 HTML 文件 (Chrome 导出)</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Data Backup & Restore */}
                    <div className="pt-3 border-t border-vscode-border">
                        <label className="block text-[12px] text-vscode-text-muted mb-2 uppercase tracking-wide">数据备份与恢复</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => onImport(null, 'export')}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-vscode-hover text-vscode-text border border-vscode-border rounded text-[13px] hover:bg-vscode-active"
                            >
                                <Save size={14} />
                                <span>导出备份</span>
                            </button>

                            <div className="flex-1 relative">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => {
                                        if (e.target.files[0]) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => onImport(ev.target.result, 'backup');
                                            reader.readAsText(e.target.files[0]);
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <button className="w-full h-full flex items-center justify-center gap-2 px-3 py-2 bg-vscode-hover text-vscode-text border border-vscode-border rounded text-[13px] hover:bg-vscode-active pointer-events-none">
                                    <Upload size={14} />
                                    <span>恢复备份</span>
                                </button>
                            </div>
                        </div>
                        <p className="text-[11px] text-vscode-text-muted mt-2">包含所有书签、统计数据和设置</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
