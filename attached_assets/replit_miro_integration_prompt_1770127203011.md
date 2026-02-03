# ADD: Miro Integration for One-Click Staffer Mapping

Integrate Miro API to allow users to instantly create visual career maps and network diagrams with one click. Users should be able to map individual staffers or entire office teams directly to collaborative Miro boards.

---

## USER EXPERIENCE GOALS

**Make it THIS simple:**
1. User sees Mike Johnson profile (or any member)
2. Clicks "Map Staffers" button
3. Instantly opens beautiful Miro board with all staff visualized
4. Can share, present, or collaborate in real-time

**OR:**
1. User views individual staffer profile (e.g., Hayden Haynes)
2. Clicks "Open in Miro" button  
3. Gets career timeline + network map in Miro
4. Can annotate and share

---

## MIRO SETUP & AUTHENTICATION

### 1. Create Miro App
Go to https://miro.com/app/settings/user-profile/apps
- Create new app: "Political Staffer Mapper"
- Get `CLIENT_ID` and `CLIENT_SECRET`
- Add redirect URL: `https://your-app.replit.app/auth/miro/callback`
- Enable permissions: `boards:read`, `boards:write`

### 2. Add OAuth Flow

**Environment variables:**
```
MIRO_CLIENT_ID=your_client_id
MIRO_CLIENT_SECRET=your_client_secret
MIRO_REDIRECT_URI=https://your-app.replit.app/auth/miro/callback
```

**Backend endpoints:**
```javascript
// Initiate Miro OAuth
GET /auth/miro
// Redirects to Miro authorization page

// OAuth callback
GET /auth/miro/callback?code=xxx
// Exchanges code for access_token
// Stores token in database for user
// Redirects back to app with success message

// Check if user has Miro connected
GET /api/user/miro-status
// Returns: { connected: true/false, team_id: "xxx" }

// Disconnect Miro
DELETE /api/user/miro-connection
// Removes stored token
```

**Database table:**
```sql
CREATE TABLE user_integrations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  integration_type VARCHAR(50) NOT NULL, -- 'miro'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  team_id VARCHAR(255),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## UI COMPONENTS TO ADD

### 1. "Connect Miro" Button (Settings Page)

Add to user settings or integrations page:

```jsx
<IntegrationsSection>
  <IntegrationCard>
    <MiroLogo />
    <h3>Miro</h3>
    <p>Create visual career maps and network diagrams</p>
    
    {!miroConnected ? (
      <Button onClick={connectMiro} variant="primary">
        <Icon name="link" /> Connect Miro
      </Button>
    ) : (
      <>
        <Badge color="green">Connected</Badge>
        <Button onClick={disconnectMiro} variant="ghost">
          Disconnect
        </Button>
      </>
    )}
  </IntegrationCard>
</IntegrationsSection>
```

### 2. "Map Staffers" Button (Member Profile)

Add this button next to "Find Staffers" on Mike Johnson's profile:

```jsx
// On Member Profile Page (Mike Johnson card)
<StaffSection>
  <SectionHeader>
    <Icon name="users" /> Staff Members
  </SectionHeader>
  
  <ButtonGroup>
    <Button onClick={findStaffers}>
      <Icon name="search" /> Find Staffers
    </Button>
    
    {/* NEW BUTTON */}
    <Button 
      onClick={() => mapStaffersToMiro(memberId)}
      variant="secondary"
      disabled={!miroConnected}
    >
      <MiroIcon /> Map Staffers
    </Button>
  </ButtonGroup>
  
  {!miroConnected && (
    <Hint>
      <Icon name="info" /> 
      Connect Miro in settings to create visual maps
    </Hint>
  )}
