# BUILD: Political Staffing & Career Mapping Feature

Add a complete political staffing research module to our existing creator management platform. This allows users to search congressional staffers, map their career trajectories, visualize networks, and track movements between offices.

---

## DATABASE SCHEMA

Create these PostgreSQL tables:

```sql
CREATE TABLE staffers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  current_position VARCHAR(255),
  current_organization VARCHAR(255),
  current_member VARCHAR(255),
  chamber VARCHAR(20) CHECK (chamber IN ('House', 'Senate', 'Both', 'Former')),
  party VARCHAR(20) CHECK (party IN ('Republican', 'Democrat', 'Independent')),
  state CHAR(2),
  specialty TEXT,
  pathway_type VARCHAR(100),
  years_in_current_role INTEGER,
  education JSONB,
  contact_email VARCHAR(255),
  linkedin_url VARCHAR(255),
  photo_url VARCHAR(255),
  bio TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE career_positions (
  id SERIAL PRIMARY KEY,
  staffer_id INTEGER REFERENCES staffers(id) ON DELETE CASCADE,
  position VARCHAR(255) NOT NULL,
  organization VARCHAR(255) NOT NULL,
  boss_name VARCHAR(255),
  start_year INTEGER NOT NULL,
  end_year INTEGER,
  is_current BOOLEAN DEFAULT FALSE,
  org_type VARCHAR(100),
  chamber VARCHAR(20),
  state CHAR(2),
  concurrent BOOLEAN DEFAULT FALSE,
  description TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE connections (
  id SERIAL PRIMARY KEY,
  staffer_id INTEGER REFERENCES staffers(id) ON DELETE CASCADE,
  connected_to_name VARCHAR(255) NOT NULL,
  connected_to_id INTEGER REFERENCES staffers(id) ON DELETE SET NULL,
  connection_type VARCHAR(50),
  organization VARCHAR(255),
  years_together INTEGER,
  strength VARCHAR(20) DEFAULT 'Medium',
  notes TEXT
);

CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  org_type VARCHAR(100),
  chamber VARCHAR(20),
  party VARCHAR(20),
  state CHAR(2),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_staffers_name ON staffers(name);
CREATE INDEX idx_staffers_member ON staffers(current_member);
CREATE INDEX idx_staffers_chamber ON staffers(chamber);
CREATE INDEX idx_career_staffer ON career_positions(staffer_id);
CREATE INDEX idx_career_years ON career_positions(start_year, end_year);
```

---

## BACKEND API ENDPOINTS

Create these REST API endpoints (Flask or Express):

**Base path: `/api/staffers`**

### Search & Discovery
```
GET  /api/staffers/search
  Query params: ?q=name&member=&chamber=&party=&state=&specialty=&limit=50&offset=0
  Returns: { staffers: [], total: number, page_info: {} }

GET  /api/staffers/:id
  Returns: Full staffer profile with career_positions and connections

GET  /api/staffers/:id/timeline
  Returns: Career positions sorted chronologically with year gaps calculated

GET  /api/staffers/:id/network
  Returns: { nodes: [staffers, orgs], edges: [connections], stats: {} }

GET  /api/staffers/by-member/:member_name
  Returns: All current staffers for a specific member

GET  /api/staffers/by-organization/:org_name
  Returns: Current and former staffers from an organization
```

### Analysis & Export
```
GET  /api/staffers/pathways
  Query params: ?from_type=&to_type=
  Returns: Common career pathways with counts

GET  /api/staffers/stats
  Returns: Platform-wide statistics (total staffers, top orgs, etc.)

GET  /api/staffers/:id/export
  Query params: ?format=json|csv|graphml
  Returns: Career and network data in requested format

POST /api/staffers/:id/sync
  Triggers real-time scrape for this staffer (rate-limited)
  Returns: { updated: true/false, changes: [] }
```

