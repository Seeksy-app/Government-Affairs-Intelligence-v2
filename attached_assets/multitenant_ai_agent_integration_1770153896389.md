# INTEGRATE AI AGENT WITH MULTI-TENANT CLIENT PORTAL SYSTEM

Connect your existing AI Research Assistant to your database, add tool functionality, and implement multi-tenant architecture where lobbying firms can assign AI conversations and insights to their specific clients in custom portals.

---

## BUSINESS CONTEXT

**Your Platform Structure:**
- **Lobbying Firms** (your customers) use the platform
- **Firm's Clients** (who the firm lobbies for) each get a custom portal
- **AI Agent** needs to work within client context and save conversations to the right client

**Example Scenario:**
- Smith & Associates (lobbying firm) has 5 clients:
  - Veterans Healthcare Alliance
  - Defense Contractors Association
  - Military Family Coalition
  - VA Nurses Union
  - Aerospace Industry Group

When a user at Smith & Associates researches "VA Healthcare staffers," they should be able to:
1. Get AI-powered results from your database
2. Assign the conversation to "Veterans Healthcare Alliance" client portal
3. That client logs in and sees the research in their portal
4. Client can continue the conversation or see updates

---

## PART 1: DATABASE SCHEMA UPDATES

### Add Multi-Tenant Structure

```sql
-- Lobbying firms (your customers)
CREATE TABLE firms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  subscription_tier VARCHAR(50) DEFAULT 'professional',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Firm users (people who work at the lobbying firm)
CREATE TABLE firm_users (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES firms(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member', 'viewer'
  password_hash TEXT NOT NULL,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Firm's clients (who the firm lobbies for)
CREATE TABLE firm_clients (
  id SERIAL PRIMARY KEY,
  firm_id INTEGER REFERENCES firms(id),
  client_name VARCHAR(255) NOT NULL,
  client_slug VARCHAR(100) NOT NULL,
  industry VARCHAR(100),
  portal_enabled BOOLEAN DEFAULT TRUE,
  portal_logo_url TEXT,
  portal_custom_branding JSONB, -- Colors, fonts, etc.
  assigned_staffers JSONB, -- Array of staffer IDs they're tracking
  tracked_topics JSONB, -- Array of topics: ["VA Healthcare", "Defense Budget"]
  tracked_bills JSONB, -- Array of bill numbers: ["H.R. 1234", "S. 567"]
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(firm_id, client_slug)
);

-- Client portal users (clients' employees who access their portal)
CREATE TABLE client_portal_users (
  id SERIAL PRIMARY KEY,
  firm_client_id INTEGER REFERENCES firm_clients(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(firm_client_id, email)
);

-- Update ai_conversations table to support multi-tenancy
ALTER TABLE ai_conversations ADD COLUMN firm_id INTEGER REFERENCES firms(id);
ALTER TABLE ai_conversations ADD COLUMN firm_user_id INTEGER REFERENCES firm_users(id);
ALTER TABLE ai_conversations ADD COLUMN firm_client_id INTEGER REFERENCES firm_clients(id);
ALTER TABLE ai_conversations ADD COLUMN is_assigned_to_client BOOLEAN DEFAULT FALSE;
ALTER TABLE ai_conversations ADD COLUMN client_visible BOOLEAN DEFAULT FALSE;

-- Client portal knowledge base
CREATE TABLE client_knowledge (
  id SERIAL PRIMARY KEY,
  firm_client_id INTEGER REFERENCES firm_clients(id),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50), -- 'research', 'update', 'bill_analysis', 'ai_conversation'
  source_conversation_id UUID REFERENCES ai_conversations(conversation_id),
  created_by INTEGER REFERENCES firm_users(id),
  tags JSONB,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bill tracking for clients
CREATE TABLE tracked_bills (
  id SERIAL PRIMARY KEY,
  firm_client_id INTEGER REFERENCES firm_clients(id),
  bill_number VARCHAR(50) NOT NULL,
  bill_title TEXT,
  status VARCHAR(100),
  last_action TEXT,
  last_action_date DATE,
  impact_summary TEXT, -- AI-generated summary of how it affects this client
  staffers_involved JSONB, -- Array of staffer IDs working on this bill
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(firm_client_id, bill_number)
);

CREATE INDEX idx_firm_clients_firm ON firm_clients(firm_id);
CREATE INDEX idx_conversations_firm_client ON ai_conversations(firm_client_id);
CREATE INDEX idx_knowledge_client ON client_knowledge(firm_client_id);
CREATE INDEX idx_tracked_bills_client ON tracked_bills(firm_client_id);
```

---

## PART 2: UPDATED AI AGENT WITH TOOLS

