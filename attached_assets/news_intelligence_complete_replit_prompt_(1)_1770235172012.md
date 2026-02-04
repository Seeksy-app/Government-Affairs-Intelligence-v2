# COMPLETE NEWS INTELLIGENCE SYSTEM - REPLIT IMPLEMENTATION PROMPT

Build a comprehensive, personalized news intelligence feed that automatically surfaces articles relevant to users' tracked bills, researched staffers, and client topics. This system aggregates news from multiple free sources, scores articles by relevance, and presents them in an interactive UI with research connections.

---

## OVERVIEW

Transform the generic news feed into an intelligent political intelligence system that:
- Aggregates news from 10+ free sources (Congress.gov, RSS feeds, NewsAPI, FireCrawl)
- Scores each article based on relevance to user's research (0-100 score)
- Automatically connects articles to tracked bills and monitored staffers
- Provides real-time alerts for high-relevance news
- Offers enhanced search with smart suggestions
- Includes "Ask AI" integration for instant analysis

---

## PART 1: DATABASE SCHEMA

### Create News Tables

```sql
-- News articles table
CREATE TABLE news_articles (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE, -- Source's article ID
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT NOT NULL,
  source VARCHAR(100) NOT NULL, -- 'congress_gov', 'politico', 'the_hill', etc.
  author VARCHAR(255),
  published_date TIMESTAMP NOT NULL,
  category VARCHAR(50), -- 'executive', 'legislation', 'policy', 'campaign'
  image_url TEXT,
  raw_data JSONB, -- Store original API response
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- News relevance scores (per user or client)
CREATE TABLE news_relevance_scores (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES firm_users(id),
  firm_client_id INTEGER REFERENCES firm_clients(id),
  relevance_score INTEGER DEFAULT 0, -- 0-100
  matched_bills JSONB, -- Array of matched bill IDs
  matched_staffers JSONB, -- Array of matched staffer IDs
  matched_topics JSONB, -- Array of matched topics
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(article_id, user_id, firm_client_id)
);

-- User news preferences
CREATE TABLE news_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES firm_users(id),
  firm_client_id INTEGER REFERENCES firm_clients(id),
  preferred_sources JSONB, -- Array of source names
  excluded_sources JSONB, -- Sources to exclude
  alert_threshold INTEGER DEFAULT 70, -- Minimum score for alerts
  email_alerts BOOLEAN DEFAULT TRUE,
  alert_frequency VARCHAR(20) DEFAULT 'real_time', -- 'real_time', 'daily', 'weekly'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, firm_client_id)
);

-- Bookmarked articles
CREATE TABLE bookmarked_articles (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES firm_users(id),
  firm_client_id INTEGER REFERENCES firm_clients(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(article_id, user_id)
);

-- News alerts sent
CREATE TABLE news_alerts_sent (
  id SERIAL PRIMARY KEY,
  article_id INTEGER REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES firm_users(id),
  firm_client_id INTEGER REFERENCES firm_clients(id),
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_news_published ON news_articles(published_date DESC);
CREATE INDEX idx_news_source ON news_articles(source);
CREATE INDEX idx_news_category ON news_articles(category);
CREATE INDEX idx_relevance_user ON news_relevance_scores(user_id, relevance_score DESC);
CREATE INDEX idx_relevance_client ON news_relevance_scores(firm_client_id, relevance_score DESC);
CREATE INDEX idx_bookmarks_user ON bookmarked_articles(user_id);
```

---

## PART 2: NEWS AGGREGATION SERVICE

### File: `/backend/services/news_aggregation.js`