### Data Management (Admin)
```
POST   /api/staffers
  Body: { name, current_position, ... }
  Creates new staffer profile

PUT    /api/staffers/:id
  Body: Updated fields
  Updates staffer

POST   /api/staffers/:id/positions
  Body: { position, organization, start_year, ... }
  Adds career position

DELETE /api/staffers/:id/positions/:position_id
  Removes career position

POST   /api/staffers/import
  Body: FormData with CSV file
  Bulk imports staffers from CSV

POST   /api/staffers/batch-update
  Triggers periodic scraper for all tracked staffers
  Returns: { queued: number, job_id: string }
```

---

## FRONTEND PAGES & COMPONENTS

### 1. Staffer Search Page (`/staffers`)

**Layout:**
- Search bar with filters panel (collapsible)
- Filter options:
  - Name search (autocomplete)
  - Current Member dropdown
  - Chamber (House/Senate/Both)
  - Party (R/D/I)
  - State dropdown
  - Specialty (Communications, Policy, Legal, Operations, etc.)
- Results grid/list view toggle
- Pagination

**Result Cards:**
```jsx
<StafferCard>
  <Avatar src={photo_url} />
  <Name>{name}</Name>
  <CurrentPosition>{position} • {current_member}</CurrentPosition>
  <Tags>
    <Badge color={partyColor}>{party}</Badge>
    <Badge>{chamber}</Badge>
    <Badge>{pathway_type}</Badge>
  </Tags>
  <Stats>
    <Stat>{years_in_current_role}y current role</Stat>
    <Stat>{career_positions.length} positions</Stat>
  </Stats>
  <Actions>
    <Button>View Profile</Button>
    <Button variant="outline">Network</Button>
  </Actions>
</StafferCard>
```

### 2. Staffer Profile Page (`/staffers/:id`)

**Sections:**

**A. Header**
- Photo, Name, Current Position
- Contact info (email, LinkedIn)
- Quick stats: Total years in politics, # positions, # connections
- Action buttons: Edit (admin), Export, Real-time Sync

**B. Career Timeline (Visual)**
Use a library like `react-chrono` or custom D3 timeline:
```jsx
<Timeline orientation="vertical">
  {career_positions.map(pos => (
    <TimelineItem 
      year={pos.start_year} 
      endYear={pos.end_year}
      title={pos.position}
      org={pos.organization}
      boss={pos.boss_name}
      isCurrent={pos.is_current}
      orgType={pos.org_type}
      concurrent={pos.concurrent}
    />
  ))}
</Timeline>
```
- Color-code by org_type (Congressional=blue, Campaign=red, Think Tank=green, etc.)
- Show concurrent positions side-by-side
- Calculate and display gap years
- Highlight current position

**C. Network Connections**
Grid or list of connections:
```jsx
<ConnectionsList>
  {connections.map(conn => (
    <Connection>
      <Name>{conn.connected_to_name}</Name>
      <Context>{conn.organization} • {conn.years_together}y together</Context>
      <Strength badge={conn.strength} />
      {conn.connected_to_id && <Button>View Profile</Button>}
    </Connection>
  ))}
</ConnectionsList>
```

**D. Career Analysis**
- Pathway classification explanation
- Specialties & expertise areas
- Organizations worked for (tag cloud)
- Common colleague connections

### 3. Network Visualization Page (`/staffers/:id/network`)

**Use vis.js or D3.js for interactive graph:**

```jsx
<NetworkGraph
  nodes={[
    { id: staffer_id, label: name, group: 'person', level: 0 },
    ...connections.map(c => ({ id: c.id, label: c.name, group: 'person' })),
    ...organizations.map(o => ({ id: o.id, label: o.name, group: 'org' }))
  ]}
  edges={[
    { from: staffer_id, to: conn_id, label: 'worked with', years: 3 },
    { from: staffer_id, to: org_id, label: 'worked at' }
  ]}
  options={{
    physics: { enabled: true },
    nodes: {
      shape: 'dot',
      size: (node) => node.group === 'person' ? 20 : 30
    },
    groups: {
      person: { color: { background: '#3B82F6' } },
      org: { color: { background: '#10B981' } }
    }
  }}
/>
```