### Enhanced AI Agent with Database Integration

```javascript
// /backend/services/ai_agent.js

const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

class MultiTenantAIAgent {
  constructor(firmUserId, firmClientId = null) {
    this.firmUserId = firmUserId;
    this.firmClientId = firmClientId; // Optional: if researching for specific client
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Get firm context
    this.firmContext = null;
    this.clientContext = null;
  }
  
  async initialize() {
    // Load firm user context
    const userResult = await db.query(
      `SELECT fu.*, f.name as firm_name 
       FROM firm_users fu
       JOIN firms f ON fu.firm_id = f.id
       WHERE fu.id = $1`,
      [this.firmUserId]
    );
    
    this.firmContext = userResult.rows[0];
    
    // Load client context if specified
    if (this.firmClientId) {
      const clientResult = await db.query(
        `SELECT * FROM firm_clients WHERE id = $1`,
        [this.firmClientId]
      );
      this.clientContext = clientResult.rows[0];
    }
  }
  
  getSystemPrompt() {
    let prompt = `You are an AI research assistant for ${this.firmContext.firm_name}, a lobbying firm. You help research congressional staffers, track legislation, monitor media coverage, and provide intelligence to support lobbying efforts.

Available data sources:
- Congressional staffer database with detailed career histories
- Media coverage from Task & Purpose, We Are The Mighty, The War Zone
- Bill tracking and legislative updates
- Network connections between staffers and organizations

Your responses should be:
1. Professional and actionable for lobbying professionals
2. Based on real data from the database (use tools to query)
3. Include specific names, positions, and contact information when relevant
4. Suggest next steps or follow-up actions`;

    if (this.clientContext) {
      prompt += `

IMPORTANT: You are currently researching on behalf of "${this.clientContext.client_name}".
Their focus areas: ${this.clientContext.tracked_topics?.join(', ') || 'Not specified'}
Tracked bills: ${this.clientContext.tracked_bills?.join(', ') || 'None'}

