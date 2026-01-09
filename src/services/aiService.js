import OpenAI from 'openai';

// We'll use the OpenAI SDK for both OpenAI and Custom (OpenAI-compatible) providers
// For Anthropic, we'll use direct fetch to avoid adding another heavy dependency if possible,
// or we can use the SDK if installed. Since we want to keep it light, let's use fetch for Anthropic.

// Helper function to repair incomplete JSON
const repairJSON = (str) => {
    let s = str.trim();

    // Remove markdown code blocks
    s = s.replace(/```\w*\n?|\n?```/g, '').trim();

    // Try to extract JSON object
    const jsonStart = s.indexOf('{');
    if (jsonStart === -1) return null;
    s = s.substring(jsonStart);

    // Count braces to check if JSON is complete
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let lastValidEnd = -1;

    for (let i = 0; i < s.length; i++) {
        const char = s[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\' && inString) {
            escape = true;
            continue;
        }

        if (char === '"' && !escape) {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    lastValidEnd = i;
                }
            }
        }
    }

    // If JSON is complete, return it
    if (braceCount === 0 && lastValidEnd !== -1) {
        return s.substring(0, lastValidEnd + 1);
    }

    // Try to repair truncated JSON
    if (braceCount > 0) {
        // Find the last complete key-value pair
        // Look for pattern: "id": "category" or "id": "category",
        const lines = s.split('\n');
        let repairedLines = [];
        let foundIncomplete = false;

        for (const line of lines) {
            const trimmed = line.trim();
            // Check if this is a complete key-value pair
            if (trimmed.match(/^"[^"]+"\s*:\s*"[^"]*"\s*,?\s*$/) || trimmed === '{') {
                if (!foundIncomplete) {
                    repairedLines.push(line);
                }
            } else if (trimmed === '}') {
                repairedLines.push(line);
            } else {
                // Incomplete line, stop here
                foundIncomplete = true;
            }
        }

        // Remove trailing comma from last entry and close the object
        let repaired = repairedLines.join('\n');
        repaired = repaired.replace(/,\s*$/, '');

        // Ensure proper closing
        if (!repaired.trim().endsWith('}')) {
            repaired += '\n}';
        }

        return repaired;
    }

    return null;
};

// Safe JSON parse with repair attempt
const safeJSONParse = (content) => {
    // First try direct parse
    try {
        return JSON.parse(content);
    } catch (e) {
        // Try to repair and parse
        const repaired = repairJSON(content);
        if (repaired) {
            try {
                return JSON.parse(repaired);
            } catch (e2) {
                console.error('JSON repair failed:', e2);
                console.error('Original content:', content);
                console.error('Repaired attempt:', repaired);
            }
        }
        throw e;
    }
};

// Process a single batch
const processBatch = async (batch, provider, apiKey, model, baseUrl) => {
    const prompt = `
    你是一个书签整理助手。请将以下书签分类到几个广泛、通用的类别中（例如："技术开发", "网络安全", "娱乐", "工具", "云原生", "系统管理"）。

    重要指令：仅返回原始 JSON。
    - 不要使用 markdown 代码块（不要 \`\`\`json）。
    - JSON 前后不要包含任何文本。
    - 输出必须是有效的 JSON 对象，其中键是书签 ID，值是类别名称（中文）。
    - 必须严格输出 JSON，不要输出其他内容。

    返回内容示例 json ：
    {
        "101": "搜索引擎",
        "102": "技术开发",
        "103": "社交媒体",
        "104": "容器技术"
    }

    书签列表：
    ${JSON.stringify(batch.map(b => ({ id: b.id, title: b.title, url: b.url })))}
    `;

    if (provider === 'anthropic') {
        return await callAnthropic(apiKey, model || 'claude-haiku-4-5-20251001', baseUrl, prompt);
    } else {
        return await callOpenAI(apiKey, model, baseUrl, prompt);
    }
};

// Concurrent batch processor with concurrency limit
const processWithConcurrency = async (batches, concurrencyLimit, processor, onProgress, onLog) => {
    const results = [];
    let completedCount = 0;
    const total = batches.length;

    // Process batches in chunks based on concurrency limit
    for (let i = 0; i < batches.length; i += concurrencyLimit) {
        const chunk = batches.slice(i, i + concurrencyLimit);

        // Log URLs being processed in this chunk
        if (onLog) {
            const urls = chunk.flatMap(batch =>
                batch.map(b => `→ ${b.title.substring(0, 30)}${b.title.length > 30 ? '...' : ''} | ${b.url}`)
            );
            onLog(urls);
        }

        if (onProgress) {
            onProgress(`正在并发处理第 ${i + 1}-${Math.min(i + chunk.length, total)} / ${total} 批书签...`);
        }

        const chunkResults = await Promise.allSettled(
            chunk.map((batch, idx) => processor(batch, i + idx))
        );

        for (const result of chunkResults) {
            completedCount++;
            if (result.status === 'fulfilled') {
                results.push(result.value);
                console.log(`Batch ${completedCount}/${total} completed`);
                if (onLog) {
                    onLog([`✓ 批次 ${completedCount}/${total} 完成`]);
                }
            } else {
                console.error(`Batch ${completedCount}/${total} failed:`, result.reason);
                if (onLog) {
                    onLog([`✗ 批次 ${completedCount}/${total} 失败: ${result.reason?.message || '未知错误'}`]);
                }
            }
        }
    }

    return results;
};

