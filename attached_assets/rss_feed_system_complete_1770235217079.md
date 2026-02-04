# RSS FEED SYSTEM - COMPLETE IMPLEMENTATION

Build a comprehensive RSS feed aggregation system with admin UI to add/remove feeds, automatic parsing, and integration with the News Intelligence System.

---

## OVERVIEW

This system allows you to:
1. Automatically fetch articles from RSS feeds every hour
2. Add/remove RSS feeds from the News section UI (no code changes needed)
3. Parse and store articles in the news database
4. Integrate with existing News Intelligence relevance scoring

---

## PART 1: DATABASE SCHEMA

### Add RSS Feed Management Tables

```sql
-- RSS feeds that are being monitored
CREATE TABLE rss_feeds (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL, -- Display name (e.g., "Politico")
  feed_url TEXT NOT NULL UNIQUE, -- RSS feed URL
  website_url TEXT, -- Main website URL
  category VARCHAR(50), -- 'politics', 'defense', 'general'
  is_active BOOLEAN DEFAULT TRUE, -- Enable/disable feed
  fetch_frequency INTEGER DEFAULT 60, -- Minutes between fetches
  last_fetched_at TIMESTAMP,
  last_fetch_status VARCHAR(50), -- 'success', 'error'
  last_fetch_error TEXT,
  article_count INTEGER DEFAULT 0, -- Total articles fetched
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES firm_users(id),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Track which articles came from which RSS feed
ALTER TABLE news_articles 
ADD COLUMN rss_feed_id INTEGER REFERENCES rss_feeds(id);

-- Create indexes
CREATE INDEX idx_rss_feeds_active ON rss_feeds(is_active);
CREATE INDEX idx_rss_feeds_category ON rss_feeds(category);
CREATE INDEX idx_news_articles_rss_feed ON news_articles(rss_feed_id);
```

---

## PART 2: RSS FEED SERVICE

### File: `/backend/services/rss_feed_service.js`