```javascript
const Parser = require('rss-parser');
const axios = require('axios');

class NewsAggregationService {
  constructor() {
    this.rssParser = new Parser({
      customFields: {
        item: ['media:content', 'media:thumbnail']
      }
    });
    
    this.sources = {
      // RSS Feeds (FREE - No API key needed)
      rss: {
        politico: 'https://www.politico.com/rss/politics08.xml',
        theHill: 'https://thehill.com/feed/',
        rollCall: 'https://www.rollcall.com/feed/',
        defenseDept: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945',
        militaryTimes: 'https://www.militarytimes.com/arc/outboundfeeds/rss/',
        brookings: 'https://www.brookings.edu/feed/',
        csis: 'https://www.csis.org/rss'
      },
      
      // API sources
      apis: {
        congressGov: 'https://api.congress.gov/v3',
        federalRegister: 'https://www.federalregister.gov/api/v1',
        newsApi: 'https://newsapi.org/v2',
        gNews: 'https://gnews.io/api/v4'
      }
    };
  }
  
  // Main aggregation function - fetches from all sources
  async aggregateAllNews(hoursBack = 24) {
    const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    console.log(`Aggregating news from last ${hoursBack} hours...`);
    
    const [
      rssArticles,
      congressArticles,
      federalRegisterArticles,
      newsApiArticles,
      gNewsArticles
    ] = await Promise.all([
      this.fetchRSSFeeds(cutoffDate),
      this.fetchCongressGov(cutoffDate),
      this.fetchFederalRegister(cutoffDate),
      this.fetchNewsAPI(cutoffDate),
      this.fetchGNews(cutoffDate)
    ]);
    
    // Combine all articles
    let allArticles = [
      ...rssArticles,
      ...congressArticles,
      ...federalRegisterArticles,
      ...newsApiArticles,
      ...gNewsArticles
    ];
    
    // Deduplicate based on title similarity
    allArticles = this.deduplicateArticles(allArticles);
    
    // Save to database
    await this.saveArticles(allArticles);
    
    console.log(`Aggregated ${allArticles.length} unique articles`);
    
    return allArticles;
  }
  
  // Fetch from all RSS feeds
  async fetchRSSFeeds(cutoffDate) {
    const articles = [];
    
    for (const [sourceName, feedUrl] of Object.entries(this.sources.rss)) {
      try {
        console.log(`Fetching RSS: ${sourceName}...`);
        const feed = await this.rssParser.parseURL(feedUrl);
        
        for (const item of feed.items) {
          const pubDate = new Date(item.pubDate || item.isoDate);
          
          if (pubDate >= cutoffDate) {
            articles.push({
              external_id: item.guid || item.link,
              title: item.title,
              description: item.contentSnippet || item.description,
              content: item.content || item['content:encoded'] || '',
              url: item.link,
              source: sourceName,
              author: item.creator || item.author,
              published_date: pubDate,
              category: this.categorizeArticle(item.title, item.contentSnippet),
              image_url: item['media:content']?.$?.url || item['media:thumbnail']?.$?.url,
              raw_data: item
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching RSS ${sourceName}:`, error.message);
      }
    }
    
    return articles;
  }
  
  // Fetch from Congress.gov API
  async fetchCongressGov(cutoffDate) {
    const articles = [];
    const apiKey = process.env.CONGRESS_GOV_API_KEY;
    
    if (!apiKey) {
      console.log('Congress.gov API key not found, skipping...');
      return articles;
    }
    
    try {
      console.log('Fetching Congress.gov...');
      
      // Get recent bills
      const billsResponse = await axios.get(
        `${this.sources.apis.congressGov}/bill?format=json&limit=50&api_key=${apiKey}`
      );
      
      for (const bill of billsResponse.data.bills || []) {
        const updateDate = new Date(bill.updateDate);
        
        if (updateDate >= cutoffDate) {
          articles.push({
            external_id: `congress_${bill.number}`,
            title: `${bill.number}: ${bill.title}`,
            description: bill.latestAction?.text || 'No description available',
            content: bill.summary?.text || '',
            url: bill.url,
            source: 'congress_gov',
            author: bill.sponsors?.[0]?.fullName,
            published_date: updateDate,
            category: 'legislation',
            raw_data: bill
          });
        }
      }
      
      // Get recent committee reports
      const reportsResponse = await axios.get(
        `${this.sources.apis.congressGov}/committee-report?format=json&limit=20&api_key=${apiKey}`
      );
      
      for (const report of reportsResponse.data.reports || []) {
        const updateDate = new Date(report.updateDate);
        
        if (updateDate >= cutoffDate) {
          articles.push({
            external_id: `congress_report_${report.number}`,
            title: `Committee Report: ${report.title}`,
            description: report.text,
            content: '',
            url: report.url,
            source: 'congress_gov',
            published_date: updateDate,
            category: 'legislation',
            raw_data: report
          });
        }
      }
    } catch (error) {
      console.error('Error fetching Congress.gov:', error.message);
    }
    
    return articles;
  }
  
  // Fetch from Federal Register API
  async fetchFederalRegister(cutoffDate) {
    const articles = [];
    
    try {
      console.log('Fetching Federal Register...');
      
      const response = await axios.get(
        `${this.sources.apis.federalRegister}/documents.json`,
        {
          params: {
            per_page: 50,
            order: 'newest',
            conditions: {
              publication_date: {
                gte: cutoffDate.toISOString().split('T')[0]
              }
            }
          }
        }
      );
      
      for (const doc of response.data.results || []) {
        articles.push({
          external_id: `fedreg_${doc.document_number}`,
          title: doc.title,
          description: doc.abstract,
          content: doc.full_text_xml_url ? `Full text: ${doc.full_text_xml_url}` : '',
          url: doc.html_url,
          source: 'federal_register',
          author: doc.agencies?.[0]?.name,
          published_date: new Date(doc.publication_date),
          category: 'executive',
          raw_data: doc
        });
      }
    } catch (error) {
      console.error('Error fetching Federal Register:', error.message);
    }
    
    return articles;
  }
  
  // Fetch from NewsAPI
  async fetchNewsAPI(cutoffDate) {
    const articles = [];
    const apiKey = process.env.NEWS_API_KEY;
    
    if (!apiKey) {
      console.log('NewsAPI key not found, skipping...');
      return articles;
    }
    
    try {
      console.log('Fetching NewsAPI...');
      
      const response = await axios.get(
        `${this.sources.apis.newsApi}/everything`,
        {
          params: {
            q: 'congress OR senate OR house OR pentagon OR defense',
            from: cutoffDate.toISOString(),
            sortBy: 'publishedAt',
            language: 'en',
            pageSize: 50,
            apiKey: apiKey
          }
        }
      );
      
      for (const article of response.data.articles || []) {
        articles.push({
          external_id: `newsapi_${article.url}`,
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          source: this.normalizeSource(article.source.name),
          author: article.author,
          published_date: new Date(article.publishedAt),
          category: this.categorizeArticle(article.title, article.description),
          image_url: article.urlToImage,
          raw_data: article
        });
      }
    } catch (error) {
      console.error('Error fetching NewsAPI:', error.message);
    }
    
    return articles;
  }
  
  // Fetch from GNews API
  async fetchGNews(cutoffDate) {
    const articles = [];
    const apiKey = process.env.GNEWS_API_KEY;
    
    if (!apiKey) {
      console.log('GNews API key not found, skipping...');
      return articles;
    }
    
    try {
      console.log('Fetching GNews...');
      
      const response = await axios.get(
        `${this.sources.apis.gNews}/search`,
        {
          params: {
            q: 'congress OR defense policy',
            lang: 'en',
            country: 'us',
            max: 50,
            token: apiKey
          }
        }
      );
      
      for (const article of response.data.articles || []) {
        const pubDate = new Date(article.publishedAt);
        
        if (pubDate >= cutoffDate) {
          articles.push({
            external_id: `gnews_${article.url}`,
            title: article.title,
            description: article.description,
            content: article.content,
            url: article.url,
            source: this.normalizeSource(article.source.name),
            author: article.source.name,
            published_date: pubDate,
            category: this.categorizeArticle(article.title, article.description),
            image_url: article.image,
            raw_data: article
          });
        }
      }
    } catch (error) {
      console.error('Error fetching GNews:', error.message);
    }
    
    return articles;
  }
  
  // Categorize article based on content
  categorizeArticle(title, description) {
    const text = `${title} ${description}`.toLowerCase();
    
    if (text.match(/white house|president|executive order|administration/i)) {
      return 'executive';
    }
    if (text.match(/bill|legislation|congress|senate|house|vote|amendment/i)) {
      return 'legislation';
    }
    if (text.match(/campaign|election|candidate|poll|primary/i)) {
      return 'campaign';
    }
    return 'policy';
  }
  
  // Normalize source names
  normalizeSource(sourceName) {
    const sourceMap = {
      'Politico': 'politico',
      'The Hill': 'the_hill',
      'Roll Call': 'roll_call',
      'Reuters': 'reuters',
      'Associated Press': 'ap',
      'CNN': 'cnn',
      'Fox News': 'fox_news'
    };
    
    return sourceMap[sourceName] || sourceName.toLowerCase().replace(/\s+/g, '_');
  }
  
  // Deduplicate articles based on title similarity
  deduplicateArticles(articles) {
    const seen = new Map();
    const unique = [];
    
    for (const article of articles) {
      // Create fingerprint from title
      const fingerprint = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3) // Ignore short words
        .sort()
        .join(' ');
      
      if (!seen.has(fingerprint)) {
        seen.set(fingerprint, true);
        unique.push(article);
      }
    }
    
    return unique;
  }
  
  // Save articles to database
  async saveArticles(articles) {
    const db = require('../db');
    
    for (const article of articles) {
      try {
        await db.query(
          `INSERT INTO news_articles 
           (external_id, title, description, content, url, source, author, 
            published_date, category, image_url, raw_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (external_id) DO UPDATE
           SET title = $2, description = $3, content = $4, updated_at = NOW()`,
          [
            article.external_id,
            article.title,
            article.description,
            article.content,
            article.url,
            article.source,
            article.author,
            article.published_date,
            article.category,
            article.image_url,
            article.raw_data
          ]
        );
      } catch (error) {
        console.error(`Error saving article ${article.title}:`, error.message);
      }
    }
  }
}

