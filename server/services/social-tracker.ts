import FirecrawlApp from "@mendable/firecrawl-js";
import { storage } from "../storage";

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

export interface SocialPost {
  postId: string;
  content: string;
  authorUsername: string;
  authorDisplayName?: string;
  postUrl: string;
  postedAt: Date;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  matchedKeywords: string[];
}

export interface FetchResult {
  success: boolean;
  posts: SocialPost[];
  error?: string;
}

function extractTweetsFromMarkdown(markdown: string, username: string): SocialPost[] {
  const posts: SocialPost[] = [];
  const lines = markdown.split('\n');
  let currentPost: Partial<SocialPost> | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const tweetMatch = line.match(/^##\s*(.+)$/);
    if (tweetMatch || line.includes('Tweet:') || line.includes('Status:')) {
      if (currentPost && contentLines.length > 0) {
        currentPost.content = contentLines.join('\n').trim();
        if (currentPost.content && currentPost.postId) {
          posts.push(currentPost as SocialPost);
        }
      }
      currentPost = {
        authorUsername: username,
        postId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        postUrl: `https://x.com/${username}`,
        postedAt: new Date(),
        matchedKeywords: [],
      };
      contentLines = [];
      continue;
    }

    if (currentPost) {
      const timeMatch = line.match(/(\d+[hms]\s*ago|hours?\s*ago|minutes?\s*ago|yesterday|today)/i);
      if (timeMatch) {
        continue;
      }

      const urlMatch = line.match(/https:\/\/x\.com\/\w+\/status\/(\d+)/);
      if (urlMatch) {
        currentPost.postId = urlMatch[1];
        currentPost.postUrl = urlMatch[0];
        continue;
      }

      if (line.trim() && !line.startsWith('---') && !line.startsWith('![')) {
        contentLines.push(line.trim());
      }
    }
  }

  if (currentPost && contentLines.length > 0) {
    currentPost.content = contentLines.join('\n').trim();
    if (currentPost.content && currentPost.postId) {
      posts.push(currentPost as SocialPost);
    }
  }

  return posts;
}

function matchKeywords(content: string, keywords: string[]): string[] {
  const lowerContent = content.toLowerCase();
  return keywords.filter(kw => lowerContent.includes(kw.toLowerCase()));
}

export async function fetchAccountPosts(
  accountId: string,
  username: string,
  keywords: string[]
): Promise<FetchResult> {
  try {
    const profileUrl = `https://x.com/${username}`;
    
    const result = await firecrawl.scrapeUrl(profileUrl, {
      formats: ["markdown"],
    });

    if (!result.success) {
      return {
        success: false,
        posts: [],
        error: "Failed to scrape X profile",
      };
    }

    const markdown = result.markdown || "";
    const rawPosts = extractTweetsFromMarkdown(markdown, username);

    const filteredPosts: SocialPost[] = [];
    
    for (const post of rawPosts) {
      const matched = matchKeywords(post.content, keywords);
      if (matched.length > 0 || keywords.length === 0) {
        post.matchedKeywords = matched;
        filteredPosts.push(post);
      }
    }

    return {
      success: true,
      posts: filteredPosts,
    };
  } catch (error) {
    console.error(`Error fetching posts for @${username}:`, error);
    return {
      success: false,
      posts: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function syncAccountPosts(accountId: string): Promise<{ added: number; error?: string }> {
  try {
    const account = await storage.getTrackedSocialAccount(accountId);
    if (!account) {
      return { added: 0, error: "Account not found" };
    }

    const keywords = await storage.getSocialTrackingKeywordsForAccount(accountId);
    const globalKeywords = (await storage.getSocialTrackingKeywords(account.clientId))
      .filter(k => !k.accountId);
    
    const allKeywords = [
      ...keywords.map(k => k.keyword),
      ...globalKeywords.map(k => k.keyword),
    ];

    const result = await fetchAccountPosts(accountId, account.username, allKeywords);

    if (!result.success) {
      await storage.updateTrackedSocialAccount(accountId, {
        lastSyncError: result.error,
      });
      return { added: 0, error: result.error };
    }

    let added = 0;
    for (const post of result.posts) {
      const exists = await storage.socialPostExists(post.postId, accountId);
      if (!exists) {
        await storage.createTrackedSocialPost({
          clientId: account.clientId,
          accountId,
          postId: post.postId,
          content: post.content,
          postUrl: post.postUrl,
          postedAt: post.postedAt,
          matchedKeywords: post.matchedKeywords,
          isRead: false,
          isFlagged: false,
        });
        added++;
      }
    }

    await storage.updateTrackedSocialAccount(accountId, {
      lastSyncAt: new Date(),
      lastSyncError: null,
    });

    return { added };
  } catch (error) {
    console.error(`Error syncing account ${accountId}:`, error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { added: 0, error: errorMsg };
  }
}

export async function syncAllClientAccounts(clientId: string): Promise<{ 
  synced: number; 
  added: number;
  errors: string[];
}> {
  const accounts = await storage.getTrackedSocialAccounts(clientId);
  let totalAdded = 0;
  let synced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    if (!account.isActive) continue;
    
    const result = await syncAccountPosts(account.id);
    if (result.error) {
      errors.push(`@${account.username}: ${result.error}`);
    } else {
      totalAdded += result.added;
      synced++;
    }
  }

  return { synced, added: totalAdded, errors };
}
