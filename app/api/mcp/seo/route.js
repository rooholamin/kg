/**
 * Internal MCP server for the two SEO Managed Agents (seo-agent.yaml,
 * kingsgate-linking-agent.yaml). A hand-rolled, stateless Streamable HTTP
 * JSON-RPC 2.0 endpoint — deliberately NOT built on a heavier MCP SDK
 * package, since every third-party option pulled in either a zod v4
 * requirement (conflicting with this app's existing zod v3 usage) or session
 * machinery this tiny, 2-tool, always-synchronous server doesn't need. This
 * mirrors the "stateless Streamable HTTP" mode the MCP spec explicitly
 * allows: no sessions, no server-initiated SSE stream, one JSON response per
 * request. See docs/managed-agents/mcp-connector for how Anthropic calls in.
 *
 * Auth: a static bearer token (MCP_SEO_SECRET), matched against a
 * `static_bearer` credential registered in an Anthropic vault and referenced
 * via `vault_ids` at session-creation time (see scripts/create-mcp-vault.mjs
 * and SeoSettings.mcpVaultId) — same shape as the Higgsfield MCP auth used
 * by the video pipeline, just backed by a shared secret instead of OAuth.
 */
import { NextResponse } from 'next/server';
import {
  updateArticleTool,
  getKingsgatePostsForFeatureTool,
  getNextPrivatePostTool,
  deletePostWithMediaTool,
  publishNewsPostTool,
} from '@/services/mcp-seo-tools.service';

const PROTOCOL_VERSION = '2025-06-18';

const TOOLS = [
  {
    name: 'update_article',
    description:
      "Apply on-page SEO or content changes to a KGHub article that's already published to WordPress. Pass ONLY the field(s) you're changing — everything else is left untouched. Updates both the KGHub database and the live WordPress post immediately. Used both for on-page SEO fixes and for inserting a single Kingsgate link into an article's body.",
    inputSchema: {
      type: 'object',
      properties: {
        articleId: {
          type: 'string',
          description: 'The KGHub article id, given to you in the task message. Never invent one.',
        },
        title: { type: 'string', description: 'New title, only if you are changing it.' },
        metaDescription: {
          type: 'string',
          description: 'New meta description (~150-160 characters), only if you are changing it.',
        },
        contentHtml: {
          type: 'string',
          description:
            'The FULL revised article body as HTML, only if you are changing the content. Must be the complete article body, not a fragment or diff — whatever you send fully replaces the existing body.',
        },
      },
      required: ['articleId'],
    },
  },
  {
    name: 'get_kingsgate_posts_for_feature',
    description:
      "Look up real, existing kingsgateluxuryhomes.com blog posts tagged with a specific home-feature taxonomy term. Use the numeric feature id from the reference list in your instructions — never guess or invent an id. Returns only genuinely tagged posts (or an empty list if none exist) — never invent a URL yourself; only link to a URL this tool actually returned.",
    inputSchema: {
      type: 'object',
      properties: {
        featureId: {
          type: 'number',
          description: 'The numeric WordPress taxonomy term id of the feature, from your reference list.',
        },
      },
      required: ['featureId'],
    },
  },
  {
    name: 'get_next_private_post',
    description:
      'Finds the newest private-status post on insights.kghub.ca (the news-crawler queue - private status is used exclusively for this). Returns the post (id, title, cleaned body HTML, an extracted sourceUrl for citation, and a featuredImageUrl if one exists) plus, for all 7 KG Hub sections, their classification blurb and full writer persona. Returns found:false if the queue is currently empty - that is a normal, expected outcome, not an error.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'delete_post_with_media',
    description:
      "Permanently deletes a post AND its attached media from insights.kghub.ca. Use ONLY when a post from get_next_private_post does not genuinely fit any of the 7 sections. This is irreversible - there is no undo and nothing is logged.",
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'number', description: 'The WordPress post id, from get_next_private_post.' },
      },
      required: ['postId'],
    },
  },
  {
    name: 'publish_news_post',
    description:
      'Publishes the rewritten article: updates the WordPress post with the final content, sets authorship to the matched section\'s own writer persona, and marks it published. Use ONLY after deciding the post genuinely fits one specific section.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'number', description: 'The WordPress post id, from get_next_private_post.' },
        sectionSlug: {
          type: 'string',
          description: 'One of the exact section slugs from get_next_private_post\'s sections list (e.g. "kg-invest"). Never invent one.',
        },
        title: { type: 'string', description: 'The rewritten headline (not a copy of the original title).' },
        contentHtml: {
          type: 'string',
          description: 'The FULL rewritten article body as Gutenberg block HTML - the complete post content, not a fragment.',
        },
      },
      required: ['postId', 'sectionSlug', 'contentHtml'],
    },
  },
];

async function callTool(name, args) {
  switch (name) {
    case 'update_article':
      return updateArticleTool(args ?? {});
    case 'get_kingsgate_posts_for_feature':
      return getKingsgatePostsForFeatureTool(args ?? {});
    case 'get_next_private_post':
      return getNextPrivatePostTool();
    case 'delete_post_with_media':
      return deletePostWithMediaTool(args ?? {});
    case 'publish_news_post':
      return publishNewsPostTool(args ?? {});
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

function isAuthorized(req) {
  const secret = process.env.MCP_SEO_SECRET;
  // Fail closed — this server can write to WordPress, so an unconfigured
  // secret means "nobody gets in", not "anyone gets in".
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  return token === secret;
}

function rpcError(id, code, message, status = 400) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } }, { status });
}

async function handleMessage(msg) {
  const { id, method, params } = msg ?? {};

  if (typeof method !== 'string') {
    return { jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid Request' } };
  }

  // Notifications (no id) never get a response per JSON-RPC 2.0.
  if (method.startsWith('notifications/')) return null;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'kghub-seo-mcp', version: '1.0.0' },
      },
    };
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params ?? {};
    try {
      const result = await callTool(name, args);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: result?.ok === false,
        },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ ok: false, error: err?.message ?? 'Tool execution failed' }) }],
          isError: true,
        },
      };
    }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

export async function POST(req) {
  if (!isAuthorized(req)) {
    return rpcError(null, -32001, 'Unauthorized', 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, 'Parse error', 400);
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(messages.map(handleMessage))).filter(Boolean);

  if (responses.length === 0) {
    // Every message was a notification — MCP spec: 202 Accepted, no body.
    return new Response(null, { status: 202 });
  }

  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

// Stateless server — no server-initiated stream, no session to resume/delete.
export async function GET() {
  return rpcError(null, -32601, 'This MCP server is stateless and does not support server-initiated streams', 405);
}

export async function DELETE() {
  return new Response(null, { status: 200 });
}