Tailor your research to their specific interests and industry: ${this.clientContext.industry || 'Not specified'}`;
    }

    return prompt;
  }
  
  getTools() {
    return [
      {
        name: "search_staffers",
        description: "Search the congressional staffers database by name, position, organization, specialty, or keywords. Returns detailed profiles with career history.",
        input_schema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query - name, position, specialty, or keywords like 'VA Healthcare', 'Defense policy'"
            },
            filters: {
              type: "object",
              properties: {
                chamber: { type: "string", enum: ["House", "Senate", "Both"] },
                party: { type: "string", enum: ["Republican", "Democrat", "Independent"] },
                current_member: { type: "string" },
                specialty: { type: "string" }
              }
            },
            limit: { type: "integer", default: 10 }
          },
          required: ["query"]
        }
      },
      {
        name: "get_staffer_details",
        description: "Get complete details for a specific staffer including full career history, connections, and recent media mentions.",
        input_schema: {
          type: "object",
          properties: {
            staffer_id: { type: "integer", description: "Staffer ID from search results" }
          },
          required: ["staffer_id"]
        }
      },
      {
        name: "search_media_coverage",
        description: "Search for media articles from Task & Purpose, We Are The Mighty, and The War Zone. Can search by staffer, keyword, or topic.",
        input_schema: {
          type: "object",
          properties: {
            keyword: { type: "string", description: "Search keyword or topic" },
            staffer_id: { type: "integer", description: "Find articles mentioning this staffer" },
            days_back: { type: "integer", default: 30 },
            source: { type: "string", enum: ["all", "task_purpose", "watm", "war_zone"], default: "all" }
          }
        }
      },
      {
        name: "track_bill_for_client",
        description: "Add a bill to tracking for the current client. The system will monitor status changes and identify relevant staffers.",
        input_schema: {
          type: "object",
          properties: {
            bill_number: { type: "string", description: "Bill number like 'H.R. 1234' or 'S. 567'" },
            impact_notes: { type: "string", description: "How this bill affects the client" }
          },
          required: ["bill_number"]
        }
      },
      {
        name: "find_staffer_connections",
        description: "Find network connections between staffers - who worked together, who worked for the same member, etc.",
        input_schema: {
          type: "object",
          properties: {
            staffer_ids: {
              type: "array",
              items: { type: "integer" },
              description: "Array of staffer IDs to find connections between"
            }
          },
          required: ["staffer_ids"]
        }
      },
      {
        name: "get_client_tracked_items",
        description: "Get all staffers, bills, and topics currently being tracked for this client.",
        input_schema: {
          type: "object",
          properties: {
            item_type: { 
              type: "string", 
              enum: ["staffers", "bills", "topics", "all"],
              default: "all"
            }
          }
        }
      }
    ];
  }
  
  async executeTool(toolName, params) {
    switch (toolName) {
      case 'search_staffers':
        return await this.searchStaffers(params);
      
      case 'get_staffer_details':
        return await this.getStafferDetails(params);
      
      case 'search_media_coverage':
        return await this.searchMediaCoverage(params);
      
      case 'track_bill_for_client':
        return await this.trackBillForClient(params);
      
      case 'find_staffer_connections':
        return await this.findStafferConnections(params);
      
      case 'get_client_tracked_items':
        return await this.getClientTrackedItems(params);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  async searchStaffers(params) {
    const { query, filters = {}, limit = 10 } = params;
    
    let sql = `
      SELECT 
        s.*,
        COUNT(DISTINCT cp.id) as career_positions_count,
        COUNT(DISTINCT sm.id) as media_mentions_count
      FROM staffers s
      LEFT JOIN career_positions cp ON s.id = cp.staffer_id
      LEFT JOIN staffer_mentions sm ON s.id = sm.staffer_id
      WHERE 1=1
    `;
    
    const sqlParams = [];
    let paramIndex = 1;
    
    // Full-text search
    if (query) {
      sql += ` AND (
        s.name ILIKE $${paramIndex} OR
        s.current_position ILIKE $${paramIndex} OR
        s.specialty ILIKE $${paramIndex} OR
        s.bio ILIKE $${paramIndex} OR
        EXISTS (
          SELECT 1 FROM career_positions cp2 
          WHERE cp2.staffer_id = s.id 
          AND (cp2.position ILIKE $${paramIndex} OR cp2.organization ILIKE $${paramIndex})
        )
      )`;
      sqlParams.push(`%${query}%`);
      paramIndex++;
    }
    
    // Apply filters
    if (filters.chamber) {
      sql += ` AND s.chamber = $${paramIndex}`;
      sqlParams.push(filters.chamber);
      paramIndex++;
    }
    
    if (filters.party) {
      sql += ` AND s.party = $${paramIndex}`;
      sqlParams.push(filters.party);
      paramIndex++;
    }
    
    if (filters.current_member) {
      sql += ` AND s.current_member ILIKE $${paramIndex}`;
      sqlParams.push(`%${filters.current_member}%`);
      paramIndex++;
    }
    
    if (filters.specialty) {
      sql += ` AND s.specialty ILIKE $${paramIndex}`;
      sqlParams.push(`%${filters.specialty}%`);
      paramIndex++;
    }
    
    sql += ` GROUP BY s.id ORDER BY s.name LIMIT $${paramIndex}`;
    sqlParams.push(limit);
    
    const result = await db.query(sql, sqlParams);
    return result.rows;
  }
  
  async getStafferDetails(params) {
    const { staffer_id } = params;
    
    // Get staffer with full career history
    const stafferResult = await db.query(
      `SELECT 
        s.*,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', cp.id,
            'position', cp.position,
            'organization', cp.organization,
            'boss_name', cp.boss_name,
            'start_year', cp.start_year,
            'end_year', cp.end_year,
            'is_current', cp.is_current
          ) ORDER BY cp.start_year DESC
        ) FILTER (WHERE cp.id IS NOT NULL) as career_positions,
        json_agg(
          DISTINCT jsonb_build_object(
            'name', c.connected_to_name,
            'organization', c.organization,
            'years_together', c.years_together
          )
        ) FILTER (WHERE c.id IS NOT NULL) as connections
      FROM staffers s
      LEFT JOIN career_positions cp ON s.id = cp.staffer_id
      LEFT JOIN connections c ON s.id = c.staffer_id
      WHERE s.id = $1
      GROUP BY s.id`,
      [staffer_id]
    );
    
    // Get recent media mentions
    const mentionsResult = await db.query(
      `SELECT 
        ra.title,
        ra.url,
        ra.published_date,
        sm.mention_context,
        sm.mention_sentiment
      FROM staffer_mentions sm
      JOIN recurrent_articles ra ON sm.article_id = ra.id
      WHERE sm.staffer_id = $1
      ORDER BY ra.published_date DESC
      LIMIT 5`,
      [staffer_id]
    );
    
    const staffer = stafferResult.rows[0];
    staffer.recent_mentions = mentionsResult.rows;
    
    return staffer;
  }
  
  async searchMediaCoverage(params) {
    const { keyword, staffer_id, days_back = 30, source = 'all' } = params;
    
    let sql = `
      SELECT 
        ra.*,
        sm.mention_context,
        sm.mention_sentiment
      FROM recurrent_articles ra
      LEFT JOIN staffer_mentions sm ON ra.id = sm.article_id
      WHERE ra.published_date >= NOW() - INTERVAL '${days_back} days'
    `;
    
    const sqlParams = [];
    let paramIndex = 1;
    
    if (staffer_id) {
      sql += ` AND sm.staffer_id = $${paramIndex}`;
      sqlParams.push(staffer_id);
      paramIndex++;
    }
    
    if (keyword) {
      sql += ` AND (ra.title ILIKE $${paramIndex} OR ra.content ILIKE $${paramIndex})`;
      sqlParams.push(`%${keyword}%`);
      paramIndex++;
    }
    
    if (source !== 'all') {
      sql += ` AND ra.source = $${paramIndex}`;
      sqlParams.push(source);
      paramIndex++;
    }
    
    sql += ` ORDER BY ra.published_date DESC LIMIT 20`;
    
    const result = await db.query(sql, sqlParams);
    return result.rows;
  }
  
  async trackBillForClient(params) {
    if (!this.firmClientId) {
      return { error: "No client context available for tracking" };
    }
    
    const { bill_number, impact_notes } = params;
    
    // Add to tracked bills
    const result = await db.query(
      `INSERT INTO tracked_bills 
       (firm_client_id, bill_number, impact_summary) 
       VALUES ($1, $2, $3)
       ON CONFLICT (firm_client_id, bill_number) 
       DO UPDATE SET impact_summary = $3, updated_at = NOW()
       RETURNING *`,
      [this.firmClientId, bill_number, impact_notes]
    );
    
    // Also update client's tracked_bills array
    await db.query(
      `UPDATE firm_clients 
       SET tracked_bills = 
         COALESCE(tracked_bills, '[]'::jsonb) || 
         jsonb_build_array($1)
       WHERE id = $2`,
      [bill_number, this.firmClientId]
    );
    
    return {
      success: true,
      message: `Now tracking ${bill_number} for ${this.clientContext.client_name}`,
      bill: result.rows[0]
    };
  }
  
  async findStafferConnections(params) {
    const { staffer_ids } = params;
    
    // Find shared organizations, bosses, time periods
    const result = await db.query(
      `SELECT 
        cp1.staffer_id as staffer1_id,
        s1.name as staffer1_name,
        cp2.staffer_id as staffer2_id,
        s2.name as staffer2_name,
        cp1.organization as shared_organization,
        cp1.boss_name as shared_boss,
        cp1.start_year,
        cp1.end_year
      FROM career_positions cp1
      JOIN career_positions cp2 ON 
        cp1.organization = cp2.organization AND
        cp1.staffer_id < cp2.staffer_id AND
        cp1.staffer_id = ANY($1) AND
        cp2.staffer_id = ANY($1)
      JOIN staffers s1 ON cp1.staffer_id = s1.id
      JOIN staffers s2 ON cp2.staffer_id = s2.id
      ORDER BY cp1.start_year DESC`,
      [staffer_ids]
    );
    
    return result.rows;
  }
  
  async getClientTrackedItems(params) {
    if (!this.firmClientId) {
      return { error: "No client context available" };
    }
    
    const { item_type = 'all' } = params;
    const result = {};
    
    if (item_type === 'all' || item_type === 'staffers') {
      const stafferIds = this.clientContext.assigned_staffers || [];
      if (stafferIds.length > 0) {
        const staffersResult = await db.query(
          `SELECT * FROM staffers WHERE id = ANY($1)`,
          [stafferIds]
        );
        result.staffers = staffersResult.rows;
      }
    }
    
    if (item_type === 'all' || item_type === 'bills') {
      const billsResult = await db.query(
        `SELECT * FROM tracked_bills WHERE firm_client_id = $1 ORDER BY updated_at DESC`,
        [this.firmClientId]
      );
      result.bills = billsResult.rows;
    }
    
    if (item_type === 'all' || item_type === 'topics') {
      result.topics = this.clientContext.tracked_topics || [];
    }
    
    return result;
  }
  
  async processQuery(userQuery, conversationId = null) {
    await this.initialize();
    
    // Get or create conversation
    if (!conversationId) {
      conversationId = await this.createConversation();
    }
    
    // Get conversation history
    const history = await this.getConversationHistory(conversationId);
    
    // Build messages
    const messages = [
      ...history,
      { role: 'user', content: userQuery }
    ];
    
    // Save user message
    await this.saveMessage(conversationId, 'user', userQuery);
    
    // Call Claude
    let response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: this.getSystemPrompt(),
      messages: messages,
      tools: this.getTools()
    });
    
    // Handle tool use loop
    const toolResults = [];
    const toolsUsed = [];
    
    while (response.stop_reason === 'tool_use') {
      for (const content of response.content) {
        if (content.type === 'tool_use') {
          console.log(`Executing tool: ${content.name}`);
          toolsUsed.push(content.name);
          
          const result = await this.executeTool(content.name, content.input);
          
          toolResults.push({
            type: 'tool_result',
            tool_use_id: content.id,
            content: JSON.stringify(result)
          });
        }
      }
      
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
      
      response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: this.getSystemPrompt(),
        messages: messages,
        tools: this.getTools()
      });
    }
    
    // Extract final response
    const finalResponse = response.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('\n\n');
    
    // Save assistant response with structured data
    await this.saveMessage(conversationId, 'assistant', finalResponse, toolsUsed, toolResults);
    
    return {
      response: finalResponse,
      conversation_id: conversationId,
      tools_used: toolsUsed,
      structured_data: this.extractStructuredData(toolResults)
    };
  }
  
  extractStructuredData(toolResults) {
    // Parse tool results to extract staffers, articles, etc.
    const data = {
      staffers: [],
      articles: [],
      bills: []
    };
    
    for (const result of toolResults) {
      try {
        const parsed = JSON.parse(result.content);
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Check what type of data this is
          if (parsed[0].hasOwnProperty('current_position')) {
            data.staffers.push(...parsed);
          } else if (parsed[0].hasOwnProperty('article_id')) {
            data.articles.push(...parsed);
          } else if (parsed[0].hasOwnProperty('bill_number')) {
            data.bills.push(...parsed);
          }
        }
      } catch (e) {
        // Not JSON or parsing failed
      }
    }
    
    return data;
  }
  
  async createConversation() {
    const result = await db.query(
      `INSERT INTO ai_conversations 
       (firm_id, firm_user_id, firm_client_id) 
       VALUES ($1, $2, $3) 
       RETURNING conversation_id`,
      [this.firmContext.firm_id, this.firmUserId, this.firmClientId]
    );
    return result.rows[0].conversation_id;
  }
  
  async getConversationHistory(conversationId) {
    const result = await db.query(
      `SELECT role, content 
       FROM ai_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversationId]
    );
    return result.rows;
  }
  
  async saveMessage(conversationId, role, content, toolsUsed = [], resultsData = []) {
    await db.query(
      `INSERT INTO ai_messages 
       (conversation_id, role, content, tools_used, results_data) 
       VALUES ($1, $2, $3, $4, $5)`,
      [conversationId, role, content, JSON.stringify(toolsUsed), JSON.stringify(resultsData)]
    );
    
    // Update conversation timestamp
    await db.query(
      `UPDATE ai_conversations SET updated_at = NOW() WHERE conversation_id = $1`,
      [conversationId]
    );
  }
}

