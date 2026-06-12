const API_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export async function fetchGroq(prompt: string, options?: {
  model?: string;
  retries?: number;
}): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const model = options?.model ?? 'llama-3.3-70b-versatile';
  const maxRetries = options?.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        const status = res.status;
        lastError = new Error(`Groq API returned status ${status}`);
        if (status === 404) break;
        if (!RETRYABLE_STATUSES.has(status)) break;
        if (attempt >= maxRetries) break;
        await new Promise((r) => setTimeout(r, 350 * attempt));
        continue;
      }

      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= maxRetries) break;
      await new Promise((r) => setTimeout(r, 350 * attempt));
    }
  }

  throw lastError ?? new Error('Groq API call failed after retries');
}