**Controls:**
- Filter by time period (slider)
- Filter by organization type
- Highlight shortest path between two people
- Export as PNG or SVG

### 4. Pathways Analysis Page (`/analytics/pathways`)

**Show common career patterns:**
```jsx
<PathwaysList>
  <Pathway>
    <Flow>Senate Staff → House Member Staff → House Leadership</Flow>
    <Count>43 staffers followed this path</Count>
    <Examples>Hayden Haynes, [others]</Examples>
    <AvgYears>8.5 years total</AvgYears>
  </Pathway>
  
  <Pathway>
    <Flow>Think Tank → Congressional Staff → Administration</Flow>
    <Count>38 staffers</Count>
  </Pathway>
  
  // More pathways...
</PathwaysList>
```

**Visualization:**
Sankey diagram showing flows between org types

---

## DATA COLLECTION & SCRAPING

### Initial Data Load
Create CSV import with these fields:
```
name,current_position,current_organization,current_member,chamber,party,state,specialty,pathway_type,years_in_current_role,education,contact_email,linkedin_url
```

**Seed data with Mike Johnson's staff:**
```csv
Hayden Haynes,Chief of Staff,Office of the Speaker,Mike Johnson,House,Republican,LA,Leadership Operations,Johnson Loyalist,9,"[""Louisiana Tech (BA)"", ""Gonzaga (MA)""]",,
Raj Shah,Deputy COS Communications,Office of the Speaker,Mike Johnson,House,Republican,LA,Media Strategy,Trump World,2,"[]",,
Garrett Fultz,Deputy Chief of Staff,Office of the Speaker,Mike Johnson,House,Republican,LA,Legislative Policy,Johnson Loyalist,7,"[""Ole Miss"", ""Tulane Law""]",,
[... rest of staff]
```

Also create corresponding career_positions CSV:
```csv
staffer_name,position,organization,boss_name,start_year,end_year,is_current,org_type,chamber
Hayden Haynes,Chief of Staff,Office of the Speaker,Mike Johnson,2023,,TRUE,Congressional Office,House
Hayden Haynes,Chief of Staff,Rep. Mike Johnson Office,Mike Johnson,2017,2023,FALSE,Congressional Office,House
Hayden Haynes,Campaign Manager,Mike Johnson for Congress,Mike Johnson,2016,2016,FALSE,Campaign,House
Hayden Haynes,Regional Representative,Sen. David Vitter Office,David Vitter,2013,2016,FALSE,Congressional Office,Senate
[... more positions]
```

### Periodic Batch Updates (Background Job)
Create scheduled task (cron or Celery):
```python
# /backend/tasks/sync_staffers.py

def batch_update_staffers():
    """
    Runs daily at 3am
    Scrapes public sources for staff changes
    """
    staffers = Staffer.query.filter(
        Staffer.track_updates == True
    ).all()
    
    for staffer in staffers:
        try:
            # Check congressional websites for changes
            updates = scrape_staffer_updates(staffer)
            
            if updates:
                log_update(staffer, updates)
                notify_subscribers(staffer, updates)
        except Exception as e:
            log_error(staffer, e)
```

**Sources to scrape (all public):**
- house.gov staff pages (Member offices list staff)
- LegiStorm free tier (if available)
- LinkedIn public profiles (carefully, respect rate limits)
- Congressional staff directories (PDF parsing)

### Real-time Sync (On-demand)
```python
# /backend/services/staffer_sync.py

def sync_staffer_realtime(staffer_id):
    """
    User-triggered immediate sync
    Rate limited: 1 per staffer per hour
    """
    # Check rate limit
    if recently_synced(staffer_id):
        raise RateLimitError("Please wait before syncing again")
    
    # Scrape current sources
    linkedin_data = scrape_linkedin(staffer.linkedin_url)
    congress_data = scrape_congress_profile(staffer.current_member)
    
    # Compare and update
    changes = compare_and_update(staffer, linkedin_data, congress_data)
    
    return changes
```

