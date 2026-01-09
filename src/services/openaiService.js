import OpenAI from 'openai';

export const categorizeBookmarks = async (bookmarks, apiKey) => {
    if (!apiKey) throw new Error('API Key is missing');

    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage
    });

    // Filter only URLs (files), ignore folders for now
    const files = bookmarks.filter(b => b.url);
    if (files.length === 0) return [];

    const prompt = `
    You are a bookmark organizer. Categorize the following bookmarks into a few broad, common categories (e.g., "Development", "News", "Social", "Entertainment", "Shopping", "Tools").
    Return ONLY a JSON object where keys are the bookmark IDs and values are the category names.
    Do not create too many categories. Keep it simple.
    
    Bookmarks:
    ${JSON.stringify(files.map(b => ({ id: b.id, title: b.title, url: b.url })))}
    `;

    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "gpt-3.5-turbo",
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);
        // Result format: { "id1": "Category1", "id2": "Category2" }
        return result;
    } catch (e) {
        console.error('OpenAI Error:', e);
        throw e;
    }
};