</StaffSection>
```

### 3. "Open in Miro" Button (Individual Staffer Profile)

On staffer profile pages (e.g., Hayden Haynes):

```jsx
<StafferHeader>
  <StafferInfo>
    <Avatar src={staffer.photo_url} />
    <Name>{staffer.name}</Name>
    <Position>{staffer.current_position}</Position>
  </StafferInfo>
  
  <ActionButtons>
    <Button onClick={editStaffer}>Edit</Button>
    
    <DropdownMenu>
      <DropdownTrigger>
        <Button variant="outline">
          Export <Icon name="chevron-down" />
        </Button>
      </DropdownTrigger>
      
      <DropdownContent>
        <DropdownItem onClick={() => exportCSV(staffer.id)}>
          <Icon name="file-csv" /> Export CSV
        </DropdownItem>
        <DropdownItem onClick={() => exportJSON(staffer.id)}>
          <Icon name="file-json" /> Export JSON
        </DropdownItem>
        
        {/* NEW OPTION */}
        <DropdownItem 
          onClick={() => openInMiro(staffer.id)}
          disabled={!miroConnected}
        >
          <MiroIcon /> Open in Miro
        </DropdownItem>
      </DropdownContent>
    </DropdownMenu>
  </ActionButtons>
</StafferHeader>
```

### 4. Bulk Selection + Map (Search Results)

On the staffers search page, allow selecting multiple staffers:

```jsx
<SearchResults>
  <ResultsHeader>
    <ResultCount>{staffers.length} staffers found</ResultCount>
    
    {selectedStaffers.length > 0 && (
      <BulkActions>
        <span>{selectedStaffers.length} selected</span>
        <Button onClick={() => mapSelectedToMiro(selectedStaffers)}>
          <MiroIcon /> Map Selected to Miro
        </Button>
      </BulkActions>
    )}
  </ResultsHeader>
  
  <ResultsList>
    {staffers.map(staffer => (
      <StafferCard 
        key={staffer.id}
        selectable={true}
        selected={selectedStaffers.includes(staffer.id)}
        onSelect={() => toggleSelection(staffer.id)}
      >
        {/* staffer card content */}
      </StafferCard>
    ))}
  </ResultsList>
</SearchResults>
```

---

## BACKEND API ENDPOINTS

### Create Miro Board Endpoints

```javascript
// Map entire office staff to Miro
POST /api/miro/map-office
Body: {
  member_name: "Mike Johnson",
  board_name: "Mike Johnson Staff Network" // optional
}
Returns: {
  board_url: "https://miro.com/app/board/xxx",
  board_id: "xxx",
  items_created: 15
}

// Map individual staffer
POST /api/miro/map-staffer
Body: {
  staffer_id: 1,
  board_name: "Hayden Haynes - Career Map" // optional
}
Returns: {
  board_url: "https://miro.com/app/board/xxx",
  board_id: "xxx"
}

// Map multiple selected staffers
POST /api/miro/map-multiple
Body: {
  staffer_ids: [1, 2, 3, 4],
  board_name: "Louisiana Republican Network"
}
Returns: {
  board_url: "https://miro.com/app/board/xxx",
  board_id: "xxx",
  items_created: 25
}

