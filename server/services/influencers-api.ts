const INFLUENCERS_API_BASE = "https://api-dashboard.influencers.club";

export type InfluencerPlatform = "instagram" | "youtube" | "tiktok" | "twitter" | "twitch" | "onlyfans";

export interface EnrichmentResponse {
  success: boolean;
  data?: {
    username?: string;
    full_name?: string;
    biography?: string;
    follower_count?: number;
    following_count?: number;
    media_count?: number;
    profile_picture?: string;
    is_verified?: boolean;
    engagement_percent?: number;
    location?: string;
    email?: string;
    avg_likes?: number;
    avg_comments?: number;
    posts?: PostData[];
    [key: string]: any;
  };
  error?: string;
}

export interface PostData {
  id?: string;
  post_id?: string;
  caption?: string;
  content?: string;
  media_type?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  engagement_rate?: number;
  hashtags?: string[];
  posted_at?: string;
  post_url?: string;
  [key: string]: any;
}

export async function enrichByHandle(
  username: string,
  platform: InfluencerPlatform,
  mode: "raw" | "full" = "raw"
): Promise<EnrichmentResponse> {
  const apiKey = process.env.INFLUENCERS_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "Influencers Club API key not configured" };
  }

  try {
    const response = await fetch(`${INFLUENCERS_API_BASE}/public/v1/enrichment/handle/${mode}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        handle: username,
        platform: platform,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Influencers API error: ${response.status} - ${errorText}`);
      
      if (response.status === 403) {
        return { success: false, error: "API access denied - check your API key" };
      }
      if (response.status === 429) {
        return { success: false, error: "Rate limit exceeded - please try again later" };
      }
      if (response.status === 404) {
        return { success: false, error: "Creator not found on this platform" };
      }
      
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Influencers API request failed:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function getPostData(postUrl: string): Promise<EnrichmentResponse> {
  const apiKey = process.env.INFLUENCERS_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "Influencers Club API key not configured" };
  }

  try {
    const response = await fetch(`${INFLUENCERS_API_BASE}/public/v1/post`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ post_url: postUrl }),
    });

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error("Influencers API post request failed:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function checkCredits(): Promise<{ credits?: number; error?: string }> {
  const apiKey = process.env.INFLUENCERS_API_KEY;
  
  if (!apiKey) {
    return { error: "API key not configured" };
  }

  try {
    const response = await fetch(`${INFLUENCERS_API_BASE}/public/v1/account/credits`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return { error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { credits: data.credits || data.remaining_credits };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export function parseInfluencerData(platform: InfluencerPlatform, data: any): {
  displayName?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  profilePictureUrl?: string;
  isVerified?: boolean;
  engagementRate?: string;
  location?: string;
  email?: string;
  posts?: PostData[];
} {
  const platformData = data[platform] || data;
  
  switch (platform) {
    case "instagram":
      return {
        displayName: platformData.full_name,
        bio: platformData.biography,
        followerCount: platformData.follower_count,
        followingCount: platformData.following_count,
        postCount: platformData.media_count,
        profilePictureUrl: platformData.profile_picture,
        isVerified: platformData.is_verified,
        engagementRate: platformData.engagement_percent?.toString(),
        location: data.location?.country || data.location,
        email: data.email,
        posts: platformData.posts || [],
      };
      
    case "youtube":
      return {
        displayName: platformData.title,
        bio: platformData.description,
        followerCount: platformData.subscriber_count,
        postCount: platformData.video_count,
        profilePictureUrl: platformData.profile_picture,
        isVerified: false,
        engagementRate: platformData.engagement_percent?.toString(),
        location: data.location?.country || data.location,
        email: data.email,
        posts: platformData.videos || [],
      };
      
    case "tiktok":
      return {
        displayName: platformData.nickname || platformData.display_name,
        bio: platformData.bio || platformData.signature,
        followerCount: platformData.follower_count || platformData.fans,
        followingCount: platformData.following_count,
        postCount: platformData.video_count,
        profilePictureUrl: platformData.avatar || platformData.profile_picture,
        isVerified: platformData.verified || false,
        engagementRate: platformData.engagement_percent?.toString(),
        location: data.location?.country || data.location,
        email: data.email,
        posts: platformData.videos || [],
      };
      
    case "twitter":
      return {
        displayName: platformData.name || platformData.display_name,
        bio: platformData.bio || platformData.description,
        followerCount: platformData.follower_count || platformData.followers_count,
        followingCount: platformData.following_count || platformData.friends_count,
        postCount: platformData.tweet_count || platformData.statuses_count,
        profilePictureUrl: platformData.profile_image_url || platformData.profile_picture,
        isVerified: platformData.verified || false,
        engagementRate: platformData.engagement_percent?.toString(),
        location: platformData.location || data.location?.country,
        email: data.email,
        posts: platformData.tweets || [],
      };
      
    case "twitch":
      return {
        displayName: platformData.display_name,
        bio: platformData.description,
        followerCount: platformData.follower_count,
        profilePictureUrl: platformData.profile_image_url,
        isVerified: platformData.is_partner || false,
        engagementRate: platformData.avg_viewers?.toString(),
        location: data.location?.country || data.location,
        email: data.email,
      };
      
    default:
      return {
        displayName: platformData.full_name || platformData.display_name || platformData.name,
        bio: platformData.biography || platformData.bio || platformData.description,
        followerCount: platformData.follower_count || platformData.followers,
        followingCount: platformData.following_count,
        profilePictureUrl: platformData.profile_picture || platformData.avatar,
        isVerified: platformData.is_verified || platformData.verified || false,
        engagementRate: platformData.engagement_percent?.toString(),
        location: data.location?.country || data.location,
        email: data.email,
      };
  }
}

export function getPlatformProfileUrl(platform: InfluencerPlatform, username: string): string {
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${username}`;
    case "youtube":
      return `https://youtube.com/@${username}`;
    case "tiktok":
      return `https://tiktok.com/@${username}`;
    case "twitter":
      return `https://x.com/${username}`;
    case "twitch":
      return `https://twitch.tv/${username}`;
    case "onlyfans":
      return `https://onlyfans.com/${username}`;
    default:
      return "";
  }
}