module.exports = NewsAggregationService;
```

---

## PART 3: NEWS INTELLIGENCE SERVICE (Relevance Scoring)

### File: `/backend/services/news_intelligence.js`

```javascript
class NewsIntelligenceService {
  // Calculate relevance score for an article
  async scoreArticle(articleId, userId, firmClientId = null) {
    const db = require('../db');
    
    // Get article content
    const articleResult = await db.query(
      `SELECT * FROM news_articles WHERE id = $1`,
      [articleId]
    );
    
    if (articleResult.rows.length === 0) return null;
    
    const article = articleResult.rows[0];
    const searchText = `${article.title} ${article.description} ${article.content}`.toLowerCase();
    
    let score = 0;
    const matchedBills = [];
    const matchedStaffers = [];
    const matchedTopics = [];
    
    // Get user context
    const context = await this.getUserContext(userId, firmClientId);
    
    // 1. Check tracked bills (30 points max)
    for (const bill of context.trackedBills) {
      if (searchText.includes(bill.bill_number.toLowerCase()) ||
          searchText.includes(bill.bill_title?.toLowerCase())) {
        score += 30;
        matchedBills.push(bill.id);
        break; // Only count once
      }
    }
    
    // 2. Check researched staffers (25 points max)
    for (const staffer of context.researchedStaffers) {
      if (searchText.includes(staffer.name.toLowerCase())) {
        score += 25;
        matchedStaffers.push(staffer.id);
        break;
      }
    }
    
    // 3. Check client topics (20 points max)
    for (const topic of context.clientTopics) {
      if (searchText.includes(topic.toLowerCase())) {
        score += 20;
        matchedTopics.push(topic);
        break;
      }
    }
    
    // 4. Check recent AI queries (15 points max)
    for (const query of context.recentQueries) {
      const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
      const matchCount = queryTerms.filter(term => searchText.includes(term)).length;
      
      if (matchCount >= 3) {
        score += 15;
        break;
      }
    }
    
    // 5. Source credibility (5 points)
    const credibleSources = ['congress_gov', 'federal_register', 'reuters', 'ap', 'defense_dept'];
    if (credibleSources.includes(article.source)) {
      score += 5;
    }
    
    // 6. Recency (5 points)
    const hoursOld = (Date.now() - new Date(article.published_date)) / (1000 * 60 * 60);
    if (hoursOld < 24) score += 5;
    else if (hoursOld < 48) score += 3;
    else if (hoursOld < 72) score += 1;
    
    // Save score
    await db.query(
      `INSERT INTO news_relevance_scores 
       (article_id, user_id, firm_client_id, relevance_score, matched_bills, matched_staffers, matched_topics)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (article_id, user_id, firm_client_id) 
       DO UPDATE SET 
         relevance_score = $4,
         matched_bills = $5,
         matched_staffers = $6,
         matched_topics = $7,
         calculated_at = NOW()`,
      [
        articleId,
        userId,
        firmClientId,
        Math.min(score, 100),
        JSON.stringify(matchedBills),
        JSON.stringify(matchedStaffers),
        JSON.stringify(matchedTopics)
      ]
    );
    
    return {
      score: Math.min(score, 100),
      matchedBills,
      matchedStaffers,
      matchedTopics
    };
  }
  
