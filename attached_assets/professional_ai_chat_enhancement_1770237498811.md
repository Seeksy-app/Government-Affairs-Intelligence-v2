# TRANSFORM AI CHAT INTO PROFESSIONAL INTELLIGENCE TOOL

Fix the AI Research Assistant to provide professional, actionable intelligence with proper formatting, interactive links, structured data cards, and intelligent follow-up suggestions.

---

## PROBLEM ANALYSIS

**Current Output Issues:**
❌ Uses asterisks (***) instead of proper formatting
❌ No links to people mentioned
❌ No links to firms/organizations
❌ Plain text lists (not actionable)
❌ No follow-up suggestions
❌ Doesn't leverage your database
❌ Generic information (could come from ChatGPT)

**What Lobbying Firms Actually Need:**
✅ Direct links to LinkedIn profiles
✅ Links to firm websites
✅ Clickable names → Your database profiles
✅ Related bills and articles
✅ Contact information where available
✅ Smart follow-up questions
✅ Professional card-based layout
✅ Actionable next steps

---

## PART 1: ENHANCED AI SYSTEM PROMPT

Update your AI agent's system prompt to include these instructions:

### File: `/backend/services/ai_agent.js`

```javascript
// In the getSystemPrompt() method, add this to the system prompt:

const ENHANCED_SYSTEM_PROMPT = `
You are a professional political intelligence assistant for a lobbying platform.

CRITICAL FORMATTING RULES:

1. NEVER use asterisks (*, **, ***) for emphasis or formatting
2. Use proper HTML/Markdown for structure
3. Return structured data for ALL entities mentioned
4. Provide actionable intelligence, not generic information

RESPONSE STRUCTURE:

When mentioning PEOPLE:
- Format: [Name] - [Title] at [Organization]
- Include: LinkedIn URL if known, or website
- Add to structured_data.people array

When mentioning FIRMS:
- Format: [Firm Name] - [Specialty]
- Include: Website URL
- Add to structured_data.firms array

When mentioning BILLS:
- Format: [Bill Number]: [Short Title]
- Include: Congress.gov link
- Add to structured_data.bills array

EXAMPLE GOOD RESPONSE:

"The top tech lobbyists include:

**Google/Alphabet:**
Mark Isakowitz - Vice President of Government Affairs at Google
• Previously served as Deputy Staff Director for Senate Finance Committee
• Contact: LinkedIn | Google Public Policy

Represented by:
• Holland & Knight - Technology policy specialists
• K&L Gates - Federal government relations

**Meta (Facebook):**
Joel Kaplan - Vice President, Global Public Policy
• Former Deputy Chief of Staff to President George W. Bush
• Contact: LinkedIn | Meta Newsroom

[Continue with all companies...]

Would you like me to:
• Find recent bills these lobbyists are working on?
• Show articles mentioning these individuals?
• Create a network visualization of their connections?
• Track their recent congressional meetings?"

STRUCTURED DATA TO RETURN:

{
  "people": [
    {
      "name": "Mark Isakowitz",
      "title": "Vice President of Government Affairs",
      "organization": "Google",
      "linkedin_url": "https://www.linkedin.com/in/markisakowitz/",
      "profile_url": "https://google.com/publicpolicy/team/mark-isakowitz",
      "in_database": false
    }
  ],
  "firms": [
    {
      "name": "Holland & Knight",
      "specialty": "Technology policy",
      "website": "https://www.hklaw.com",
      "in_database": false
    }
  ],
  "bills": [
    {
      "number": "H.R. 1234",
      "title": "Tech Policy Act",
      "congress_url": "https://www.congress.gov/bill/118th-congress/house-bill/1234"
    }
  ],
  "follow_up_suggestions": [
    "Find recent bills these lobbyists are working on",
    "Show articles mentioning Mark Isakowitz",
    "Create a network map of Google's lobbying connections",
    "Track recent congressional meetings"
  ]
}