export const categorizeBookmarks = async (bookmarks, settings, onProgress) => {
    const { provider, apiKey, model, baseUrl } = settings;

    if (!apiKey) throw new Error('API Key is missing');

    // Filter bookmarks with URL and deduplicate by URL
    const seenUrls = new Set();
    const files = bookmarks.filter(b => {
        if (!b.url) return false;
        if (seenUrls.has(b.url)) return false;
        seenUrls.add(b.url);
        return true;
    });

    if (files.length === 0) return {};

    console.log(`Deduplicated: ${bookmarks.length} -> ${files.length} unique bookmarks`);

    // Configuration
    const BATCH_SIZE = 50; // Smaller batches for more reliable JSON output
    const CONCURRENCY_LIMIT = 5; // Max concurrent API requests

    // Split into batches
    const batches = [];
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${files.length} bookmarks in ${batches.length} batches (concurrency: ${CONCURRENCY_LIMIT})`);

    if (onProgress) {
        onProgress(`共 ${files.length} 个书签（已去重），分 ${batches.length} 批处理...`, [
            `开始处理 ${files.length} 个书签...`,
            `去重: ${bookmarks.length} → ${files.length}`,
            `分为 ${batches.length} 批，每批 ${BATCH_SIZE} 个`,
            `并发数: ${CONCURRENCY_LIMIT}`
        ]);
    }

    // Process all batches concurrently with limit
    const results = await processWithConcurrency(
        batches,
        CONCURRENCY_LIMIT,
        (batch) => processBatch(batch, provider, apiKey, model, baseUrl),
        (msg) => onProgress && onProgress(`共 ${files.length} 个书签 | ${msg}`),
        (logs) => onProgress && onProgress(null, logs)
    );

    // Merge all results
    const allCategories = {};
    for (const result of results) {
        Object.assign(allCategories, result);
    }

    console.log('All Categories:', allCategories);
    return allCategories;
};

const callOpenAI = async (apiKey, model, baseUrl, prompt) => {
    const config = {
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    };
    if (baseUrl) {
        config.baseURL = baseUrl;
    }

    const openai = new OpenAI(config);
    const modelName = model || 'gpt-3.5-turbo';

    const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: modelName,
        max_tokens: 4096,
        response_format: { type: "json_object" },
    });

    let content = completion.choices[0].message.content;

    // Strip markdown code blocks if present (handle json, xml, or no language tag)
    content = content.replace(/```\w*\n?|\n?```/g, '').trim();

    return safeJSONParse(content);
};

const callAnthropic = async (apiKey, model, baseUrl, prompt) => {
    // Anthropic API call via fetch
    const url = baseUrl ? `${baseUrl}/messages` : 'https://api.anthropic.com/v1/messages';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-browser': 'true' // Note: Anthropic might block browser calls directly due to CORS
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4096, // Increased from 1024 to prevent JSON truncation
            messages: [
                { role: "user", content: prompt + "\n\nRespond with JSON only." }
            ]
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Anthropic API Error');
    }

    const data = await response.json();
    let content = data.content[0].text;

    // Strip markdown code blocks if present (handle json, xml, or no language tag)
    content = content.replace(/```\w*\n?|\n?```/g, '').trim();

    // Extract JSON from response (Claude might add text around it)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        return safeJSONParse(jsonMatch[0]);
    }
    return safeJSONParse(content);
};

// Generate titles for bookmarks using AI
export const generateTitles = async (bookmarks, settings, onProgress) => {
    const { provider, apiKey, model, baseUrl } = settings;

    if (!apiKey) throw new Error('API Key is missing');

    // Filter bookmarks without titles
    const emptyTitleBookmarks = bookmarks.filter(b => b.url && !b.title);

    if (emptyTitleBookmarks.length === 0) return {};

    const BATCH_SIZE = 30;
    const batches = [];
    for (let i = 0; i < emptyTitleBookmarks.length; i += BATCH_SIZE) {
        batches.push(emptyTitleBookmarks.slice(i, i + BATCH_SIZE));
    }

    if (onProgress) {
        onProgress(`共 ${emptyTitleBookmarks.length} 个无标题书签，分 ${batches.length} 批处理...`);
    }

    const allTitles = {};

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        if (onProgress) {
            onProgress(`正在生成标题 ${i + 1}/${batches.length}...`);
        }

        const prompt = `
        你是一个书签整理助手。请根据以下URL生成简洁、有意义的中文标题。

        重要指令：仅返回原始 JSON。
        - 不要使用 markdown 代码块。
        - 输出必须是有效的 JSON 对象，其中键是书签 ID，值是生成的标题。
        - 标题应该简洁（不超过30个字符），描述网站的主要内容或用途。

        URL列表：
        ${JSON.stringify(batch.map(b => ({ id: b.id, url: b.url })))}
        `;

        try {
            let result;
            if (provider === 'anthropic') {
                result = await callAnthropic(apiKey, model || 'claude-haiku-4-5-20251001', baseUrl, prompt);
            } else {
                result = await callOpenAI(apiKey, model, baseUrl, prompt);
            }
            Object.assign(allTitles, result);
        } catch (e) {
            console.error('Failed to generate titles for batch', i, e);
        }
    }

    return allTitles;
};

/**
 * Generate a briefing summary from feed content
 * @param {string} content - Combined feed content
 * @param {Object} settings - AI settings
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<{title: string, content: string}>>} - Generated briefing items
 */
export const generateBriefing = async (content, settings, onProgress) => {
    const { provider, apiKey, model, baseUrl } = settings;

    if (!apiKey) {
        throw new Error('API Key is required');
    }

    onProgress?.('正在生成简报...');

    const prompt = `
你是一个智能信息助手。请根据以下订阅内容生成一份简洁的中文简报摘要。

重要指令：仅返回原始 JSON 数组。
- 不要使用 markdown 代码块（不要 \`\`\`json）。
- JSON 前后不要包含任何文本。
- 必须严格输出 JSON 数组，不要输出其他内容。

输出格式：
[
  { "title": "分类标题1", "content": "该分类下的摘要内容..." },
  { "title": "分类标题2", "content": "该分类下的摘要内容..." }
]

要求：
1. 按主题分类整理，每个分类一个条目
2. title 是分类名称（如"技术动态"、"行业新闻"等）
3. content 是该分类下所有内容的简洁摘要
4. 如果有重要内容，在 content 中用【重要】标注
5. 最后一个条目的 title 为"总结"，content 为整体趋势或建议

订阅内容：
${content}
`;

    try {
        let result;
        if (provider === 'anthropic') {
            result = await callAnthropicJSON(apiKey, model || 'claude-haiku-4-5-20251001', baseUrl, prompt);
        } else {
            result = await callOpenAIJSON(apiKey, model, baseUrl, prompt);
        }
        onProgress?.('简报生成完成');
        return result;
    } catch (e) {
        console.error('Briefing generation error:', e);
        throw e;
    }
};