// Update existing Miro board (when staffer data changes)
PUT /api/miro/boards/:board_id/sync
Body: {
  staffer_id: 1
}
Returns: {
  updated: true,
  changes: ["position updated", "new connection added"]
}
```

---

## MIRO BOARD CREATION LOGIC

### For Office Staff Mapping (e.g., "Map Mike Johnson Staff")

**Layout:** Hierarchical org chart

```javascript
async function mapOfficeToMiro(memberName, userId) {
  // 1. Get user's Miro access token
  const miroToken = await getMiroToken(userId);
  
  // 2. Fetch all staffers for this member
  const staffers = await getStaffersByMember(memberName);
  
  // 3. Create new Miro board
  const board = await createMiroBoard({
    name: `${memberName} Staff Network - ${new Date().toISOString().split('T')[0]}`,
    token: miroToken
  });
  
  // 4. Add member at top center
  const memberCard = await addMiroCard(board.id, {
    content: `<strong>${memberName}</strong><br>Speaker of the House`,
    position: { x: 0, y: -400 },
    style: {
      fillColor: '#1e40af', // Blue for member
      textAlign: 'center'
    },
    width: 300,
    height: 150
  }, miroToken);
  
  // 5. Calculate positions for staffers (spread horizontally)
  const stafferWidth = 250;
  const stafferSpacing = 50;
  const totalWidth = staffers.length * (stafferWidth + stafferSpacing);
  const startX = -(totalWidth / 2);
  
  // 6. Add each staffer
  for (let i = 0; i < staffers.length; i++) {
    const staffer = staffers[i];
    const x = startX + (i * (stafferWidth + stafferSpacing));
    
    // Create staffer card
    const stafferCard = await addMiroCard(board.id, {
      content: `
        <strong>${staffer.name}</strong><br>
        ${staffer.current_position}<br>
        <small>${staffer.years_in_current_role}y in role</small>
      `,
      position: { x: x, y: 0 },
      style: {
        fillColor: getColorByPathway(staffer.pathway_type),
        textAlign: 'center'
      },
      width: stafferWidth,
      height: 180
    }, miroToken);
    
    // Connect to member
    await addMiroConnector(board.id, {
      startItem: { id: memberCard.id },
      endItem: { id: stafferCard.id },
      style: {
        strokeColor: '#6b7280',
        strokeWidth: 2
      }
    }, miroToken);
    
    // Add career timeline as sticky notes below each staffer
    const careerPositions = await getCareerPositions(staffer.id);
    
    for (let j = 0; j < Math.min(careerPositions.length, 3); j++) {
      const pos = careerPositions[j];
      await addMiroStickyNote(board.id, {
        content: `${pos.position}\n${pos.organization}\n${pos.start_year}-${pos.end_year || 'Present'}`,
        position: { x: x, y: 250 + (j * 120) },
        style: { fillColor: '#fef3c7' } // Yellow sticky
      }, miroToken);
    }
  }
  
  // 7. Add legend frame
  await addMiroFrame(board.id, {
    title: 'Legend',
    position: { x: totalWidth/2 + 200, y: -200 },
    width: 300,
    height: 400
  }, miroToken);
  
  // Add legend items
  const legendItems = [
    { color: '#dc2626', label: 'Johnson Loyalist' },
    { color: '#ea580c', label: 'Trump World' },
    { color: '#059669', label: 'Movement Conservative' },
    { color: '#7c3aed', label: 'Leadership Transfer' }
  ];
  
  for (let i = 0; i < legendItems.length; i++) {
    await addMiroShape(board.id, {
      type: 'rectangle',
      content: legendItems[i].label,
      position: { x: totalWidth/2 + 250, y: -100 + (i * 80) },
      style: { fillColor: legendItems[i].color },
      width: 200,
      height: 60
    }, miroToken);
  }
  
  // 8. Store board reference in database
  await saveMiroBoard({
    user_id: userId,
    board_id: board.id,
    board_url: board.viewLink,
    board_type: 'office_staff',
    related_entity_id: memberName,
    created_at: new Date()
  });
  
  return {
    board_url: board.viewLink,
    board_id: board.id,
    items_created: staffers.length * 4 // cards + connectors + stickies
  };
}
```

### For Individual Staffer Mapping (e.g., "Hayden Haynes Career Map")

**Layout:** Career timeline (vertical) + network connections (radial)

```javascript
async function mapStafferToMiro(stafferId, userId) {
  const miroToken = await getMiroToken(userId);
  const staffer = await getStaffer(stafferId);
  const career = await getCareerPositions(stafferId);
  const connections = await getConnections(stafferId);
  
  // Create board
  const board = await createMiroBoard({
    name: `${staffer.name} - Career & Network Map`,
    token: miroToken
  });
  
  // CENTER: Add staffer card
  const centerCard = await addMiroCard(board.id, {
    content: `
      <h2>${staffer.name}</h2>
      <strong>${staffer.current_position}</strong><br>
      ${staffer.current_organization}<br>
      <small>${staffer.years_in_current_role} years in current role</small>
    `,
    position: { x: 0, y: 0 },
    style: {
      fillColor: '#1e40af',
      textAlign: 'center'
    },
    width: 350,
    height: 200
  }, miroToken);
  
  // LEFT SIDE: Career timeline (vertical)
  await addMiroText(board.id, {
    content: '<strong>Career Timeline</strong>',
    position: { x: -600, y: -400 },
    style: { fontSize: 24 }
  }, miroToken);
  
  const timelineX = -600;
  const startY = -300;
  const yearHeight = 80;
  
  for (let i = 0; i < career.length; i++) {
    const pos = career[i];
    const y = startY + (i * yearHeight);
    
    // Position card
    const posCard = await addMiroCard(board.id, {
      content: `
        <strong>${pos.position}</strong><br>
        ${pos.organization}<br>
        <small>${pos.start_year}-${pos.end_year || 'Present'}</small>
      `,
      position: { x: timelineX, y: y },
      style: {
        fillColor: pos.is_current ? '#22c55e' : '#e5e7eb',
        textAlign: 'left'
      },
      width: 280,
      height: 100
    }, miroToken);
    
    // Draw connector line between positions
    if (i > 0) {
      await addMiroConnector(board.id, {
        startItem: { position: { x: timelineX, y: y - yearHeight + 50 } },
        endItem: { position: { x: timelineX, y: y - 50 } },
        style: { strokeColor: '#9ca3af', strokeWidth: 3 }
      }, miroToken);
    }
  }
  
  // RIGHT SIDE: Network connections (radial layout)
  await addMiroText(board.id, {
    content: '<strong>Network Connections</strong>',
    position: { x: 600, y: -400 },
    style: { fontSize: 24 }
  }, miroToken);
  
  const radius = 400;
  const angleStep = (2 * Math.PI) / connections.length;
  
  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i];
    const angle = i * angleStep;
    const x = 600 + (radius * Math.cos(angle));
    const y = 0 + (radius * Math.sin(angle));
    
    // Connection card
    const connCard = await addMiroCard(board.id, {
      content: `
        <strong>${conn.connected_to_name}</strong><br>
        ${conn.organization}<br>
        <small>${conn.years_together}y together</small>
      `,
      position: { x: x, y: y },
      style: {
        fillColor: conn.connection_type === 'Boss' ? '#f59e0b' : '#8b5cf6',
        textAlign: 'center'
      },
      width: 200,
      height: 120
    }, miroToken);
    
    // Connect to center staffer
    await addMiroConnector(board.id, {
      startItem: { id: centerCard.id },
      endItem: { id: connCard.id },
      caption: conn.connection_type,
      style: {
        strokeColor: '#6b7280',
        strokeWidth: conn.strength === 'Strong' ? 4 : 2
      }
    }, miroToken);
  }
  
  // Add frame around timeline
  await addMiroFrame(board.id, {
    title: 'Career History',
    position: { x: timelineX, y: startY - 100 },
    width: 400,
    height: career.length * yearHeight + 150
  }, miroToken);
  
  // Add frame around network
  await addMiroFrame(board.id, {
    title: 'Professional Network',
    position: { x: 600, y: 0 },
    width: radius * 2.5,
    height: radius * 2.5
  }, miroToken);
  
  // Save board
  await saveMiroBoard({
    user_id: userId,
    board_id: board.id,
    board_url: board.viewLink,
    board_type: 'staffer_career',
    related_entity_id: stafferId,
    created_at: new Date()
  });
  
  return {
    board_url: board.viewLink,
    board_id: board.id
  };
}
```

---

## MIRO API HELPER FUNCTIONS

```javascript
// Create Miro board
async function createMiroBoard(options, token) {
  const response = await fetch('https://api.miro.com/v2/boards', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: options.name,
      policy: {
        permissionsPolicy: { collaborationType: 'all_editors' },
        sharingPolicy: { access: 'edit', teamAccess: 'edit' }
      }
    })
  });
  
  return await response.json();
}