SEARCH YOUR DATABASE FIRST:

Before providing generic information:
1. Search YOUR staffers database for any names mentioned
2. Search YOUR news articles for recent mentions
3. Search YOUR tracked bills for related legislation
4. If found in database, provide direct links to profiles

ALWAYS END WITH FOLLOW-UP SUGGESTIONS:

Provide 3-5 intelligent next steps based on the query, such as:
• "Find bills related to [topic]"
• "Show recent articles about [person]"
• "Track [organization]'s lobbying activity"
• "Create network visualization"
• "Set up alerts for [topic]"
`;
```

---

## PART 2: ENHANCED RESPONSE PROCESSOR

### File: `/backend/services/ai_response_processor.js`

```javascript
class AIResponseProcessor {
  constructor() {
    this.linkedInSearchBase = 'https://www.linkedin.com/search/results/people/?keywords=';
  }
  
  // Process AI response and enrich with links and data
  async processResponse(aiResponse, query, userId) {
    const processed = {
      formatted_text: await this.formatText(aiResponse.text),
      entities: await this.enrichEntities(aiResponse.structured_data, userId),
      follow_ups: this.generateFollowUps(aiResponse.structured_data, query),
      actionable_items: this.generateActionableItems(aiResponse.structured_data)
    };
    
    return processed;
  }
  
  // Format text - remove asterisks, add proper HTML
  async formatText(text) {
    let formatted = text;
    
    // Remove asterisk formatting
    formatted = formatted.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong class="highlight">$1</strong>');
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Add proper line breaks
    formatted = formatted.replace(/\n\n/g, '</p><p>');
    formatted = `<p>${formatted}</p>`;
    
    return formatted;
  }
  
  // Enrich entities with database lookups and external links
  async enrichEntities(structuredData, userId) {
    const db = require('../db');
    const enriched = {
      people: [],
      firms: [],
      bills: []
    };
    
    // Enrich people
    if (structuredData?.people) {
      for (const person of structuredData.people) {
        // Check if person exists in your database
        const dbCheck = await db.query(
          `SELECT id, name, current_position, current_organization 
           FROM staffers 
           WHERE name ILIKE $1 
           LIMIT 1`,
          [`%${person.name}%`]
        );
        
        let enrichedPerson = { ...person };
        
        if (dbCheck.rows.length > 0) {
          // Person is in your database
          enrichedPerson.in_database = true;
          enrichedPerson.profile_url = `/staffers/${dbCheck.rows[0].id}`;
          enrichedPerson.database_id = dbCheck.rows[0].id;
        } else {
          // Generate LinkedIn search link
          enrichedPerson.linkedin_search_url = this.getLinkedInSearchURL(person.name, person.organization);
          enrichedPerson.google_search_url = this.getGoogleSearchURL(person.name, person.organization);
        }
        
        enriched.people.push(enrichedPerson);
      }
    }
    
    // Enrich firms
    if (structuredData?.firms) {
      for (const firm of structuredData.firms) {
        let enrichedFirm = { ...firm };
        
        // Try to find firm website if not provided
        if (!enrichedFirm.website) {
          enrichedFirm.google_search_url = `https://www.google.com/search?q=${encodeURIComponent(firm.name)}`;
        }
        
        // Check if any staffers in your database worked at this firm
        const staffersAtFirm = await db.query(
          `SELECT COUNT(*) as count FROM career_positions 
           WHERE organization ILIKE $1`,
          [`%${firm.name}%`]
        );
        
        if (staffersAtFirm.rows[0].count > 0) {
          enrichedFirm.staffers_in_database = parseInt(staffersAtFirm.rows[0].count);
          enrichedFirm.view_staffers_url = `/search?org=${encodeURIComponent(firm.name)}`;
        }
        
        enriched.firms.push(enrichedFirm);
      }
    }
    
    // Enrich bills
    if (structuredData?.bills) {
      for (const bill of structuredData.bills) {
        let enrichedBill = { ...bill };
        
        // Add Congress.gov link
        if (!enrichedBill.congress_url) {
          enrichedBill.congress_url = this.getCongressGovURL(bill.number);
        }
        
        // Check if bill is being tracked
        const trackingCheck = await db.query(
          `SELECT id FROM tracked_bills WHERE bill_number = $1 LIMIT 1`,
          [bill.number]
        );
        
        if (trackingCheck.rows.length > 0) {
          enrichedBill.is_tracked = true;
          enrichedBill.view_url = `/bills/${bill.number}`;
        } else {
          enrichedBill.is_tracked = false;
          enrichedBill.track_url = `/bills/track?number=${bill.number}`;
        }
        
        enriched.bills.push(enrichedBill);
      }
    }
    
    return enriched;
  }
  
  // Generate intelligent follow-up suggestions
  generateFollowUps(structuredData, originalQuery) {
    const suggestions = [];
    
    // Based on people mentioned
    if (structuredData?.people?.length > 0) {
      const firstPerson = structuredData.people[0];
      suggestions.push({
        text: `Find recent articles mentioning ${firstPerson.name}`,
        query: `Find recent news articles about ${firstPerson.name}`,
        icon: 'newspaper'
      });
      
      suggestions.push({
        text: `Show ${firstPerson.name}'s career history`,
        query: `What is ${firstPerson.name}'s complete career history?`,
        icon: 'briefcase'
      });
      
      if (structuredData.people.length > 1) {
        suggestions.push({
          text: `Map connections between these individuals`,
          query: `Create a network visualization showing connections between ${structuredData.people.map(p => p.name).join(', ')}`,
          icon: 'network'
        });
      }
    }
    
    // Based on firms mentioned
    if (structuredData?.firms?.length > 0) {
      const firstFirm = structuredData.firms[0];
      suggestions.push({
        text: `Find all staffers who worked at ${firstFirm.name}`,
        query: `Show me all congressional staffers who previously worked at ${firstFirm.name}`,
        icon: 'users'
      });
    }
    
    // Based on bills mentioned
    if (structuredData?.bills?.length > 0) {
      const firstBill = structuredData.bills[0];
      suggestions.push({
        text: `Track ${firstBill.number} for updates`,
        query: `Add ${firstBill.number} to my tracked bills and alert me of changes`,
        icon: 'bell'
      });
      
      suggestions.push({
        text: `Find key staffers working on ${firstBill.number}`,
        query: `Who are the key congressional staffers working on ${firstBill.number}?`,
        icon: 'users'
      });
    }
    
    // Generic relevant follow-ups based on query
    if (originalQuery.toLowerCase().includes('lobbyi')) {
      suggestions.push({
        text: `Show recent lobbying disclosure filings`,
        query: `Show recent lobbying disclosure filings related to this topic`,
        icon: 'file-text'
      });
    }
    
    // Always offer network visualization if multiple entities
    const totalEntities = (structuredData?.people?.length || 0) + 
                         (structuredData?.firms?.length || 0);
    if (totalEntities >= 3) {
      suggestions.push({
        text: `Create visual network map`,
        query: `Create a Miro board showing the network connections between these entities`,
        icon: 'share-2'
      });
    }
    
    return suggestions.slice(0, 5); // Max 5 suggestions
  }
  
  // Generate actionable items
  generateActionableItems(structuredData) {
    const actions = [];
    
    if (structuredData?.people?.length > 0) {
      actions.push({
        type: 'add_to_research',
        label: 'Add these people to my research list',
        count: structuredData.people.length,
        icon: 'user-plus'
      });
    }
    
    if (structuredData?.bills?.length > 0) {
      const untrackedBills = structuredData.bills.filter(b => !b.is_tracked);
      if (untrackedBills.length > 0) {
        actions.push({
          type: 'track_bills',
          label: `Track ${untrackedBills.length} bill${untrackedBills.length > 1 ? 's' : ''}`,
          bills: untrackedBills.map(b => b.number),
          icon: 'bookmark'
        });
      }
    }
    
    if (structuredData?.firms?.length > 0) {
      actions.push({
        type: 'research_firms',
        label: 'Research these firms',
        firms: structuredData.firms.map(f => f.name),
        icon: 'building'
      });
    }
    
    return actions;
  }
  
  // Helper: Get LinkedIn search URL
  getLinkedInSearchURL(name, organization) {
    const query = organization 
      ? `${name} ${organization}`
      : name;
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
  }
  
  // Helper: Get Google search URL
  getGoogleSearchURL(name, organization) {
    const query = organization 
      ? `${name} ${organization} government affairs`
      : `${name} government affairs`;
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
  
  // Helper: Get Congress.gov URL
  getCongressGovURL(billNumber) {
    // Parse bill number (e.g., "H.R. 1234" or "S. 567")
    const match = billNumber.match(/(H\.R\.|S\.)?\s*(\d+)/i);
    if (!match) return null;
    
    const chamber = billNumber.toUpperCase().includes('S.') ? 'senate' : 'house';
    const number = match[2];
    
    return `https://www.congress.gov/bill/118th-congress/${chamber}-bill/${number}`;
  }
}