// Helper for JSON OpenAI call for briefing
async function callOpenAIJSON(apiKey, model, baseUrl, prompt) {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({
        apiKey,
        baseURL: baseUrl || undefined,
        dangerouslyAllowBrowser: true,
    });

    const completion = await openai.chat.completions.create({
        model: model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        response_format: { type: "json_object" },
    });

    let content = completion.choices[0].message.content;
    content = content.replace(/```\w*\n?|\n?```/g, '').trim();

    const parsed = safeJSONParse(content);
    // Handle both array format and object with items property
    if (Array.isArray(parsed)) {
        return parsed;
    }
    if (parsed.items && Array.isArray(parsed.items)) {
        return parsed.items;
    }
    // Try to extract array from object
    const firstArrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (firstArrayKey) {
        return parsed[firstArrayKey];
    }
    // Fallback: convert object to array
    return [{ title: '简报', content: JSON.stringify(parsed) }];
}

// Helper for JSON Anthropic call for briefing
async function callAnthropicJSON(apiKey, model, baseUrl, prompt) {
    const response = await fetch(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
            model: model || 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt + '\n\nRespond with JSON array only.' }],
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let content = data.content[0].text;
    content = content.replace(/```\w*\n?|\n?```/g, '').trim();

    // Extract JSON array from response
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
        return safeJSONParse(arrayMatch[0]);
    }

    const parsed = safeJSONParse(content);
    if (Array.isArray(parsed)) {
        return parsed;
    }
    return [{ title: '简报', content: content }];
}


/**
 * Test AI API connection with a simple request
 * @param {Object} settings - AI settings
 * @returns {Promise<boolean>} - True if connection successful
 */
export const testConnection = async (settings) => {
    const { provider, apiKey, model, baseUrl } = settings;

    if (!apiKey) {
        throw new Error('API Key is required');
    }

    const testPrompt = 'Reply with exactly: OK';

    try {
        if (provider === 'anthropic') {
            const response = await fetch(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: model || 'claude-haiku-4-5-20251001',
                    max_tokens: 10,
                    messages: [{ role: 'user', content: testPrompt }],
                }),
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error?.message || response.statusText);
            }

            return true;
        } else {
            // OpenAI or compatible API
            const OpenAI = (await import('openai')).default;
            const openai = new OpenAI({
                apiKey,
                baseURL: baseUrl || undefined,
                dangerouslyAllowBrowser: true,
            });

            await openai.chat.completions.create({
                model: model || 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: testPrompt }],
                max_tokens: 10,
            });

            return true;
        }
    } catch (e) {
        console.error('AI connection test failed:', e);
        throw e;
    }
};
