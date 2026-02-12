/**
 * Notion integration – OAuth, read/write blocks.
 * Sync PRD/specs to Notion; pull context from Notion pages.
 */

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const NOTION_REDIRECT_URI =
  process.env.NOTION_REDIRECT_URI || 'http://localhost:5173/notion/callback';

export function isNotionConfigured(): boolean {
  return !!(NOTION_CLIENT_ID && NOTION_CLIENT_SECRET);
}

/**
 * Get Notion OAuth authorize URL.
 */
export function getNotionAuthUrl(state: string): string {
  if (!NOTION_CLIENT_ID) {
    throw new Error('NOTION_CLIENT_ID is not configured');
  }
  const params = new URLSearchParams({
    client_id: NOTION_CLIENT_ID,
    redirect_uri: NOTION_REDIRECT_URI,
    response_type: 'code',
    owner: 'user',
    state,
  });
  return `https://api.notion.com/v1/oauth/authorize?${params}`;
}

/**
 * Exchange Notion OAuth code for access token.
 */
export async function exchangeNotionCode(
  code: string
): Promise<{ access_token?: string; error?: string }> {
  if (!isNotionConfigured()) return { error: 'Notion not configured' };
  try {
    const r = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: NOTION_REDIRECT_URI,
      }),
    });
    const data = (await r.json()) as { access_token?: string; error?: string };
    return data;
  } catch (err) {
    return { error: (err as Error).message };
  }
}