---

## EXPORT FUNCTIONALITY

### CSV Export
```python
def export_csv(staffer_id):
    """
    Nodes CSV: name, position, org, type
    Edges CSV: from_name, to_name, relationship, years
    """
    nodes_csv = generate_nodes_csv(staffer_id)
    edges_csv = generate_edges_csv(staffer_id)
    
    return {
        'nodes': nodes_csv,
        'edges': edges_csv
    }
```

### GraphML Export (for Gephi)
```python
def export_graphml(staffer_id):
    """
    Full network in GraphML format
    Can be opened in Gephi, Cytoscape, NodeXL
    """
    graph = build_network_graph(staffer_id)
    return graph.to_graphml()
```

### JSON Export
```python
def export_json(staffer_id):
    """
    Complete profile + career + network in JSON
    """
    return {
        'staffer': get_staffer(staffer_id),
        'career': get_career_positions(staffer_id),
        'connections': get_connections(staffer_id),
        'network': get_network_data(staffer_id)
    }
```

---

## NAVIGATION & INTEGRATION

### Add to Main Nav:
```jsx
<Nav>
  <NavItem href="/creators">Creators</NavItem>
  <NavItem href="/staffers">Political Staffers</NavItem>  {/* NEW */}
  <NavItem href="/dashboard">Dashboard</NavItem>
</Nav>
```

### Staffers Submenu:
```jsx
<Dropdown>
  <DropdownItem href="/staffers">Search Staffers</DropdownItem>
  <DropdownItem href="/staffers/analytics/pathways">Career Pathways</DropdownItem>
  <DropdownItem href="/staffers/organizations">Organizations</DropdownItem>
</Dropdown>
```

### Dashboard Widget:
```jsx
<DashboardWidget title="Recently Added Staffers">
  {recentStaffers.map(s => (
    <StafferMiniCard staffer={s} />
  ))}
</DashboardWidget>
```

---

## TECH STACK & LIBRARIES

**Backend:**
- Flask (Python) or Express (Node) - use existing
- PostgreSQL database
- APScheduler or node-cron for scheduled jobs
- BeautifulSoup4 or Cheerio for scraping
- pandas for CSV processing

**Frontend:**
- React (existing)
- Recharts for simple charts
- vis-network OR react-graph-vis for network visualization
- react-chrono OR custom component for timeline
- ag-Grid or react-table for data tables

**Install commands:**
```bash
# Python
pip install beautifulsoup4 requests pandas apscheduler psycopg2-binary sqlalchemy flask-cors

# Node
npm install express pg axios cheerio node-cron papaparse cors

# Frontend
npm install vis-network recharts react-chrono date-fns
```

---

## INITIAL SETUP STEPS

1. **Create database tables** (run SQL above)
2. **Create API endpoints** (all REST routes above)
3. **Build frontend pages** (4 main pages)
4. **Import seed data** (Johnson staff CSV)
5. **Add navigation links**
6. **Setup background job** (daily sync at 3am)
7. **Test export functionality**

---

## SAMPLE API RESPONSES

**GET /api/staffers/search?q=hayden**
```json
{
  "staffers": [
    {
      "id": 1,
      "name": "Hayden Haynes",
      "current_position": "Chief of Staff",
      "current_organization": "Office of the Speaker",
      "current_member": "Mike Johnson",
      "chamber": "House",
      "party": "Republican",
      "state": "LA",
      "pathway_type": "Johnson Loyalist",
      "years_in_current_role": 9,
      "career_positions_count": 7,
      "connections_count": 5
    }
  ],
  "total": 1,
  "page": 1,
  "per_page": 50
}
```

