import FirecrawlApp from "@mendable/firecrawl-js";
import { storage } from "../storage";
import crypto from "crypto";

const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });

export interface SocialPost {
  postId: string;
  content: string;
  authorUsername: string;
  authorDisplayName?: string;
  postUrl: string;
  postedAt: Date | null;
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

function generateContentHash(content: string, username: string): string {
  const normalized = content.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 500);
  return crypto.createHash('md5').update(`${username}:${normalized}`).digest('hex').substring(0, 16);
}

function extractTweetsFromMarkdown(markdown: string, username: string): SocialPost[] {
  const posts: SocialPost[] = [];
  
  const statusUrlPattern = /https:\/\/(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/gi;
  const statusMatches = [...markdown.matchAll(statusUrlPattern)];
  
  for (const match of statusMatches) {
    const statusId = match[2];
    const urlIndex = match.index!;
    
    const existingPost = posts.find(p => p.postId === statusId);
    if (existingPost) continue;
    
    let startIndex = Math.max(0, urlIndex - 1500);
    let endIndex = Math.min(markdown.length, urlIndex + 100);
    
    const beforeUrl = markdown.substring(startIndex, urlIndex);
    const paragraphs = beforeUrl.split(/\n\n+/);
    const lastParagraph = paragraphs[paragraphs.length - 1] || "";
    
    let content = lastParagraph
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    content = content.replace(/https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+/g, '').trim();
    
    if (content.length < 10) continue;
    if (content.length > 500) {
      content = content.substring(content.length - 500);
    }
    
    posts.push({
      postId: statusId,
      content,
      authorUsername: username,
      postUrl: `https://x.com/${username}/status/${statusId}`,
      postedAt: null,
      matchedKeywords: [],
    });
  }
  
  if (posts.length === 0) {
    const tweetBlocks = markdown.split(/(?=^##|\n##)/gm).filter(block => block.trim());
    
    for (const block of tweetBlocks) {
      const content = block
        .replace(/^#+\s*/gm, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\*\*/g, '')
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/\d+\s*(likes?|retweets?|reposts?|replies)/gi, '')
        .replace(/\d+[hms]\s*ago/gi, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (content.length < 20 || content.length > 600) continue;
      
      const contentHash = generateContentHash(content, username);
      
      posts.push({
        postId: `hash-${contentHash}`,
        content,
        authorUsername: username,
        postUrl: `https://x.com/${username}`,
        postedAt: null,
        matchedKeywords: [],
      });
    }
  }
  
  return posts.slice(0, 20);
}

function matchKeywords(content: string, keywords: string[]): string[] {
  if (keywords.length === 0) return [];
  const lowerContent = content.toLowerCase();
  return keywords.filter(kw => {
    const lowerKw = kw.toLowerCase();
    const regex = new RegExp(`\\b${lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerContent) || lowerContent.includes(lowerKw);
  });
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

export async function syncAccountPosts(accountId: string): Promise<{ added: number; alerts: number; error?: string }> {
  try {
    const account = await storage.getTrackedSocialAccount(accountId);
    if (!account) {
      return { added: 0, alerts: 0, error: "Account not found" };
    }

    const keywords = await storage.getSocialTrackingKeywordsForAccount(accountId);
    const globalKeywords = (await storage.getSocialTrackingKeywords(account.clientId))
      .filter(k => !k.accountId);
    
    const allKeywordRecords = [...keywords, ...globalKeywords];
    const allKeywords = allKeywordRecords.map(k => k.keyword);

    const result = await fetchAccountPosts(accountId, account.username, allKeywords);

    if (!result.success) {
      await storage.updateTrackedSocialAccount(accountId, {
        lastSyncError: result.error || "Unknown error",
      });
      return { added: 0, alerts: 0, error: result.error };
    }

    let added = 0;
    let alertsCreated = 0;
    let totalLikes = 0;
    let totalReposts = 0;
    let totalReplies = 0;

    for (const post of result.posts) {
      totalLikes += post.likeCount || 0;
      totalReposts += post.repostCount || 0;
      totalReplies += post.replyCount || 0;

      const exists = await storage.socialPostExists(post.postId, accountId);
      if (!exists) {
        const newPost = await storage.createTrackedSocialPost({
          clientId: account.clientId,
          accountId,
          postId: post.postId,
          content: post.content,
          postUrl: post.postUrl,
          postedAt: post.postedAt,
          matchedKeywords: post.matchedKeywords,
          likes: post.likeCount || 0,
          reposts: post.repostCount || 0,
          replies: post.replyCount || 0,
          isRead: false,
          isFlagged: false,
        });
        added++;

        // Generate keyword alerts for new posts with matched keywords
        if (post.matchedKeywords.length > 0) {
          for (const matchedKw of post.matchedKeywords) {
            const keywordRecord = allKeywordRecords.find(
              k => k.keyword.toLowerCase() === matchedKw.toLowerCase()
            );
            if (keywordRecord) {
              await storage.createSocialKeywordAlert({
                clientId: account.clientId,
                keywordId: keywordRecord.id,
                postId: newPost.id,
                matchedKeyword: matchedKw,
                postContent: post.content.substring(0, 500),
                authorUsername: post.authorUsername,
                postUrl: post.postUrl,
              });
              alertsCreated++;
            }
          }
        }
      }
    }

    // Record engagement history for this sync
    await storage.createSocialEngagementRecord({
      clientId: account.clientId,
      accountId,
      likes: totalLikes,
      reposts: totalReposts,
      replies: totalReplies,
    });

    await storage.updateTrackedSocialAccount(accountId, {
      lastSyncAt: new Date(),
      lastSyncError: null,
    });

    return { added, alerts: alertsCreated };
  } catch (error) {
    console.error(`Error syncing account ${accountId}:`, error);
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return { added: 0, alerts: 0, error: errorMsg };
  }
}

export async function syncAllClientAccounts(clientId: string): Promise<{ 
  synced: number; 
  added: number;
  alerts: number;
  errors: string[];
}> {
  const accounts = await storage.getTrackedSocialAccounts(clientId);
  let totalAdded = 0;
  let totalAlerts = 0;
  let synced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    if (!account.isActive) continue;
    
    const result = await syncAccountPosts(account.id);
    if (result.error) {
      errors.push(`@${account.username}: ${result.error}`);
    } else {
      totalAdded += result.added;
      totalAlerts += result.alerts;
      synced++;
    }
  }

  return { synced, added: totalAdded, alerts: totalAlerts, errors };
}

// Auto-sync function to be called by scheduler
export async function runAutoSync(): Promise<void> {
  try {
    const dueConfigs = await storage.getAutoSyncDueClients();
    
    for (const config of dueConfigs) {
      console.log(`Running auto-sync for client ${config.clientId}`);
      const result = await syncAllClientAccounts(config.clientId);
      console.log(`Auto-sync complete: ${result.synced} accounts, ${result.added} posts, ${result.alerts} alerts`);
      
      // Update next scheduled sync
      const nextSync = new Date(Date.now() + (config.syncIntervalMinutes || 60) * 60 * 1000);
      await storage.createOrUpdateAutoSyncConfig(config.clientId, {
        lastAutoSyncAt: new Date(),
        nextScheduledSync: nextSync,
      });
    }
  } catch (error) {
    console.error("Error running auto-sync:", error);
  }
}