  // Get user research context
  async getUserContext(userId, firmClientId) {
    const db = require('../db');
    
    // Get tracked bills
    const billsResult = await db.query(
      `SELECT id, bill_number, bill_title FROM tracked_bills 
       WHERE ${firmClientId ? 'firm_client_id = $1' : 'user_id = $1'}
       LIMIT 50`,
      [firmClientId || userId]
    );
    
    // Get researched staffers (from AI chat history)
    const staffersResult = await db.query(
      `SELECT DISTINCT s.id, s.name 
       FROM staffers s
       WHERE s.id IN (
         SELECT DISTINCT unnest(
           string_to_array(
             regexp_replace(am.results_data::text, '[^0-9,]', '', 'g'), 
             ','
           )::int[]
         )
         FROM ai_messages am
         JOIN ai_conversations ac ON am.conversation_id = ac.conversation_id
         WHERE ${firmClientId ? 'ac.firm_client_id = $1' : 'ac.firm_user_id = $1'}
         AND am.results_data IS NOT NULL
       )
       LIMIT 50`,
      [firmClientId || userId]
    );
    
    // Get client topics
    let clientTopics = [];
    if (firmClientId) {
      const topicsResult = await db.query(
        `SELECT tracked_topics FROM firm_clients WHERE id = $1`,
        [firmClientId]
      );
      clientTopics = topicsResult.rows[0]?.tracked_topics || [];
    }
    
    // Get recent AI queries
    const queriesResult = await db.query(
      `SELECT content FROM ai_messages 
       WHERE role = 'user'
       AND conversation_id IN (
         SELECT conversation_id FROM ai_conversations 
         WHERE ${firmClientId ? 'firm_client_id = $1' : 'firm_user_id = $1'}
       )
       ORDER BY created_at DESC
       LIMIT 20`,
      [firmClientId || userId]
    );
    
    return {
      trackedBills: billsResult.rows,
      researchedStaffers: staffersResult.rows,
      clientTopics: clientTopics,
      recentQueries: queriesResult.rows.map(r => r.content)
    };
  }
  