```javascript
const Parser = require('rss-parser');
const db = require('../db');

class RSSFeedService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          'media:content',
          'media:thumbnail',
          'content:encoded',
          'dc:creator'
        ]
      },
      timeout: 10000 // 10 second timeout
    });
  }
  
  // Fetch and parse all active RSS feeds
  async fetchAllActiveFeeds() {
    console.log('Fetching all active RSS feeds...');
    
    // Get all active feeds
    const result = await db.query(
      `SELECT * FROM rss_feeds WHERE is_active = TRUE`
    );
    
    const feeds = result.rows;
    console.log(`Found ${feeds.length} active RSS feeds`);
    
    const allArticles = [];
    
    for (const feed of feeds) {
      try {
        const articles = await this.fetchSingleFeed(feed);
        allArticles.push(...articles);
        
        // Update success status
        await db.query(
          `UPDATE rss_feeds 
           SET last_fetched_at = NOW(),
               last_fetch_status = 'success',
               last_fetch_error = NULL,
               article_count = article_count + $1
           WHERE id = $2`,
          [articles.length, feed.id]
        );
        
        console.log(`✓ ${feed.name}: ${articles.length} articles`);
      } catch (error) {
        console.error(`✗ ${feed.name}: ${error.message}`);
        
        // Update error status
        await db.query(
          `UPDATE rss_feeds 
           SET last_fetched_at = NOW(),
               last_fetch_status = 'error',
               last_fetch_error = $1
           WHERE id = $2`,
          [error.message, feed.id]
        );
      }
    }
    
    console.log(`Total articles fetched: ${allArticles.length}`);
    
    // Save all articles to database
    if (allArticles.length > 0) {
      await this.saveArticles(allArticles);
    }
    
    return allArticles;
  }
  
  // Fetch articles from a single RSS feed
  async fetchSingleFeed(feed) {
    const articles = [];
    
    try {
      const parsedFeed = await this.parser.parseURL(feed.feed_url);
      
      for (const item of parsedFeed.items) {
        // Skip if no title or link
        if (!item.title || !item.link) continue;
        
        // Parse published date
        let publishedDate = new Date();
        if (item.pubDate) {
          publishedDate = new Date(item.pubDate);
        } else if (item.isoDate) {
          publishedDate = new Date(item.isoDate);
        }
        
        // Only include articles from last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (publishedDate < sevenDaysAgo) continue;
        
        // Extract content (try multiple fields)
        let content = '';
        if (item['content:encoded']) {
          content = this.stripHtml(item['content:encoded']);
        } else if (item.content) {
          content = this.stripHtml(item.content);
        }
        
        // Get image URL
        let imageUrl = null;
        if (item['media:content']?.$?.url) {
          imageUrl = item['media:content'].$.url;
        } else if (item['media:thumbnail']?.$?.url) {
          imageUrl = item['media:thumbnail'].$.url;
        } else if (item.enclosure?.url) {
          imageUrl = item.enclosure.url;
        }
        
        articles.push({
          rss_feed_id: feed.id,
          external_id: item.guid || item.link,
          title: this.cleanText(item.title),
          description: this.cleanText(item.contentSnippet || item.description || ''),
          content: this.cleanText(content),
          url: item.link,
          source: this.normalizeSourceName(feed.name),
          author: item.creator || item['dc:creator'] || item.author,
          published_date: publishedDate,
          category: this.categorizeArticle(item.title, item.contentSnippet),
          image_url: imageUrl,
          raw_data: item
        });
      }
    } catch (error) {
      throw new Error(`Failed to parse RSS feed: ${error.message}`);
    }
    
    return articles;
  }
  
  // Save articles to database
  async saveArticles(articles) {
    let savedCount = 0;
    let skippedCount = 0;
    
    for (const article of articles) {
      try {
        const result = await db.query(
          `INSERT INTO news_articles 
           (rss_feed_id, external_id, title, description, content, url, source, 
            author, published_date, category, image_url, raw_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (external_id) DO NOTHING
           RETURNING id`,
          [
            article.rss_feed_id,
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
        
        if (result.rows.length > 0) {
          savedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`Error saving article "${article.title}":`, error.message);
      }
    }
    
    console.log(`Saved ${savedCount} new articles, skipped ${skippedCount} duplicates`);
  }
  
  // Test a feed URL before adding it
  async testFeed(feedUrl) {
    try {
      const feed = await this.parser.parseURL(feedUrl);
      
      return {
        success: true,
        title: feed.title,
        description: feed.description,
        link: feed.link,
        itemCount: feed.items.length,
        latestItems: feed.items.slice(0, 3).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Add a new RSS feed
  async addFeed(feedData, userId) {
    // Test the feed first
    const testResult = await this.testFeed(feedData.feed_url);
    
    if (!testResult.success) {
      throw new Error(`Invalid RSS feed: ${testResult.error}`);
    }
    
    // Insert into database
    const result = await db.query(
      `INSERT INTO rss_feeds 
       (name, feed_url, website_url, category, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        feedData.name || testResult.title,
        feedData.feed_url,
        feedData.website_url || testResult.link,
        feedData.category || 'general',
        userId
      ]
    );
    
    return result.rows[0];
  }
  
  // Update an RSS feed
  async updateFeed(feedId, updates) {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }
    
    if (updates.feed_url !== undefined) {
      fields.push(`feed_url = $${paramIndex}`);
      values.push(updates.feed_url);
      paramIndex++;
    }
    
    if (updates.category !== undefined) {
      fields.push(`category = $${paramIndex}`);
      values.push(updates.category);
      paramIndex++;
    }
    
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex}`);
      values.push(updates.is_active);
      paramIndex++;
    }
    
    fields.push(`updated_at = NOW()`);
    values.push(feedId);
    
    const result = await db.query(
      `UPDATE rss_feeds SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0];
  }
  
  // Delete an RSS feed
  async deleteFeed(feedId) {
    await db.query(`DELETE FROM rss_feeds WHERE id = $1`, [feedId]);
  }
  
  // Get all RSS feeds
  async getAllFeeds() {
    const result = await db.query(
      `SELECT 
        rf.*,
        COUNT(na.id) as total_articles,
        MAX(na.published_date) as latest_article_date
       FROM rss_feeds rf
       LEFT JOIN news_articles na ON rf.id = na.rss_feed_id
       GROUP BY rf.id
       ORDER BY rf.name`
    );
    
    return result.rows;
  }
  
  // Helper: Strip HTML tags
  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
  }
  
  // Helper: Clean text
  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ')
               .replace(/[\r\n]+/g, ' ')
               .trim();
  }
  
  // Helper: Normalize source name
  normalizeSourceName(name) {
    return name.toLowerCase()
               .replace(/[^a-z0-9\s]/g, '')
               .replace(/\s+/g, '_')
               .substring(0, 100);
  }
  
  // Helper: Categorize article
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
}