**GET /api/staffers/1/timeline**
```json
{
  "staffer": { "id": 1, "name": "Hayden Haynes" },
  "timeline": [
    {
      "id": 7,
      "position": "Chief of Staff",
      "organization": "Office of the Speaker",
      "boss_name": "Mike Johnson",
      "start_year": 2023,
      "end_year": null,
      "is_current": true,
      "org_type": "Congressional Office",
      "chamber": "House",
      "duration_years": 2
    },
    {
      "id": 6,
      "position": "Chief of Staff",
      "organization": "Rep. Mike Johnson Office",
      "boss_name": "Mike Johnson",
      "start_year": 2017,
      "end_year": 2023,
      "is_current": false,
      "org_type": "Congressional Office",
      "chamber": "House",
      "duration_years": 6
    }
    // ... more positions
  ],
  "stats": {
    "total_years": 14,
    "total_positions": 7,
    "organizations": 5,
    "longest_position": { "position": "Chief of Staff", "years": 6 }
  }
}
```

**GET /api/staffers/1/network**
```json
{
  "nodes": [
    { "id": "s1", "label": "Hayden Haynes", "group": "person", "level": 0 },
    { "id": "s2", "label": "Mike Johnson", "group": "person", "level": 1 },
    { "id": "s3", "label": "David Vitter", "group": "person", "level": 1 },
    { "id": "o1", "label": "Office of the Speaker", "group": "org", "level": 1 },
    { "id": "o2", "label": "Sen. Vitter Office", "group": "org", "level": 2 }
  ],
  "edges": [
    { "from": "s1", "to": "s2", "label": "reported to", "years": 9 },
    { "from": "s1", "to": "s3", "label": "reported to", "years": 3 },
    { "from": "s1", "to": "o1", "label": "works at" },
    { "from": "s1", "to": "o2", "label": "worked at" }
  ]
}
```

---

## PRIORITY ORDER

Build in this sequence:
1. ✅ Database schema & migrations
2. ✅ Basic CRUD API endpoints (search, get, create, update)
3. ✅ CSV import functionality + seed Johnson staff data
4. ✅ Staffer search page with filters
5. ✅ Staffer profile page with career timeline
6. ✅ Basic network connections list (not graph yet)
7. ✅ Export to CSV/JSON
8. ✅ Navigation integration
9. ⏳ Network visualization page (vis.js)
10. ⏳ Periodic batch update job
11. ⏳ Real-time sync endpoint
12. ⏳ Pathways analysis page

---

## STYLING NOTES

Match existing creator platform design:
- Use same color scheme and component library
- Reuse card components, buttons, badges
- Keep consistent typography
- Mobile-responsive (grid → list on small screens)

**Color coding:**
- Republicans: Red (#DC2626)
- Democrats: Blue (#2563EB)
- House: Navy (#1E3A8A)
- Senate: Purple (#7C3AED)
- Think Tanks: Green (#059669)
- Campaigns: Orange (#EA580C)
- White House: Gold (#D97706)

---

## SUCCESS CRITERIA

When complete, users should be able to:
1. Search "Mike Johnson" and see all 7 of his staffers
2. Click Hayden Haynes and see 7-position career timeline
3. See connections to David Vitter and Mike Johnson
4. Export Haynes network as CSV for Gephi
5. View career pathways showing "Senate → House Leadership" pattern
6. (Admin) Import 50 more staffers via CSV upload
7. Trigger real-time sync for any staffer (once per hour)

---

## FINAL NOTES

- Start with manual data (Johnson's 7 staffers + their career histories)
- Build frontend first so users see value immediately
- Add scraping/automation after MVP works
- Focus on House/Senate only (no White House/agencies for now)
- Periodic updates = daily batch at 3am
- Real-time sync = user-triggered, rate-limited to 1/hour per staffer
- All data sources are public and legal to scrape (respect robots.txt)

Build this complete feature with working frontend, backend, database, and initial data. Make it production-ready and fully functional.