  // Get personalized news feed
  async getPersonalizedFeed(userId, firmClientId = null, options = {}) {
    const db = require('../db');
    const {
      filter = 'all', // 'all', 'high-relevance', 'bills', 'staffers'
      limit = 50,
      offset = 0,
      minScore = 0
    } = options;
    
    let sql = `
      SELECT 
        na.*,
        nrs.relevance_score,
        nrs.matched_bills,
        nrs.matched_staffers,
        nrs.matched_topics,
        EXISTS(SELECT 1 FROM bookmarked_articles WHERE article_id = na.id AND user_id = $1) as is_bookmarked
      FROM news_articles na
      LEFT JOIN news_relevance_scores nrs ON 
        na.id = nrs.article_id AND 
        nrs.user_id = $1 AND 
        ${firmClientId ? 'nrs.firm_client_id = $2' : 'nrs.firm_client_id IS NULL'}
      WHERE na.published_date >= NOW() - INTERVAL '7 days'
    `;
    
    const params = [userId];
    if (firmClientId) params.push(firmClientId);
    
    // Apply filters
    if (filter === 'high-relevance') {
      sql += ` AND nrs.relevance_score >= 50`;
    } else if (filter === 'bills') {
      sql += ` AND nrs.matched_bills IS NOT NULL AND nrs.matched_bills::text != '[]'`;
    } else if (filter === 'staffers') {
      sql += ` AND nrs.matched_staffers IS NOT NULL AND nrs.matched_staffers::text != '[]'`;
    }
    
    if (minScore > 0) {
      sql += ` AND COALESCE(nrs.relevance_score, 0) >= ${minScore}`;
    }
    
    sql += `
      ORDER BY 
        COALESCE(nrs.relevance_score, 0) DESC,
        na.published_date DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;
    
    params.push(limit, offset);
    
    const result = await db.query(sql, params);
    
    // Enrich with matched entities
    for (const article of result.rows) {
      if (article.matched_bills && article.matched_bills.length > 0) {
        const billsResult = await db.query(
          `SELECT id, bill_number, bill_title FROM tracked_bills WHERE id = ANY($1)`,
          [article.matched_bills]
        );
        article.matched_bills_data = billsResult.rows;
      }
      
      if (article.matched_staffers && article.matched_staffers.length > 0) {
        const staffersResult = await db.query(
          `SELECT id, name, current_position, current_organization FROM staffers WHERE id = ANY($1)`,
          [article.matched_staffers]
        );
        article.matched_staffers_data = staffersResult.rows;
      }
    }
    
    return result.rows;
  }
  
  // Score all recent articles for a user
  async scoreAllArticlesForUser(userId, firmClientId = null) {
    const db = require('../db');
    
    // Get recent articles that haven't been scored
    const articlesResult = await db.query(
      `SELECT id FROM news_articles 
       WHERE published_date >= NOW() - INTERVAL '7 days'
       AND id NOT IN (
         SELECT article_id FROM news_relevance_scores 
         WHERE user_id = $1 ${firmClientId ? 'AND firm_client_id = $2' : ''}
       )`,
      firmClientId ? [userId, firmClientId] : [userId]
    );
    
    console.log(`Scoring ${articlesResult.rows.length} articles for user ${userId}...`);
    
    for (const { id } of articlesResult.rows) {
      await this.scoreArticle(id, userId, firmClientId);
    }
    
    console.log('Scoring complete');
  }
}

module.exports = NewsIntelligenceService;
```

---

## PART 4: NEWS ALERTS SERVICE

### File: `/backend/services/news_alerts.js`

```javascript
class NewsAlertsService {
  async checkAndSendAlerts() {
    const db = require('../db');
    
    // Get all users with alerts enabled
    const usersResult = await db.query(
      `SELECT DISTINCT 
        fu.id as user_id, 
        fu.email,
        fc.id as firm_client_id,
        np.alert_threshold,
        np.alert_frequency
       FROM firm_users fu
       LEFT JOIN firm_clients fc ON fc.firm_id = fu.firm_id
       LEFT JOIN news_preferences np ON np.user_id = fu.id
       WHERE COALESCE(np.email_alerts, TRUE) = TRUE`
    );
    
    for (const user of usersResult.rows) {
      await this.checkUserAlerts(user);
    }
  }
  
  async checkUserAlerts(user) {
    const db = require('../db');
    const threshold = user.alert_threshold || 70;
    
    // Get high-relevance articles not yet alerted
    const articlesResult = await db.query(
      `SELECT na.*, nrs.relevance_score
       FROM news_articles na
       JOIN news_relevance_scores nrs ON na.id = nrs.article_id
       WHERE nrs.user_id = $1
       AND ${user.firm_client_id ? 'nrs.firm_client_id = $2' : 'nrs.firm_client_id IS NULL'}
       AND nrs.relevance_score >= $${user.firm_client_id ? 3 : 2}
       AND na.published_date >= NOW() - INTERVAL '1 hour'
       AND NOT EXISTS (
         SELECT 1 FROM news_alerts_sent 
         WHERE article_id = na.id 
         AND user_id = $1
       )
       ORDER BY nrs.relevance_score DESC
       LIMIT 5`,
      user.firm_client_id 
        ? [user.user_id, user.firm_client_id, threshold]
        : [user.user_id, threshold]
    );
    
    if (articlesResult.rows.length === 0) return;
    
    // Send alert email
    await this.sendAlertEmail(user, articlesResult.rows);
    
    // Mark as sent
    for (const article of articlesResult.rows) {
      await db.query(
        `INSERT INTO news_alerts_sent (article_id, user_id, firm_client_id)
         VALUES ($1, $2, $3)`,
        [article.id, user.user_id, user.firm_client_id]
      );
    }
  }
  
  async sendAlertEmail(user, articles) {
    const { sendEmail } = require('./email');
    
    await sendEmail({
      to: user.email,
      subject: `${articles.length} high-relevance article${articles.length > 1 ? 's' : ''} found`,
      template: 'news-alert',
      data: {
        articles: articles.map(a => ({
          title: a.title,
          url: a.url,
          source: a.source,
          relevance_score: a.relevance_score,
          published_date: a.published_date
        }))
      }
    });
  }
}

module.exports = NewsAlertsService;
```

---

## PART 5: API ROUTES

### File: `/backend/routes/news.js`

```javascript
const express = require('express');
const router = express.Router();
const NewsIntelligenceService = require('../services/news_intelligence');
const { authenticateFirmUser } = require('../middleware/auth');

router.use(authenticateFirmUser);

const newsIntelligence = new NewsIntelligenceService();

// Get personalized news feed
router.get('/personalized', async (req, res) => {
  try {
    const userId = req.user.id;
    const { client_id, filter, limit, offset } = req.query;
    
    const articles = await newsIntelligence.getPersonalizedFeed(
      userId,
      client_id ? parseInt(client_id) : null,
      {
        filter: filter || 'all',
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0
      }
    );
    
    res.json({ articles });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search news
router.post('/search', async (req, res) => {
  try {
    const { query, filters } = req.body;
    const db = require('../db');
    
    let sql = `
      SELECT na.*, nrs.relevance_score
      FROM news_articles na
      LEFT JOIN news_relevance_scores nrs ON 
        na.id = nrs.article_id AND nrs.user_id = $1
      WHERE 1=1
    `;
    
    const params = [req.user.id];
    let paramIndex = 2;
    
    if (query) {
      sql += ` AND (
        na.title ILIKE $${paramIndex} OR 
        na.description ILIKE $${paramIndex} OR
        na.content ILIKE $${paramIndex}
      )`;
      params.push(`%${query}%`);
      paramIndex++;
    }
    
    if (filters?.sources?.length > 0) {
      sql += ` AND na.source = ANY($${paramIndex})`;
      params.push(filters.sources);
      paramIndex++;
    }
    
    if (filters?.categories?.length > 0) {
      sql += ` AND na.category = ANY($${paramIndex})`;
      params.push(filters.categories);
      paramIndex++;
    }
    
    if (filters?.dateRange) {
      const ranges = {
        today: '1 day',
        week: '7 days',
        month: '30 days'
      };
      
      if (ranges[filters.dateRange]) {
        sql += ` AND na.published_date >= NOW() - INTERVAL '${ranges[filters.dateRange]}'`;
      }
    }
    
    sql += ` ORDER BY na.published_date DESC LIMIT 100`;
    
    const result = await db.query(sql, params);
    
    res.json({ articles: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get search suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    const db = require('../db');
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }
    
    const suggestions = [];
    
    // Suggest tracked bills
    const billsResult = await db.query(
      `SELECT bill_number, bill_title FROM tracked_bills 
       WHERE bill_number ILIKE $1 OR bill_title ILIKE $1
       LIMIT 5`,
      [`%${q}%`]
    );
    
    for (const bill of billsResult.rows) {
      suggestions.push({
        text: `${bill.bill_number}: ${bill.bill_title}`,
        type: 'bill'
      });
    }
    
    // Suggest staffers
    const staffersResult = await db.query(
      `SELECT name, current_position FROM staffers 
       WHERE name ILIKE $1
       LIMIT 5`,
      [`%${q}%`]
    );
    
    for (const staffer of staffersResult.rows) {
      suggestions.push({
        text: `${staffer.name} - ${staffer.current_position}`,
        type: 'staffer'
      });
    }
    
    // Suggest popular search terms
    const popularTerms = ['defense policy', 'healthcare', 'appropriations', 'veterans'];
    for (const term of popularTerms) {
      if (term.includes(q.toLowerCase())) {
        suggestions.push({
          text: term,
          type: 'topic'
        });
      }
    }
    
    res.json({ suggestions: suggestions.slice(0, 10) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bookmark article
router.post('/bookmark', async (req, res) => {
  try {
    const { article_id, notes } = req.body;
    const db = require('../db');
    
    await db.query(
      `INSERT INTO bookmarked_articles (article_id, user_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (article_id, user_id) DO UPDATE
       SET notes = $3`,
      [article_id, req.user.id, notes]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user preferences
router.get('/preferences', async (req, res) => {
  try {
    const db = require('../db');
    
    const result = await db.query(
      `SELECT * FROM news_preferences WHERE user_id = $1`,
      [req.user.id]
    );
    
    res.json({ preferences: result.rows[0] || {} });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update preferences
router.put('/preferences', async (req, res) => {
  try {
    const { preferred_sources, alert_threshold, email_alerts } = req.body;
    const db = require('../db');
    
    await db.query(
      `INSERT INTO news_preferences 
       (user_id, preferred_sources, alert_threshold, email_alerts)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, firm_client_id) DO UPDATE
       SET preferred_sources = $2, alert_threshold = $3, email_alerts = $4`,
      [req.user.id, JSON.stringify(preferred_sources), alert_threshold, email_alerts]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## PART 6: CRON JOBS

### File: `/backend/jobs/news_jobs.js`

```javascript
const cron = require('node-cron');
const NewsAggregationService = require('../services/news_aggregation');
const NewsIntelligenceService = require('../services/news_intelligence');
const NewsAlertsService = require('../services/news_alerts');

const newsAggregation = new NewsAggregationService();
const newsIntelligence = new NewsIntelligenceService();
const newsAlerts = new NewsAlertsService();

// Aggregate news every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running news aggregation...');
  try {
    await newsAggregation.aggregateAllNews(1); // Last 1 hour
    console.log('News aggregation complete');
  } catch (error) {
    console.error('News aggregation error:', error);
  }
});