module.exports = AIResponseProcessor;
```

---

## PART 3: ENHANCED FRONTEND COMPONENTS

### File: `/frontend/components/EnhancedAIResponse.jsx`

```jsx
import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function EnhancedAIResponse({ message }) {
  const { formatted_text, entities, follow_ups, actionable_items } = message.processed_response || {};
  
  return (
    <div className="enhanced-ai-response">
      {/* Main response text */}
      <div 
        className="response-text"
        dangerouslySetInnerHTML={{ __html: formatted_text || message.content }}
      />
      
      {/* Entity Cards */}
      {entities && (
        <div className="entities-section">
          {entities.people?.length > 0 && (
            <PeopleCards people={entities.people} />
          )}
          
          {entities.firms?.length > 0 && (
            <FirmCards firms={entities.firms} />
          )}
          
          {entities.bills?.length > 0 && (
            <BillCards bills={entities.bills} />
          )}
        </div>
      )}
      
      {/* Actionable Items */}
      {actionable_items?.length > 0 && (
        <ActionableItems items={actionable_items} />
      )}
      
      {/* Follow-up Suggestions */}
      {follow_ups?.length > 0 && (
        <FollowUpSuggestions suggestions={follow_ups} />
      )}
    </div>
  );
}

function PeopleCards({ people }) {
  return (
    <div className="entity-cards-section">
      <h4 className="section-title">
        <Icon name="users" size={16} />
        Key People Mentioned
      </h4>
      
      <div className="entity-cards-grid">
        {people.map((person, idx) => (
          <div key={idx} className="person-card">
            <div className="person-header">
              <div className="person-avatar">
                {person.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="person-info">
                <h5>{person.name}</h5>
                <p className="person-title">{person.title}</p>
                <p className="person-org">{person.organization}</p>
              </div>
            </div>
            
            <div className="person-actions">
              {person.in_database ? (
                <Link to={person.profile_url} className="btn btn-sm btn-primary">
                  <Icon name="user" size={14} />
                  View Profile
                </Link>
              ) : (
                <>
                  {person.linkedin_url && (
                    <a 
                      href={person.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      <Icon name="linkedin" size={14} />
                      LinkedIn
                    </a>
                  )}
                  {person.linkedin_search_url && (
                    <a 
                      href={person.linkedin_search_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      <Icon name="search" size={14} />
                      Find on LinkedIn
                    </a>
                  )}
                  {person.google_search_url && (
                    <a 
                      href={person.google_search_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                    >
                      <Icon name="search" size={14} />
                      Google Search
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FirmCards({ firms }) {
  return (
    <div className="entity-cards-section">
      <h4 className="section-title">
        <Icon name="building" size={16} />
        Firms & Organizations
      </h4>
      
      <div className="entity-cards-grid">
        {firms.map((firm, idx) => (
          <div key={idx} className="firm-card">
            <div className="firm-header">
              <Icon name="building" size={24} className="firm-icon" />
              <div className="firm-info">
                <h5>{firm.name}</h5>
                {firm.specialty && (
                  <p className="firm-specialty">{firm.specialty}</p>
                )}
              </div>
            </div>
            
            {firm.staffers_in_database > 0 && (
              <div className="firm-stat">
                <Icon name="users" size={14} />
                <span>{firm.staffers_in_database} staffer{firm.staffers_in_database > 1 ? 's' : ''} in database</span>
              </div>
            )}
            
            <div className="firm-actions">
              {firm.view_staffers_url && (
                <Link to={firm.view_staffers_url} className="btn btn-sm btn-primary">
                  <Icon name="users" size={14} />
                  View Staffers
                </Link>
              )}
              {firm.website && (
                <a 
                  href={firm.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-secondary"
                >
                  <Icon name="external-link" size={14} />
                  Website
                </a>
              )}
              {firm.google_search_url && (
                <a 
                  href={firm.google_search_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-secondary"
                >
                  <Icon name="search" size={14} />
                  Search
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillCards({ bills }) {
  return (
    <div className="entity-cards-section">
      <h4 className="section-title">
        <Icon name="file-text" size={16} />
        Related Legislation
      </h4>
      
      <div className="bill-cards-list">
        {bills.map((bill, idx) => (
          <div key={idx} className="bill-card">
            <div className="bill-header">
              <span className="bill-number">{bill.number}</span>
              {bill.is_tracked && (
                <span className="tracking-badge">
                  <Icon name="bookmark" size={12} />
                  Tracking
                </span>
              )}
            </div>
            
            <h5 className="bill-title">{bill.title}</h5>
            
            <div className="bill-actions">
              {bill.is_tracked ? (
                <Link to={bill.view_url} className="btn btn-sm btn-primary">
                  <Icon name="eye" size={14} />
                  View Details
                </Link>
              ) : (
                <button 
                  onClick={() => trackBill(bill.number)}
                  className="btn btn-sm btn-primary"
                >
                  <Icon name="bookmark" size={14} />
                  Track Bill
                </button>
              )}
              
              <a 
                href={bill.congress_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-sm btn-secondary"
              >
                <Icon name="external-link" size={14} />
                Congress.gov
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionableItems({ items }) {
  return (
    <div className="actionable-items">
      <h4 className="section-title">Quick Actions</h4>
      
      <div className="action-buttons">
        {items.map((item, idx) => (
          <button 
            key={idx}
            onClick={() => handleAction(item)}
            className="action-button"
          >
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FollowUpSuggestions({ suggestions }) {
  return (
    <div className="follow-up-suggestions">
      <h4 className="section-title">
        <Icon name="message-circle" size={16} />
        Suggested Follow-ups
      </h4>
      
      <div className="suggestions-list">
        {suggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => askFollowUp(suggestion.query)}
            className="suggestion-button"
          >
            <Icon name={suggestion.icon} size={14} />
            <span>{suggestion.text}</span>
            <Icon name="arrow-right" size={14} />
          </button>
        ))}
      </div>
    </div>
  );
}

function askFollowUp(query) {
  // Trigger new AI query
  const event = new CustomEvent('ai-follow-up-query', { detail: { query } });
  window.dispatchEvent(event);
}

async function trackBill(billNumber) {
  // API call to track bill
  await fetch('/api/bills/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bill_number: billNumber })
  });
  
  alert(`Now tracking ${billNumber}`);
}

function handleAction(item) {
  // Handle different action types
  switch (item.type) {
    case 'add_to_research':
      // Add people to research list
      break;
    case 'track_bills':
      // Track multiple bills
      break;
    case 'research_firms':
      // Research firms
      break;
  }
}
```

---

## PART 4: ENHANCED STYLING

### File: `/frontend/styles/enhanced-ai-response.css`

```css
.enhanced-ai-response {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.response-text {
  line-height: 1.7;
  color: #374151;
}

.response-text p {
  margin-bottom: 16px;
}

.response-text strong {
  color: #111827;
  font-weight: 600;
}

.response-text .highlight {
  background: #fef3c7;
  padding: 2px 6px;
  border-radius: 4px;
  color: #92400e;
}

/* Entity Cards Section */
.entities-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.entity-cards-section {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #374151;
}

/* People Cards */
.entity-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.person-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.person-card:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
}

.person-header {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.person-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 16px;
  flex-shrink: 0;
}

.person-info h5 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.person-title {
  font-size: 14px;
  color: #4b5563;
  margin: 0 0 2px 0;
}

.person-org {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.person-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Firm Cards */
.firm-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.firm-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.firm-icon {
  color: #2563eb;
}

.firm-info h5 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
}

.firm-specialty {
  font-size: 13px;
  color: #6b7280;
  margin: 0;
}

.firm-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #059669;
  margin-bottom: 12px;
  padding: 8px;
  background: #d1fae5;
  border-radius: 6px;
}

.firm-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Bill Cards */
.bill-cards-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bill-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
}

.bill-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bill-number {
  font-weight: 700;
  color: #2563eb;
  font-size: 14px;
}

.tracking-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
}

.bill-title {
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 12px 0;
  color: #374151;
}

.bill-actions {
  display: flex;
  gap: 8px;
}

/* Actionable Items */
.actionable-items {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 20px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  background: white;
  border: 1px solid #2563eb;
  color: #2563eb;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.action-button:hover {
  background: #2563eb;
  color: white;
}

/* Follow-up Suggestions */
.follow-up-suggestions {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  color: #374151;
}

.suggestion-button:hover {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
}

.suggestion-button span {
  flex: 1;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  border: none;
}

.btn-sm {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

/* Responsive */
@media (max-width: 768px) {
  .entity-cards-grid {
    grid-template-columns: 1fr;
  }
  
  .person-actions,
  .firm-actions,
  .bill-actions {
    flex-direction: column;
  }
  
  .person-actions .btn,
  .firm-actions .btn,
  .bill-actions .btn {
    width: 100%;
  }
}
```

---

## PART 5: UPDATE AI AGENT TO USE PROCESSOR

### File: `/backend/services/ai_agent.js`

```javascript
const AIResponseProcessor = require('./ai_response_processor');

class MultiTenantAIAgent {
  constructor(firmUserId, firmClientId = null) {
    // ... existing constructor ...
    this.responseProcessor = new AIResponseProcessor();
  }
  
  async processQuery(userQuery, conversationId = null) {
    // ... existing code to call Claude and get response ...
    
    // NEW: Process the response before returning
    const processed = await this.responseProcessor.processResponse(
      {
        text: finalResponse,
        structured_data: extractedStructuredData
      },
      userQuery,
      this.firmUserId
    );
    
    return {
      response: finalResponse,
      processed_response: processed, // NEW: Include processed version
      conversation_id: conversationId,
      tools_used: toolsUsed,
      structured_data: extractedStructuredData
    };
  }
}
```

---

## IMPLEMENTATION CHECKLIST

- [ ] Update AI system prompt with enhanced formatting rules
- [ ] Create AIResponseProcessor service
- [ ] Create EnhancedAIResponse component
- [ ] Add enhanced styling CSS
- [ ] Update AI Agent to use processor
- [ ] Test with query: "Who are the top lobbyists for tech companies?"
- [ ] Verify links work (LinkedIn, firms, bills)
- [ ] Test follow-up suggestions
- [ ] Test actionable items
- [ ] Deploy and monitor

---

This transforms your AI chat from a C- to an A+! 🎯