module.exports = RSSFeedService;
```

---

## PART 3: API ROUTES

### File: `/backend/routes/rss_feeds.js`

```javascript
const express = require('express');
const router = express.Router();
const RSSFeedService = require('../services/rss_feed_service');
const { authenticateFirmUser } = require('../middleware/auth');

router.use(authenticateFirmUser);

const rssService = new RSSFeedService();

// Get all RSS feeds
router.get('/', async (req, res) => {
  try {
    const feeds = await rssService.getAllFeeds();
    res.json({ feeds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test an RSS feed URL
router.post('/test', async (req, res) => {
  try {
    const { feed_url } = req.body;
    
    if (!feed_url) {
      return res.status(400).json({ error: 'feed_url is required' });
    }
    
    const result = await rssService.testFeed(feed_url);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new RSS feed
router.post('/', async (req, res) => {
  try {
    const { name, feed_url, website_url, category } = req.body;
    
    if (!feed_url) {
      return res.status(400).json({ error: 'feed_url is required' });
    }
    
    const feed = await rssService.addFeed(
      { name, feed_url, website_url, category },
      req.user.id
    );
    
    res.json({ feed, message: 'RSS feed added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an RSS feed
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const feed = await rssService.updateFeed(parseInt(id), updates);
    
    if (!feed) {
      return res.status(404).json({ error: 'RSS feed not found' });
    }
    
    res.json({ feed, message: 'RSS feed updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an RSS feed
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await rssService.deleteFeed(parseInt(id));
    
    res.json({ message: 'RSS feed deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually trigger fetch for a specific feed
router.post('/:id/fetch', async (req, res) => {
  try {
    const { id } = req.params;
    const db = require('../db');
    
    // Get the feed
    const result = await db.query(
      `SELECT * FROM rss_feeds WHERE id = $1`,
      [parseInt(id)]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RSS feed not found' });
    }
    
    const feed = result.rows[0];
    
    // Fetch articles
    const articles = await rssService.fetchSingleFeed(feed);
    
    // Save articles
    if (articles.length > 0) {
      await rssService.saveArticles(articles);
    }
    
    // Update feed status
    await db.query(
      `UPDATE rss_feeds 
       SET last_fetched_at = NOW(),
           last_fetch_status = 'success',
           article_count = article_count + $1
       WHERE id = $2`,
      [articles.length, feed.id]
    );
    
    res.json({ 
      message: `Fetched ${articles.length} articles from ${feed.name}`,
      articles_count: articles.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch all active feeds now
router.post('/fetch-all', async (req, res) => {
  try {
    const articles = await rssService.fetchAllActiveFeeds();
    
    res.json({ 
      message: `Fetched ${articles.length} total articles`,
      articles_count: articles.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## PART 4: CRON JOB

### File: `/backend/jobs/rss_jobs.js`

```javascript
const cron = require('node-cron');
const RSSFeedService = require('../services/rss_feed_service');

const rssService = new RSSFeedService();

// Fetch RSS feeds every hour
cron.schedule('0 * * * *', async () => {
  console.log('Starting RSS feed aggregation...');
  
  try {
    await rssService.fetchAllActiveFeeds();
    console.log('RSS feed aggregation complete');
  } catch (error) {
    console.error('RSS aggregation error:', error);
  }
});

console.log('RSS feed jobs scheduled (runs every hour)');
```

---

## PART 5: FRONTEND - RSS FEED MANAGEMENT UI

### File: `/frontend/pages/RSSFeedsManager.jsx`

```jsx
import { useState, useEffect } from 'react';
import Icon from '../components/Icon';

export default function RSSFeedsManager() {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  useEffect(() => {
    fetchFeeds();
  }, []);
  
  async function fetchFeeds() {
    try {
      const res = await fetch('/api/rss-feeds');
      const data = await res.json();
      setFeeds(data.feeds);
    } catch (error) {
      console.error('Error fetching feeds:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function toggleFeed(feedId, isActive) {
    try {
      await fetch(`/api/rss-feeds/${feedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive })
      });
      
      fetchFeeds(); // Refresh list
    } catch (error) {
      alert('Error updating feed: ' + error.message);
    }
  }
  
  async function deleteFeed(feedId, feedName) {
    if (!confirm(`Delete "${feedName}"? This will not delete the articles already fetched.`)) {
      return;
    }
    
    try {
      await fetch(`/api/rss-feeds/${feedId}`, {
        method: 'DELETE'
      });
      
      fetchFeeds(); // Refresh list
    } catch (error) {
      alert('Error deleting feed: ' + error.message);
    }
  }
  
  async function fetchNow(feedId, feedName) {
    try {
      const res = await fetch(`/api/rss-feeds/${feedId}/fetch`, {
        method: 'POST'
      });
      
      const data = await res.json();
      alert(`${feedName}: ${data.message}`);
      fetchFeeds(); // Refresh to show updated stats
    } catch (error) {
      alert('Error fetching feed: ' + error.message);
    }
  }
  
  async function fetchAllNow() {
    if (!confirm('Fetch all active RSS feeds now? This may take a minute.')) {
      return;
    }
    
    try {
      const res = await fetch('/api/rss-feeds/fetch-all', {
        method: 'POST'
      });
      
      const data = await res.json();
      alert(data.message);
      fetchFeeds();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  }
  
  return (
    <div className="rss-feeds-manager">
      <div className="page-header">
        <div>
          <h1>RSS Feed Manager</h1>
          <p>Add and manage RSS news feeds</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={fetchAllNow}
            className="btn btn-secondary"
          >
            <Icon name="refresh-cw" />
            Fetch All Now
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            <Icon name="plus" />
            Add RSS Feed
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading RSS feeds...</p>
        </div>
      ) : (
        <div className="feeds-grid">
          {feeds.map(feed => (
            <RSSFeedCard
              key={feed.id}
              feed={feed}
              onToggle={toggleFeed}
              onDelete={deleteFeed}
              onFetch={fetchNow}
            />
          ))}
          
          {feeds.length === 0 && (
            <div className="empty-state">
              <Icon name="rss" size={48} />
              <h3>No RSS feeds yet</h3>
              <p>Add your first RSS feed to start aggregating news</p>
              <button 
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary"
              >
                Add RSS Feed
              </button>
            </div>
          )}
        </div>
      )}
      
      {showAddModal && (
        <AddRSSFeedModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchFeeds();
          }}
        />
      )}
    </div>
  );
}

function RSSFeedCard({ feed, onToggle, onDelete, onFetch }) {
  const statusColor = feed.last_fetch_status === 'success' ? 'green' : 
                     feed.last_fetch_status === 'error' ? 'red' : 'gray';
  
  return (
    <div className={`rss-feed-card ${!feed.is_active ? 'inactive' : ''}`}>
      <div className="feed-header">
        <div className="feed-info">
          <h3>{feed.name}</h3>
          {feed.website_url && (
            <a 
              href={feed.website_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="feed-website"
            >
              <Icon name="external-link" size={12} />
              Visit Site
            </a>
          )}
        </div>
        
        <div className="feed-status">
          <span className={`status-indicator status-${statusColor}`}>
            {feed.is_active ? (feed.last_fetch_status || 'active') : 'inactive'}
          </span>
        </div>
      </div>
      
      <div className="feed-url">
        <Icon name="rss" size={14} />
        <code>{feed.feed_url}</code>
      </div>
      
      {feed.category && (
        <span className={`category-badge category-${feed.category}`}>
          {feed.category}
        </span>
      )}
      
      <div className="feed-stats">
        <div className="stat">
          <span className="stat-value">{feed.total_articles || 0}</span>
          <span className="stat-label">Total Articles</span>
        </div>
        
        <div className="stat">
          <span className="stat-value">
            {feed.last_fetched_at ? formatTimeAgo(feed.last_fetched_at) : 'Never'}
          </span>
          <span className="stat-label">Last Fetched</span>
        </div>
      </div>
      
      {feed.last_fetch_error && (
        <div className="feed-error">
          <Icon name="alert-circle" size={14} />
          <span>{feed.last_fetch_error}</span>
        </div>
      )}
      
      <div className="feed-actions">
        <button
          onClick={() => onToggle(feed.id, feed.is_active)}
          className="btn btn-sm btn-secondary"
          title={feed.is_active ? 'Disable' : 'Enable'}
        >
          <Icon name={feed.is_active ? 'pause' : 'play'} size={14} />
          {feed.is_active ? 'Disable' : 'Enable'}
        </button>
        
        <button
          onClick={() => onFetch(feed.id, feed.name)}
          className="btn btn-sm btn-secondary"
          title="Fetch now"
        >
          <Icon name="refresh-cw" size={14} />
          Fetch Now
        </button>
        
        <button
          onClick={() => onDelete(feed.id, feed.name)}
          className="btn btn-sm btn-danger"
          title="Delete feed"
        >
          <Icon name="trash-2" size={14} />
        </button>
      </div>
    </div>
  );
}

function AddRSSFeedModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    feed_url: '',
    website_url: '',
    category: 'general'
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  async function testFeed() {
    if (!formData.feed_url) {
      alert('Please enter a feed URL');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch('/api/rss-feeds/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_url: formData.feed_url })
      });
      
      const data = await res.json();
      setTestResult(data);
      
      // Auto-fill name if successful
      if (data.success && !formData.name) {
        setFormData(prev => ({ ...prev, name: data.title }));
      }
    } catch (error) {
      setTestResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  }
  
  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!testResult?.success) {
      alert('Please test the feed URL first');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add feed');
      }
      
      onSuccess();
    } catch (error) {
      alert('Error: ' + error.message);
      setSubmitting(false);
    }
  }
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add RSS Feed</h2>
          <button onClick={onClose} className="modal-close">
            <Icon name="x" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>RSS Feed URL *</label>
            <div className="input-with-button">
              <input
                type="url"
                value={formData.feed_url}
                onChange={e => setFormData({...formData, feed_url: e.target.value})}
                placeholder="https://example.com/rss"
                required
              />
              <button
                type="button"
                onClick={testFeed}
                disabled={testing || !formData.feed_url}
                className="btn btn-secondary"
              >
                {testing ? 'Testing...' : 'Test Feed'}
              </button>
            </div>
          </div>
          
          {testResult && (
            <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
              {testResult.success ? (
                <>
                  <Icon name="check-circle" size={16} />
                  <div>
                    <strong>Feed is valid!</strong>
                    <p>{testResult.title}</p>
                    <p className="small">{testResult.itemCount} articles available</p>
                  </div>
                </>
              ) : (
                <>
                  <Icon name="x-circle" size={16} />
                  <div>
                    <strong>Invalid feed</strong>
                    <p>{testResult.error}</p>
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="form-group">
            <label>Display Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Politico, The Hill"
              required
            />
          </div>
          
          <div className="form-group">
            <label>Website URL (optional)</label>
            <input
              type="url"
              value={formData.website_url}
              onChange={e => setFormData({...formData, website_url: e.target.value})}
              placeholder="https://example.com"
            />
          </div>
          
          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              <option value="general">General</option>
              <option value="politics">Politics</option>
              <option value="defense">Defense</option>
              <option value="legislation">Legislation</option>
            </select>
          </div>
          
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting || !testResult?.success}
            >
              {submitting ? 'Adding...' : 'Add Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
```

---

## PART 6: STYLING

### File: `/frontend/styles/rss-feeds.css`

```css
.rss-feeds-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.page-header p {
  color: #6b7280;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

/* Feed Grid */
.feeds-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.rss-feed-card {
  background: white;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
}

.rss-feed-card:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}

.rss-feed-card.inactive {
  opacity: 0.6;
  background: #f9fafb;
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.feed-info h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.feed-website {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #6b7280;
  text-decoration: none;
}

.feed-website:hover {
  color: #2563eb;
}

.status-indicator {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-green {
  background: #d1fae5;
  color: #065f46;
}

.status-red {
  background: #fee2e2;
  color: #991b1b;
}

.status-gray {
  background: #f3f4f6;
  color: #6b7280;
}

.feed-url {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 6px;
  margin-bottom: 12px;
}

.feed-url code {
  font-size: 12px;
  color: #4b5563;
  word-break: break-all;
  flex: 1;
}

.category-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.category-general { background: #f3f4f6; color: #374151; }
.category-politics { background: #dbeafe; color: #1e40af; }
.category-defense { background: #fef3c7; color: #92400e; }
.category-legislation { background: #dcfce7; color: #166534; }

.feed-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
  padding: 16px 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.feed-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 12px;
  color: #991b1b;
}

.feed-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.feed-actions .btn {
  flex: 1;
  justify-content: center;
}

/* Add Feed Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 20px;
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #6b7280;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #374151;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.input-with-button {
  display: flex;
  gap: 8px;
}

.input-with-button input {
  flex: 1;
}

.test-result {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.test-result.success {
  background: #d1fae5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}

.test-result.error {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.test-result p {
  margin: 4px 0 0 0;
  font-size: 14px;
}

.test-result .small {
  font-size: 12px;
  opacity: 0.8;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid #e5e7eb;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-primary:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fecaca;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

/* Loading & Empty States */
.loading-state,
.empty-state {
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

.empty-state h3 {
  margin: 16px 0 8px;
  color: #374151;
}

.empty-state p {
  color: #6b7280;
  margin-bottom: 24px;
}

/* Responsive */
@media (max-width: 768px) {
  .feeds-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .header-actions {
    width: 100%;
  }
  
  .header-actions .btn {
    flex: 1;
  }
}
```

---

## PART 7: ADD TO NAVIGATION

Update your News page to include link to RSS Manager:

```jsx
// In NewsPage.jsx, add this button in the header

<div className="news-header">
  <h1>Intelligence Feed</h1>
  <Link to="/news/rss-feeds" className="btn btn-secondary">
    <Icon name="settings" />
    Manage RSS Feeds
  </Link>
</div>
```

---

## PART 8: SEED DEFAULT RSS FEEDS

### File: `/backend/seeds/default_rss_feeds.js`

```javascript
const db = require('../db');

const defaultFeeds = [
  {
    name: 'Politico',
    feed_url: 'https://www.politico.com/rss/politics08.xml',
    website_url: 'https://www.politico.com',
    category: 'politics'
  },
  {
    name: 'The Hill',
    feed_url: 'https://thehill.com/feed/',
    website_url: 'https://thehill.com',
    category: 'politics'
  },
  {
    name: 'Roll Call',
    feed_url: 'https://www.rollcall.com/feed/',
    website_url: 'https://www.rollcall.com',
    category: 'legislation'
  },
  {
    name: 'Defense Department',
    feed_url: 'https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945',
    website_url: 'https://www.defense.gov',
    category: 'defense'
  },
  {
    name: 'Military Times',
    feed_url: 'https://www.militarytimes.com/arc/outboundfeeds/rss/',
    website_url: 'https://www.militarytimes.com',
    category: 'defense'
  },
  {
    name: 'Brookings Institution',
    feed_url: 'https://www.brookings.edu/feed/',
    website_url: 'https://www.brookings.edu',
    category: 'policy'
  },
  {
    name: 'CSIS',
    feed_url: 'https://www.csis.org/rss',
    website_url: 'https://www.csis.org',
    category: 'policy'
  }
];

async function seedDefaultFeeds() {
  console.log('Seeding default RSS feeds...');
  
  for (const feed of defaultFeeds) {
    try {
      await db.query(
        `INSERT INTO rss_feeds (name, feed_url, website_url, category)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (feed_url) DO NOTHING`,
        [feed.name, feed.feed_url, feed.website_url, feed.category]
      );
      console.log(`✓ ${feed.name}`);
    } catch (error) {
      console.error(`✗ ${feed.name}:`, error.message);
    }
  }
  
  console.log('Default RSS feeds seeded');
}

module.exports = { seedDefaultFeeds };
```

Run with:
```bash
node backend/seeds/default_rss_feeds.js
```

---

## INSTALLATION STEPS

1. **Install npm package:**
```bash
npm install rss-parser
```

2. **Run database migrations** (Part 1)

3. **Add routes to your Express app:**
```javascript
// In your main server file
app.use('/api/rss-feeds', require('./routes/rss_feeds'));
```

4. **Start the cron jobs:**
```javascript
// In your server startup
require('./jobs/rss_jobs');
```

5. **Seed default feeds:**
```bash
node backend/seeds/default_rss_feeds.js
```

6. **Test it:**
- Go to `/news/rss-feeds` in your app
- You should see 7 default feeds
- Click "Fetch All Now" to get articles immediately
- Go back to `/news` to see the articles

---

## TESTING

Test a feed manually:
```bash
curl -X POST http://localhost:3000/api/rss-feeds/test \
  -H "Content-Type: application/json" \
  -d '{"feed_url": "https://www.politico.com/rss/politics08.xml"}'
```

Expected response:
```json
{
  "success": true,
  "title": "Politico",
  "itemCount": 20,
  "latestItems": [...]
}
```

---

This is your complete RSS feed system with admin UI!