// Score articles for all users every 2 hours
cron.schedule('0 */2 * * *', async () => {
  console.log('Scoring articles for all users...');
  try {
    const db = require('../db');
    
    const usersResult = await db.query(
      `SELECT DISTINCT fu.id as user_id, fc.id as firm_client_id
       FROM firm_users fu
       LEFT JOIN firm_clients fc ON fc.firm_id = fu.firm_id`
    );
    
    for (const user of usersResult.rows) {
      await newsIntelligence.scoreAllArticlesForUser(
        user.user_id, 
        user.firm_client_id
      );
    }
    
    console.log('Scoring complete');
  } catch (error) {
    console.error('Scoring error:', error);
  }
});

// Check for alerts every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('Checking for news alerts...');
  try {
    await newsAlerts.checkAndSendAlerts();
    console.log('Alert check complete');
  } catch (error) {
    console.error('Alert check error:', error);
  }
});

console.log('News jobs scheduled');
```

---

## PART 7: FRONTEND COMPONENTS

### File: `/frontend/pages/NewsPage.jsx`

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

export default function NewsPage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  useEffect(() => {
    fetchNews();
  }, [filter]);
  
  async function fetchNews() {
    setLoading(true);
    try {
      const res = await fetch(`/api/news/personalized?filter=${filter}`);
      const data = await res.json();
      setNews(data.articles);
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleSearch(query) {
    if (!query.trim()) {
      fetchNews();
      return;
    }
    
    const res = await fetch('/api/news/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const data = await res.json();
    setNews(data.articles);
  }
  
  async function getSuggestions(q) {
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const res = await fetch(`/api/news/suggestions?q=${q}`);
    const data = await res.json();
    setSuggestions(data.suggestions);
  }
  
  async function bookmarkArticle(articleId) {
    await fetch('/api/news/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ article_id: articleId })
    });
    
    // Update UI
    setNews(news.map(a => 
      a.id === articleId ? { ...a, is_bookmarked: true } : a
    ));
  }
  
  function openAIChat(article) {
    // Navigate to AI chat with pre-filled query
    window.location.href = `/ai-chat?query=${encodeURIComponent(
      `Explain how this article "${article.title}" relates to our research`
    )}`;
  }
  
  return (
    <div className="news-page">
      {/* Header */}
      <div className="news-header">
        <h1>Intelligence Feed</h1>
        <p>News personalized to your research</p>
      </div>
      
      {/* Search */}
      <div className="news-search">
        <div className="search-input-wrapper">
          <Icon name="search" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              getSuggestions(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchQuery);
                setSuggestions([]);
              }
            }}
            placeholder="Search bills, staffers, topics..."
          />
          
          {suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((s, i) => (
                <div 
                  key={i}
                  className="suggestion-item"
                  onClick={() => {
                    setSearchQuery(s.text);
                    handleSearch(s.text);
                    setSuggestions([]);
                  }}
                >
                  <Icon name={s.type === 'bill' ? 'file-text' : 'user'} size={14} />
                  <span>{s.text}</span>
                  <span className="type-badge">{s.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Filters */}
      <div className="news-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All News
        </button>
        <button
          className={`filter-btn ${filter === 'high-relevance' ? 'active' : ''}`}
          onClick={() => setFilter('high-relevance')}
        >
          <Icon name="star" size={14} />
          High Relevance
        </button>
        <button
          className={`filter-btn ${filter === 'bills' ? 'active' : ''}`}
          onClick={() => setFilter('bills')}
        >
          <Icon name="file-text" size={14} />
          Tracked Bills
        </button>
        <button
          className={`filter-btn ${filter === 'staffers' ? 'active' : ''}`}
          onClick={() => setFilter('staffers')}
        >
          <Icon name="users" size={14} />
          Monitored Staffers
        </button>
      </div>
      
      {/* News Feed */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading personalized news...</p>
        </div>
      ) : (
        <div className="news-feed">
          {news.map(article => (
            <NewsArticleCard
              key={article.id}
              article={article}
              onBookmark={bookmarkArticle}
              onAskAI={openAIChat}
            />
          ))}
          
          {news.length === 0 && (
            <div className="empty-state">
              <Icon name="inbox" size={48} />
              <h3>No articles found</h3>
              <p>Try adjusting your filters or search query</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewsArticleCard({ article, onBookmark, onAskAI }) {
  return (
    <div className="news-article-card">
      {/* Relevance badge */}
      {article.relevance_score >= 70 && (
        <div className="relevance-badge">
          <Icon name="star" size={12} />
          <span>Highly Relevant</span>
        </div>
      )}
      
      {/* Header */}
      <div className="article-header">
        <span className={`source-badge source-${article.source}`}>
          {formatSource(article.source)}
        </span>
        <span className="article-date">
          {formatDate(article.published_date)}
        </span>
        {article.category && (
          <span className={`category-badge category-${article.category}`}>
            {article.category}
          </span>
        )}
      </div>
      
      {/* Title */}
      <h3 className="article-title">
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {article.title}
          <Icon name="external-link" size={14} />
        </a>
      </h3>
      
      {/* Description */}
      {article.description && (
        <p className="article-description">{article.description}</p>
      )}
      
      {/* Research connections */}
      {(article.matched_bills_data?.length > 0 || article.matched_staffers_data?.length > 0) && (
        <div className="research-connections">
          <span className="connections-label">Related to your research:</span>
          
          {article.matched_bills_data?.map(bill => (
            <Link
              key={bill.id}
              to={`/bills/${bill.bill_number}`}
              className="connection-tag bill-tag"
            >
              <Icon name="file-text" size={12} />
              {bill.bill_number}
            </Link>
          ))}
          
          {article.matched_staffers_data?.map(staffer => (
            <Link
              key={staffer.id}
              to={`/staffers/${staffer.id}`}
              className="connection-tag staffer-tag"
            >
              <Icon name="user" size={12} />
              {staffer.name}
            </Link>
          ))}
        </div>
      )}
      
      {/* Actions */}
      <div className="article-actions">
        <button
          onClick={() => onBookmark(article.id)}
          className={`action-btn ${article.is_bookmarked ? 'active' : ''}`}
        >
          <Icon name="bookmark" size={14} />
          {article.is_bookmarked ? 'Saved' : 'Save'}
        </button>
        <button
          onClick={() => onAskAI(article)}
          className="action-btn ai-action"
        >
          <Icon name="sparkles" size={14} />
          Ask AI
        </button>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="action-btn"
        >
          <Icon name="external-link" size={14} />
          Read Full Article
        </a>
      </div>
    </div>
  );
}

function formatSource(source) {
  const sourceMap = {
    'politico': 'Politico',
    'the_hill': 'The Hill',
    'roll_call': 'Roll Call',
    'congress_gov': 'Congress.gov',
    'federal_register': 'Federal Register',
    'reuters': 'Reuters',
    'ap': 'Associated Press'
  };
  
  return sourceMap[source] || source;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);
  
  if (diffHours < 1) {
    return 'Just now';
  } else if (diffHours < 24) {
    return `${Math.floor(diffHours)} hours ago`;
  } else if (diffHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}
```