// Add card/shape to board
async function addMiroCard(boardId, options, token) {
  const response = await fetch(`https://api.miro.com/v2/boards/${boardId}/cards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        title: options.content,
        description: options.description || ''
      },
      style: {
        cardTheme: options.style?.fillColor || '#1e40af'
      },
      position: options.position,
      geometry: {
        width: options.width || 300,
        height: options.height || 150
      }
    })
  });
  
  return await response.json();
}

// Add sticky note
async function addMiroStickyNote(boardId, options, token) {
  const response = await fetch(`https://api.miro.com/v2/boards/${boardId}/sticky_notes`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: { content: options.content },
      style: { fillColor: options.style?.fillColor || 'yellow' },
      position: options.position
    })
  });
  
  return await response.json();
}

// Add connector/line
async function addMiroConnector(boardId, options, token) {
  const response = await fetch(`https://api.miro.com/v2/boards/${boardId}/connectors`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      startItem: options.startItem,
      endItem: options.endItem,
      caption: options.caption || '',
      style: {
        strokeColor: options.style?.strokeColor || '#000000',
        strokeWidth: options.style?.strokeWidth || 2
      }
    })
  });
  
  return await response.json();
}

// Add frame (grouping container)
async function addMiroFrame(boardId, options, token) {
  const response = await fetch(`https://api.miro.com/v2/boards/${boardId}/frames`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: { title: options.title },
      position: options.position,
      geometry: {
        width: options.width,
        height: options.height
      }
    })
  });
  
  return await response.json();
}