module.exports = MultiTenantAIAgent;
```

---

## PART 3: API ENDPOINTS

```javascript
// /backend/routes/ai_agent.js

const express = require('express');
const router = express.Router();
const MultiTenantAIAgent = require('../services/ai_agent');
const { authenticateFirmUser } = require('../middleware/auth');

// All routes require firm user authentication
router.use(authenticateFirmUser);

// Main query endpoint
router.post('/query', async (req, res) => {
  try {
    const { query, conversation_id, firm_client_id } = req.body;
    const firmUserId = req.user.id; // From auth middleware
    
    const agent = new MultiTenantAIAgent(firmUserId, firm_client_id);
    const result = await agent.processQuery(query, conversation_id);
    
    res.json(result);
  } catch (error) {
    console.error('AI Agent error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign conversation to client portal
router.post('/conversations/:id/assign', async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { firm_client_id, title, summary } = req.body;
    const firmUserId = req.user.id;
    
    // Mark conversation as assigned
    await db.query(
      `UPDATE ai_conversations 
       SET firm_client_id = $1,
           is_assigned_to_client = TRUE,
           client_visible = TRUE
       WHERE conversation_id = $2 AND firm_user_id = $3`,
      [firm_client_id, conversationId, firmUserId]
    );
    
    // Create knowledge base entry for client portal
    await db.query(
      `INSERT INTO client_knowledge 
       (firm_client_id, title, content, content_type, source_conversation_id, created_by)
       VALUES ($1, $2, $3, 'ai_conversation', $4, $5)`,
      [firm_client_id, title, summary, conversationId, firmUserId]
    );
    
    res.json({ 
      success: true,
      message: 'Conversation assigned to client portal'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversations (optionally filtered by client)
router.get('/conversations', async (req, res) => {
  try {
    const { firm_client_id } = req.query;
    const firmUserId = req.user.id;
    
    let sql = `
      SELECT 
        c.*,
        fc.client_name,
        (SELECT content FROM ai_messages 
         WHERE conversation_id = c.conversation_id 
         AND role = 'user' 
         ORDER BY created_at ASC LIMIT 1) as first_message
      FROM ai_conversations c
      LEFT JOIN firm_clients fc ON c.firm_client_id = fc.id
      WHERE c.firm_user_id = $1
    `;
    
    const params = [firmUserId];
    
    if (firm_client_id) {
      sql += ` AND c.firm_client_id = $2`;
      params.push(firm_client_id);
    }
    
    sql += ` ORDER BY c.updated_at DESC LIMIT 50`;
    
    const result = await db.query(sql, params);
    
    res.json({ conversations: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation with messages
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const firmUserId = req.user.id;
    
    // Get conversation details
    const convResult = await db.query(
      `SELECT c.*, fc.client_name
       FROM ai_conversations c
       LEFT JOIN firm_clients fc ON c.firm_client_id = fc.id
       WHERE c.conversation_id = $1 AND c.firm_user_id = $2`,
      [conversationId, firmUserId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    // Get messages
    const messagesResult = await db.query(
      `SELECT * FROM ai_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversationId]
    );
    
    res.json({
      conversation: convResult.rows[0],
      messages: messagesResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## PART 4: CLIENT PORTAL API ENDPOINTS

```javascript
// /backend/routes/client_portal.js

const express = require('express');
const router = express.Router();
const { authenticateClientPortalUser } = require('../middleware/auth');

// All routes require client portal authentication
router.use(authenticateClientPortalUser);

// Get client portal dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const clientId = req.clientUser.firm_client_id;
    
    // Get client details
    const clientResult = await db.query(
      `SELECT * FROM firm_clients WHERE id = $1`,
      [clientId]
    );
    
    // Get recent knowledge/updates
    const knowledgeResult = await db.query(
      `SELECT * FROM client_knowledge 
       WHERE firm_client_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [clientId]
    );
    
    // Get tracked bills
    const billsResult = await db.query(
      `SELECT * FROM tracked_bills 
       WHERE firm_client_id = $1 
       ORDER BY updated_at DESC`,
      [clientId]
    );
    
    // Get assigned staffers
    const stafferIds = clientResult.rows[0].assigned_staffers || [];
    let staffers = [];
    if (stafferIds.length > 0) {
      const staffersResult = await db.query(
        `SELECT * FROM staffers WHERE id = ANY($1)`,
        [stafferIds]
      );
      staffers = staffersResult.rows;
    }
    
    res.json({
      client: clientResult.rows[0],
      recent_updates: knowledgeResult.rows,
      tracked_bills: billsResult.rows,
      tracked_staffers: staffers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get AI conversations shared with this client
router.get('/conversations', async (req, res) => {
  try {
    const clientId = req.clientUser.firm_client_id;
    
    const result = await db.query(
      `SELECT 
        c.*,
        (SELECT content FROM ai_messages 
         WHERE conversation_id = c.conversation_id 
         AND role = 'user' 
         ORDER BY created_at ASC LIMIT 1) as first_message
       FROM ai_conversations c
       WHERE c.firm_client_id = $1 
       AND c.client_visible = TRUE
       ORDER BY c.updated_at DESC`,
      [clientId]
    );
    
    res.json({ conversations: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// View specific conversation (if assigned to this client)
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const clientId = req.clientUser.firm_client_id;
    
    // Verify access
    const convResult = await db.query(
      `SELECT * FROM ai_conversations 
       WHERE conversation_id = $1 
       AND firm_client_id = $2 
       AND client_visible = TRUE`,
      [conversationId, clientId]
    );
    
    if (convResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get messages
    const messagesResult = await db.query(
      `SELECT * FROM ai_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC`,
      [conversationId]
    );
    
    res.json({
      conversation: convResult.rows[0],
      messages: messagesResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tracked bills with updates
router.get('/bills', async (req, res) => {
  try {
    const clientId = req.clientUser.firm_client_id;
    
    const result = await db.query(
      `SELECT * FROM tracked_bills 
       WHERE firm_client_id = $1 
       ORDER BY updated_at DESC`,
      [clientId]
    );
    
    res.json({ bills: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

---

## PART 5: FRONTEND UPDATES

### Client Selector in AI Chat

```jsx
// /frontend/pages/AIAgent.jsx

export default function AIAgentPage() {
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // NEW: Client selection
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  useEffect(() => {
    fetchClients();
    fetchConversations();
  }, []);
  
  async function fetchClients() {
    const res = await fetch('/api/firm/clients');
    const data = await res.json();
    setClients(data.clients);
  }
  
  async function sendMessage() {
    if (!input.trim()) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/ai-agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: input,
          conversation_id: currentConversation,
          firm_client_id: selectedClient?.id // Pass client context
        })
      });
      
      const data = await res.json();
      
      // Add assistant response with structured data
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        tools_used: data.tools_used,
        structured_data: data.structured_data // Staffers, articles, etc.
      }]);
      
      setCurrentConversation(data.conversation_id);
      fetchConversations();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }
  
  async function assignToClientPortal() {
    if (!selectedClient || !currentConversation) return;
    
    const title = prompt("Enter a title for this research:");
    if (!title) return;
    
    const summary = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content)
      .join('\n\n')
      .substring(0, 500);
    
    try {
      await fetch(`/api/ai-agent/conversations/${currentConversation}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firm_client_id: selectedClient.id,
          title,
          summary
        })
      });
      
      alert(`Assigned to ${selectedClient.client_name} portal!`);
    } catch (error) {
      alert('Failed to assign conversation');
    }
  }
  
  return (
    <div className="ai-agent-page">
      <aside className="conversations-sidebar">
        {/* Existing sidebar */}
      </aside>
      
      <main className="chat-main">
        <div className="chat-header">
          <div>
            <h1><Icon name="sparkles" /> AI Research Assistant</h1>
            <p>AI-powered political intelligence</p>
          </div>
          
          {/* NEW: Client selector */}
          <div className="client-selector">
            <label>Research for:</label>
            <select 
              value={selectedClient?.id || ''} 
              onChange={(e) => {
                const client = clients.find(c => c.id === parseInt(e.target.value));
                setSelectedClient(client);
              }}
            >
              <option value="">No specific client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.client_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {selectedClient && (
          <div className="client-context-banner">
            <Icon name="briefcase" />
            <span>Researching for: <strong>{selectedClient.client_name}</strong></span>
            <span className="topics">
              Focus: {selectedClient.tracked_topics?.join(', ') || 'General'}
            </span>
          </div>
        )}
        
        <div className="messages-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? <Icon name="user" /> : <Icon name="cpu" />}
              </div>
              
              <div className="message-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
                
                {/* NEW: Render structured data */}
                {msg.structured_data && (
                  <StructuredDataDisplay data={msg.structured_data} />
                )}
                
                {msg.tools_used && msg.tools_used.length > 0 && (
                  <div className="tools-used">
                    <Icon name="tool" size={12} />
                    <span>Used: {msg.tools_used.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="input-area">
          {selectedClient && currentConversation && (
            <button 
              onClick={assignToClientPortal}
              className="assign-btn"
              title="Share with client portal"
            >
              <Icon name="share" /> Assign to Portal
            </button>
          )}
          
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={
              selectedClient 
                ? `Research for ${selectedClient.client_name}...` 
                : "Ask me anything..."
            }
            rows={3}
            disabled={loading}
          />
          
          <button onClick={sendMessage} disabled={loading || !input.trim()}>
            {loading ? <Spinner /> : <Icon name="send" />}
          </button>
        </div>
      </main>
    </div>
  );
}
```

### Structured Data Display Component

```jsx
// /frontend/components/StructuredDataDisplay.jsx

function StructuredDataDisplay({ data }) {
  if (!data) return null;
  
  return (
    <div className="structured-data">
      {/* Staffers found */}
      {data.staffers && data.staffers.length > 0 && (
        <div className="data-section">
          <h4>📋 Found {data.staffers.length} Staffers</h4>
          <div className="staffer-cards">
            {data.staffers.map(staffer => (
              <div key={staffer.id} className="staffer-card">
                <div className="staffer-info">
                  <h5>{staffer.name}</h5>
                  <p className="position">{staffer.current_position}</p>
                  <p className="org">{staffer.current_organization}</p>
                  {staffer.specialty && (
                    <span className="specialty-badge">{staffer.specialty}</span>
                  )}
                </div>
                <div className="staffer-actions">
                  <button 
                    onClick={() => window.open(`/staffers/${staffer.id}`, '_blank')}
                    className="btn-sm"
                  >
                    View Profile →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Articles found */}
      {data.articles && data.articles.length > 0 && (
        <div className="data-section">
          <h4>📰 Found {data.articles.length} Articles</h4>
          <div className="article-list">
            {data.articles.map(article => (
              <div key={article.id} className="article-item">
                <h5>{article.title}</h5>
                <div className="article-meta">
                  <span className="source">{article.source}</span>
                  <span className="date">{formatDate(article.published_date)}</span>
                </div>
                <a href={article.url} target="_blank" rel="noopener">
                  Read Article →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Bills tracked */}
      {data.bills && data.bills.length > 0 && (
        <div className="data-section">
          <h4>📜 Tracking {data.bills.length} Bills</h4>
          <div className="bill-list">
            {data.bills.map(bill => (
              <div key={bill.id} className="bill-item">
                <strong>{bill.bill_number}</strong>
                {bill.bill_title && <p>{bill.bill_title}</p>}
                {bill.status && <span className="status-badge">{bill.status}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Client Portal View

```jsx
// /frontend/pages/ClientPortal.jsx

export default function ClientPortalDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchDashboard();
  }, []);
  
  async function fetchDashboard() {
    const res = await fetch('/api/client-portal/dashboard');
    const data = await res.json();
    setDashboard(data);
    setLoading(false);
  }
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="client-portal">
      <header className="portal-header">
        <img src={dashboard.client.portal_logo_url} alt="Logo" />
        <h1>{dashboard.client.client_name}</h1>
        <p>Your Legislative Intelligence Portal</p>
      </header>
      
      <div className="portal-grid">
        {/* Recent Updates from Firm */}
        <section className="portal-section">
          <h2>📬 Recent Updates</h2>
          {dashboard.recent_updates.map(update => (
            <div key={update.id} className="update-card">
              <h3>{update.title}</h3>
              <p className="excerpt">{update.content.substring(0, 200)}...</p>
              <div className="meta">
                <span>{formatDate(update.created_at)}</span>
                {update.content_type === 'ai_conversation' && (
                  <button onClick={() => viewConversation(update.source_conversation_id)}>
                    View Full Research →
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
        
        {/* Tracked Bills */}
        <section className="portal-section">
          <h2>📜 Legislation We're Tracking</h2>
          {dashboard.tracked_bills.map(bill => (
            <div key={bill.id} className="bill-card">
              <h3>{bill.bill_number}</h3>
              <p className="bill-title">{bill.bill_title}</p>
              <p className="status">Status: {bill.status}</p>
              {bill.impact_summary && (
                <p className="impact">{bill.impact_summary}</p>
              )}
              <p className="last-action">
                Last Action: {bill.last_action} ({formatDate(bill.last_action_date)})
              </p>
            </div>
          ))}
        </section>
        
        {/* Key Staffers */}
        <section className="portal-section">
          <h2>👥 Key Congressional Staffers</h2>
          <div className="staffer-grid">
            {dashboard.tracked_staffers.map(staffer => (
              <div key={staffer.id} className="staffer-card">
                <h4>{staffer.name}</h4>
                <p>{staffer.current_position}</p>
                <p className="org">{staffer.current_organization}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
```

---

## PART 6: AUTHENTICATION MIDDLEWARE

```javascript
// /backend/middleware/auth.js

const jwt = require('jsonwebtoken');

// Authenticate lobbying firm users
async function authenticateFirmUser(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get firm user
    const result = await db.query(
      `SELECT fu.*, f.id as firm_id, f.name as firm_name
       FROM firm_users fu
       JOIN firms f ON fu.firm_id = f.id
       WHERE fu.id = $1 AND f.is_active = TRUE`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Authenticate client portal users
async function authenticateClientPortalUser(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get client portal user
    const result = await db.query(
      `SELECT cpu.*, fc.*, f.id as firm_id
       FROM client_portal_users cpu
       JOIN firm_clients fc ON cpu.firm_client_id = fc.id
       JOIN firms f ON fc.firm_id = f.id
       WHERE cpu.id = $1 AND fc.portal_enabled = TRUE`,
      [decoded.clientUserId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.clientUser = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  authenticateFirmUser,
  authenticateClientPortalUser
};
```

---

## IMPLEMENTATION CHECKLIST

- [ ] Run database migrations (create all new tables)
- [ ] Update AI Agent to use MultiTenantAIAgent class
- [ ] Add client selector to AI chat interface
- [ ] Add "Assign to Portal" button
- [ ] Create client portal dashboard page
- [ ] Test conversation assignment flow
- [ ] Test client portal access
- [ ] Add authentication middleware
- [ ] Test multi-tenant data isolation (critical for security!)
- [ ] Add firm and client management pages (create/edit)

---

## SECURITY NOTES

**Critical:** Ensure data isolation between firms and clients!

- Always filter by `firm_id` in queries
- Client portal users can ONLY see data assigned to their `firm_client_id`
- Verify ownership before allowing edits/deletes
- Use parameterized queries (already done above)
- Rate limit AI queries per firm

---

This setup gives you a complete multi-tenant platform where lobbying firms can use AI research and share insights with their clients through branded portals.