---

## PART 8: STYLING

### File: `/frontend/styles/news.css`

```css
.news-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.news-header {
  margin-bottom: 24px;
}

.news-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.news-header p {
  color: #6b7280;
  margin: 0;
}

/* Search */
.news-search {
  margin-bottom: 20px;
}

.search-input-wrapper {
  position: relative;
  max-width: 600px;
}

.search-input-wrapper input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 15px;
}

.search-input-wrapper svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-top: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.suggestion-item:hover {
  background: #f3f4f6;
}

.type-badge {
  margin-left: auto;
  padding: 2px 8px;
  background: #e5e7eb;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

/* Filters */
.news-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: #f9fafb;
}

.filter-btn.active {
  background: #eff6ff;
  border-color: #2563eb;
  color: #2563eb;
}

/* News Feed */
.news-feed {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.news-article-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  position: relative;
  transition: all 0.2s;
}

.news-article-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #d1d5db;
}

.relevance-badge {
  position: absolute;
  top: -8px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(251, 191, 36, 0.3);
}

.article-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.source-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.source-politico { background: #dbeafe; color: #1e40af; }
.source-the_hill { background: #fef3c7; color: #92400e; }
.source-congress_gov { background: #dcfce7; color: #166534; }
.source-federal_register { background: #f3e8ff; color: #6b21a8; }

.category-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.category-executive { background: #fee2e2; color: #991b1b; }
.category-legislation { background: #dbeafe; color: #1e40af; }
.category-policy { background: #dcfce7; color: #166534; }
.category-campaign { background: #fef3c7; color: #92400e; }

.article-date {
  color: #6b7280;
  font-size: 12px;
  margin-left: auto;
}

.article-title {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
}

.article-title a {
  color: #111827;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

.article-title a:hover {
  color: #2563eb;
}

.article-description {
  color: #4b5563;
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.research-connections {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.connections-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 8px;
}

.connection-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  margin-right: 6px;
  margin-bottom: 6px;
  transition: all 0.2s;
}

.bill-tag {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}

.bill-tag:hover {
  background: #bfdbfe;
}

.staffer-tag {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
}

.staffer-tag:hover {
  background: #fde68a;
}

.article-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.action-btn.active {
  background: #eff6ff;
  border-color: #2563eb;
  color: #2563eb;
}

.ai-action {
  border-color: #c084fc;
  color: #7c3aed;
}

.ai-action:hover {
  background: #faf5ff;
  border-color: #a855f7;
}

/* Loading & Empty States */
.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner {
  border: 3px solid #f3f4f6;
  border-top-color: #2563eb;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-state h3 {
  margin: 16px 0 8px;
  color: #374151;
}

/* Responsive */
@media (max-width: 768px) {
  .news-page {
    padding: 16px;
  }
  
  .news-filters {
    overflow-x: auto;
    flex-wrap: nowrap;
  }
  
  .filter-btn {
    white-space: nowrap;
  }
  
  .article-title {
    font-size: 16px;
  }
  
  .article-actions {
    width: 100%;
  }
  
  .action-btn {
    flex: 1;
    justify-content: center;
  }
}
```