// Color coding helper
function getColorByPathway(pathwayType) {
  const colors = {
    'Johnson Loyalist': '#dc2626',
    'Trump World': '#ea580c',
    'Movement Conservative': '#059669',
    'Leadership Transfer': '#7c3aed',
    'Senate Transfer': '#3b82f6'
  };
  
  return colors[pathwayType] || '#6b7280';
}
```

---

## USER FLOWS

### Flow 1: First-time Miro Connection
1. User clicks "Map Staffers" on Mike Johnson profile
2. Sees modal: "Connect Miro to create visual maps"
3. Clicks "Connect Miro" → OAuth flow
4. Authorizes app on Miro
5. Returns to app, now "Map Staffers" is enabled
6. Clicks "Map Staffers" again
7. Loading state: "Creating Miro board..."
8. Opens new tab with Miro board showing all 7 staffers
9. User can edit, share, present

### Flow 2: Map Individual Staffer
1. User searches "hayden haynes"
2. Opens Hayden's profile
3. Clicks Export dropdown → "Open in Miro"
4. New Miro board opens with career timeline + network
5. User adds sticky notes with research findings
6. Shares board with colleague

### Flow 3: Bulk Mapping
1. User searches "staffers who worked for Vitter"
2. Gets 15 results
3. Selects 8 of them (checkboxes)
4. Clicks "Map Selected to Miro"
5. Miro board created showing all 8 staffers + their connections
6. Reveals network patterns

---

## LOADING STATES & FEEDBACK

When creating Miro boards (can take 5-15 seconds):

```jsx
<Modal open={creatingMiro} onClose={null}>
  <ModalContent>
    <Spinner size="large" />
    <h3>Creating Miro board...</h3>
    <ProgressBar value={progress} max={100} />
    <ProgressText>
      {progress < 30 && "Setting up board..."}
      {progress >= 30 && progress < 60 && "Adding staffers..."}
      {progress >= 60 && progress < 90 && "Connecting relationships..."}
      {progress >= 90 && "Finishing up..."}
    </ProgressText>
  </ModalContent>
</Modal>

{/* Success */}
<Toast type="success">
  Miro board created! 
  <Button onClick={openMiroBoard}>Open Board</Button>
</Toast>
```

---

## ERROR HANDLING

```javascript
try {
  const board = await mapOfficeToMiro(memberName, userId);
  return board;
} catch (error) {
  if (error.code === 'MIRO_TOKEN_EXPIRED') {
    // Refresh token
    const newToken = await refreshMiroToken(userId);
    return mapOfficeToMiro(memberName, userId); // Retry
  }
  
  if (error.code === 'MIRO_NOT_CONNECTED') {
    throw new Error('Please connect Miro first');
  }
  
  if (error.code === 'RATE_LIMIT') {
    throw new Error('Miro API rate limit reached. Try again in a few minutes.');
  }
  
  // Generic error
  throw new Error('Failed to create Miro board. Please try again.');
}
```

---

## SAVED BOARDS TRACKING

Store created boards so users can revisit them:

**Database table:**
```sql
CREATE TABLE miro_boards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  board_id VARCHAR(255) NOT NULL,
  board_url TEXT NOT NULL,
  board_name VARCHAR(255),
  board_type VARCHAR(50), -- 'office_staff', 'staffer_career', 'bulk_research'
  related_entity_type VARCHAR(50), -- 'member', 'staffer', 'multiple'
  related_entity_id VARCHAR(255), -- member name or staffer id
  last_synced TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**UI to show saved boards:**