---

## PART 9: ENVIRONMENT VARIABLES

Add to `.env`:

```bash
# Congress.gov API
CONGRESS_GOV_API_KEY=your_key_here

# NewsAPI (optional - 100 req/day free)
NEWS_API_KEY=your_key_here

# GNews API (optional - 100 req/day free)
GNEWS_API_KEY=your_key_here

# FireCrawl (you already have this)
FIRECRAWL_API_KEY=your_existing_key
```

---

## IMPLEMENTATION CHECKLIST

### Week 1: Foundation
- [ ] Run database migrations
- [ ] Set up NewsAggregationService
- [ ] Integrate Congress.gov API
- [ ] Add RSS feed aggregation
- [ ] Test basic news fetching

### Week 2: Intelligence
- [ ] Implement NewsIntelligenceService
- [ ] Build relevance scoring algorithm
- [ ] Create news scoring cron job
- [ ] Test personalized feed

### Week 3: Frontend
- [ ] Build NewsPage component
- [ ] Add search with suggestions
- [ ] Implement filters
- [ ] Add article cards with research connections

### Week 4: Advanced Features
- [ ] Set up NewsAlertsService
- [ ] Configure alert cron jobs
- [ ] Add "Ask AI" integration
- [ ] Test entire system end-to-end

---

## SUCCESS CRITERIA

✅ News aggregates from 5+ sources automatically
✅ Articles scored by relevance (0-100)
✅ High-relevance articles shown first
✅ Articles connect to tracked bills/staffers
✅ Search works with smart suggestions
✅ Real-time alerts for important news
✅ "Ask AI" button analyzes articles
✅ Mobile responsive design

---

This is your complete, production-ready News Intelligence System!