```jsx
<SavedMiroBoards>
  <h3>Your Miro Boards</h3>
  {miroBoards.map(board => (
    <BoardCard key={board.id}>
      <BoardName>{board.board_name}</BoardName>
      <BoardType>{board.board_type}</BoardType>
      <BoardDate>{formatDate(board.created_at)}</BoardDate>
      <Button href={board.board_url} target="_blank">
        Open in Miro
      </Button>
      {board.board_type === 'office_staff' && (
        <Button onClick={() => syncBoard(board.board_id)}>
          <Icon name="refresh" /> Sync Updates
        </Button>
      )}
    </BoardCard>
  ))}
</SavedMiroBoards>
```

---

## ADVANCED: AUTO-SYNC BOARDS

For office staff boards, auto-update when data changes:

```javascript
// Webhook: When staffer data changes
async function onStafferUpdate(stafferId) {
  // Find all Miro boards containing this staffer
  const boards = await MiroBoard.findAll({
    where: {
      board_type: 'office_staff',
      // Query related staffers
    }
  });
  
  // Update each board
  for (const board of boards) {
    await updateMiroBoard(board.board_id, stafferId);
  }
}

async function updateMiroBoard(boardId, stafferId) {
  const token = await getMiroTokenForBoard(boardId);
  const staffer = await getStaffer(stafferId);
  
  // Find staffer's card on the board
  const items = await fetchBoardItems(boardId, token);
  const stafferCard = items.find(item => 
    item.data.title.includes(staffer.name)
  );
  
  if (stafferCard) {
    // Update card content
    await updateMiroCard(boardId, stafferCard.id, {
      title: `${staffer.name}\n${staffer.current_position}\n${staffer.years_in_current_role}y in role`
    }, token);
  }
}
```

---

## PACKAGE INSTALLATION

```bash
npm install @mirohq/miro-api axios
```

---

## IMPLEMENTATION PRIORITY

**Phase 1: Basic Integration (2-3 hours)**
1. ✅ OAuth flow (connect/disconnect Miro)
2. ✅ "Map Staffers" button on member profile
3. ✅ Create simple org chart board for office staff
4. ✅ Open board in new tab

**Phase 2: Enhanced Visuals (3-4 hours)**
1. ✅ Add career timeline to individual staffer mapping
2. ✅ Add network connections in radial layout
3. ✅ Color coding by pathway type
4. ✅ Frames and legend

**Phase 3: Advanced Features (4-5 hours)**
1. ⏳ Bulk selection mapping
2. ⏳ Saved boards list
3. ⏳ Auto-sync when data changes
4. ⏳ Loading states and error handling

---

## SUCCESS CRITERIA

User should be able to:
1. Click "Map Staffers" on Mike Johnson profile → Instant Miro org chart
2. Click "Open in Miro" on Hayden Haynes profile → Career timeline + network
3. Select 5 staffers from search → Create research board
4. See all their Miro boards in one place
5. Update staffer data → Board auto-syncs (optional)

---

## EXAMPLE SCREENSHOT FLOW

**Before:**
[Mike Johnson Profile] → "Find Staffers" button

**After:**
[Mike Johnson Profile] → "Find Staffers" button + "Map Staffers" button (Miro icon)

**Result:**
[Opens Miro board with org chart showing Mike Johnson at top, 7 staffers below, career history, connections, legend]

---

Build this complete Miro integration with proper OAuth, board creation, and all UI components. Make it production-ready with loading states, error handling, and responsive design.
