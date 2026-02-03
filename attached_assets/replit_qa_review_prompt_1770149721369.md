# COMPREHENSIVE QA REVIEW & TESTING

Perform a complete quality assurance review of the entire application. Test every button, link, page, form, and feature to identify and fix all errors, broken links, console errors, and usability issues.

---

## TESTING METHODOLOGY

### 1. Automated Error Detection
Run these checks first:

**Console Errors:**
```javascript
// Check browser console for any errors
// Look for:
// - JavaScript errors
// - Failed API calls (404, 500, etc.)
// - Missing resources (images, fonts, CSS)
// - CORS errors
// - Authentication errors
```

**Linting:**
```bash
# Run linters to catch code issues
npm run lint

# Check for unused imports
# Check for undefined variables
# Check for syntax errors
```

**Broken Links:**
```bash
# Install broken-link-checker
npm install -g broken-link-checker

# Run link checker
blc http://localhost:3000 -ro
```

---

## 2. PAGE-BY-PAGE TESTING CHECKLIST

### Homepage / Landing Page
**URL:** `/` or `/home`

**Visual Checks:**
- [ ] Page loads without errors
- [ ] All images load correctly (no broken image icons)
- [ ] Logo displays properly
- [ ] Hero section displays correctly
- [ ] All text is readable (no overlapping, no cutoff text)
- [ ] Responsive design works (test mobile, tablet, desktop)

**Interactive Elements:**
- [ ] All navigation links work
- [ ] CTA buttons navigate to correct pages
- [ ] Footer links work
- [ ] Social media links open in new tabs
- [ ] Mobile menu hamburger opens/closes
- [ ] Dropdown menus work (if any)

**Console Check:**
- [ ] No JavaScript errors in console
- [ ] No 404 errors for assets
- [ ] No CORS errors

---

### Navigation Bar (Global)
Test on EVERY page:

- [ ] Logo click returns to homepage
- [ ] All nav menu items work
- [ ] Active page is highlighted correctly
- [ ] Dropdown menus work properly
- [ ] Mobile hamburger menu functions
- [ ] User profile dropdown works (if logged in)
- [ ] Logout button works
- [ ] "Connect Miro" status displays correctly
- [ ] Navigation persists across all pages

---

### Authentication Pages

#### Sign Up Page
**URL:** `/signup` or `/register`

**Form Testing:**
- [ ] All input fields accept text
- [ ] Email validation works (rejects invalid emails)
- [ ] Password strength indicator works
- [ ] "Show/Hide Password" toggle works
- [ ] Required field validation works
- [ ] Form submits successfully with valid data
- [ ] Error messages display for invalid data
- [ ] Success redirect works (to dashboard or login)
- [ ] "Already have account? Login" link works

**Error Scenarios:**
- [ ] Duplicate email shows appropriate error
- [ ] Weak password rejected
- [ ] Empty fields show validation errors
- [ ] Network error handled gracefully

#### Login Page
**URL:** `/login`

**Form Testing:**
- [ ] Email/username field works
- [ ] Password field works
- [ ] "Remember me" checkbox works
- [ ] "Forgot password?" link works
- [ ] Form submits with valid credentials
- [ ] Error message for invalid credentials
- [ ] Success redirect to dashboard
- [ ] "Don't have account? Sign up" link works

**Error Scenarios:**
- [ ] Wrong password shows error
- [ ] Non-existent email shows error
- [ ] Empty fields validated
- [ ] Rate limiting works (if implemented)

#### Password Reset
**URL:** `/forgot-password`

- [ ] Email input works
- [ ] Submit button sends reset email
- [ ] Success message displays
- [ ] Reset email link works
- [ ] New password form works
- [ ] Password successfully updates
- [ ] Redirect to login works

---

### Dashboard
**URL:** `/dashboard`

**Loading:**
- [ ] Page loads without errors
- [ ] User data displays correctly
- [ ] Statistics/metrics load
- [ ] Charts/graphs render (if any)
- [ ] Recent activity displays

**Widgets:**
- [ ] "Recently Added Staffers" widget displays
- [ ] "Political Connections" widget works
- [ ] Quick action buttons work
- [ ] "View All" links work

**Interactive Elements:**
- [ ] All dashboard cards are clickable
- [ ] Sidebar navigation works
- [ ] Notification icon works
- [ ] Settings gear icon works

---

### Staffers Module

#### Staffers Search Page
**URL:** `/staffers` or `/staffers/search`

**Search Functionality:**
- [ ] Search bar accepts input
- [ ] Search returns results
- [ ] Empty search handled
- [ ] No results message displays
- [ ] Results pagination works

**Filters:**
- [ ] Name filter works
- [ ] Member dropdown populated and works
- [ ] Chamber filter (House/Senate/Both)
- [ ] Party filter (R/D/I)
- [ ] State dropdown works
- [ ] Specialty filter works
- [ ] Multiple filters work together
- [ ] "Clear Filters" button works

**Results Display:**
- [ ] Staffer cards display correctly
- [ ] Photos load (or placeholder shows)
- [ ] All text readable
- [ ] Tags/badges display
- [ ] Stats show correctly
- [ ] "View Profile" button works
- [ ] "Network" button works
- [ ] Grid/List view toggle works (if exists)

**Bulk Actions:**
- [ ] Checkbox selection works
- [ ] "Select All" works
- [ ] Selected count displays
- [ ] "Map Selected to Miro" button appears
- [ ] Bulk actions execute correctly

**Pagination:**
- [ ] Page numbers display
- [ ] Next/Previous buttons work
- [ ] Jump to page works
- [ ] Results per page selector works

---

#### Individual Staffer Profile
**URL:** `/staffers/:id`

**Profile Header:**
- [ ] Photo displays (or placeholder)
- [ ] Name displays
- [ ] Current position displays
- [ ] Organization displays
- [ ] Contact info displays (if available)
- [ ] LinkedIn link works (opens new tab)
- [ ] Edit button works (admin only)
- [ ] Export dropdown works

**Career Timeline:**
- [ ] Timeline displays vertically
- [ ] All positions show
- [ ] Dates display correctly
- [ ] Current position highlighted
- [ ] Concurrent positions show side-by-side
- [ ] Gaps calculated and shown
- [ ] Hover tooltips work (if any)
- [ ] Color coding works

**Network Connections:**
- [ ] All connections listed
- [ ] Connection names display
- [ ] Organizations show
- [ ] Years together calculated
- [ ] Strength badges display
- [ ] "View Profile" links work (if connected)

**Career Analysis:**
- [ ] Pathway classification shows
- [ ] Specialties display
- [ ] Organizations tag cloud works
- [ ] Statistics calculate correctly

**Actions:**
- [ ] "Open in Miro" button works
- [ ] "Export CSV" works (downloads file)
- [ ] "Export JSON" works
- [ ] "Real-time Sync" button works
- [ ] Loading states show during sync

---

#### Network Visualization Page
**URL:** `/staffers/:id/network`

**Graph Rendering:**
- [ ] Network graph loads
- [ ] Nodes display correctly
- [ ] Edges/connections render
- [ ] Colors coded properly
- [ ] Node labels readable

**Interactivity:**
- [ ] Nodes draggable
- [ ] Click node to view details
- [ ] Zoom in/out works
- [ ] Pan around graph works
- [ ] Hover shows tooltips

**Controls:**
- [ ] Time period slider works
- [ ] Organization filter works
- [ ] "Highlight path" feature works
- [ ] Export as PNG/SVG works
- [ ] Reset view button works

---

#### Pathways Analysis Page
**URL:** `/analytics/pathways` or `/staffers/pathways`

**Display:**
- [ ] Common pathways list
- [ ] Flow diagrams render
- [ ] Counts display correctly
- [ ] Example names show
- [ ] Average years calculated

**Interactivity:**
- [ ] Click pathway to see staffers
- [ ] Filter by org type works
- [ ] Sankey diagram renders (if exists)
- [ ] Export data works

---

### Member Profiles

#### Member Profile Page
**URL:** `/members/:name` (e.g., `/members/mike-johnson`)

**Profile Display:**
- [ ] Member photo loads
- [ ] Name displays
- [ ] Party/State/Chamber show
- [ ] Leadership roles display
- [ ] Contact information shows
- [ ] Office address displays
- [ ] Phone number formatted
- [ ] Website link works (new tab)

**Staff Section:**
- [ ] "Find Staffers" button works
- [ ] "Map Staffers" button works
- [ ] Button disabled if Miro not connected
- [ ] Hint message shows when disabled
- [ ] Staff count displays

**Legislation Section:**
- [ ] Sponsored bills listed
- [ ] Bill numbers display
- [ ] Bill titles show
- [ ] Dates formatted
- [ ] Status shows
- [ ] Links to legislation work

---

### Miro Integration

#### Settings / Integrations Page
**URL:** `/settings/integrations` or `/settings`

**Miro Connection:**
- [ ] Miro integration card displays
- [ ] "Connect Miro" button works
- [ ] OAuth flow initiates
- [ ] Redirects to Miro correctly
- [ ] Returns from OAuth successfully
- [ ] Connection status updates
- [ ] "Connected" badge displays
- [ ] "Disconnect" button works
- [ ] Confirmation modal works

**Connection Status:**
- [ ] Status checked on page load
- [ ] Error handling if token expired
- [ ] Refresh token flow works

---

#### Miro Board Creation

**From Member Profile:**
- [ ] "Map Staffers" button creates board
- [ ] Loading modal displays
- [ ] Progress bar updates
- [ ] Board opens in new tab
- [ ] Success toast shows
- [ ] Board URL stored in database

**From Staffer Profile:**
- [ ] "Open in Miro" in export dropdown
- [ ] Board creation starts
- [ ] Loading indicators show
- [ ] New board opens
- [ ] Career timeline renders correctly
- [ ] Network connections display
- [ ] Colors coded properly
- [ ] Frames/legend added

**Bulk Mapping:**
- [ ] Select multiple staffers
- [ ] "Map Selected" button appears
- [ ] Confirmation modal shows count
- [ ] Board created with all staffers
- [ ] Network connections between them shown

**Saved Boards List:**
- [ ] All created boards listed
- [ ] Board names display
- [ ] Creation dates show
- [ ] Board types labeled
- [ ] "Open in Miro" links work
- [ ] "Sync Updates" button works
- [ ] Delete board option works (optional)

---

### Import/Export Features

#### CSV Import
**URL:** `/staffers/import` (admin)

**File Upload:**
- [ ] File input accepts CSV
- [ ] Drag-and-drop works
- [ ] File validation works
- [ ] Preview shows before import
- [ ] Column mapping works (if needed)
- [ ] "Import" button processes file
- [ ] Progress indicator shows
- [ ] Success/error messages display
- [ ] Imported staffers visible

**Error Handling:**
- [ ] Invalid CSV format rejected
- [ ] Duplicate records flagged
- [ ] Missing required fields reported
- [ ] Partial import handled

#### Export Functions
Test from various locations:

**CSV Export:**
- [ ] "Export CSV" downloads file
- [ ] File opens in Excel/Sheets
- [ ] All data present
- [ ] Formatting correct

**JSON Export:**
- [ ] "Export JSON" downloads
- [ ] Valid JSON structure
- [ ] All fields included

**GraphML Export:**
- [ ] "Export GraphML" downloads
- [ ] Opens in Gephi (test if possible)
- [ ] Network structure correct

---

### Admin Features

#### Staffer Management (Admin)
**URL:** `/admin/staffers`

**List View:**
- [ ] All staffers listed
- [ ] Search works
- [ ] Filters work
- [ ] Sorting works
- [ ] Pagination works

**Add Staffer:**
- [ ] "Add New" button works
- [ ] Form loads
- [ ] All fields editable
- [ ] Validation works
- [ ] Submit creates staffer
- [ ] Success message shows
- [ ] Redirects to new profile

**Edit Staffer:**
- [ ] Edit button opens form
- [ ] Fields pre-populated
- [ ] Changes save correctly
- [ ] Success feedback shows

**Delete Staffer:**
- [ ] Delete button works
- [ ] Confirmation modal appears
- [ ] Delete executes
- [ ] Cascade deletes positions (check)
- [ ] Success message shows

**Add Career Position:**
- [ ] "Add Position" button works
- [ ] Form validates
- [ ] Position saves
- [ ] Timeline updates

---

### User Settings

#### Profile Settings
**URL:** `/settings/profile`

**Edit Profile:**
- [ ] Name field editable
- [ ] Email field editable
- [ ] Profile photo upload works
- [ ] Save button works
- [ ] Changes persist
- [ ] Success message shows

**Change Password:**
- [ ] Current password required
- [ ] New password validation works
- [ ] Confirm password matching works
- [ ] Submit changes password
- [ ] Success message shows

---

### Error Pages

#### 404 Not Found
**URL:** `/nonexistent-page`

- [ ] 404 page displays
- [ ] Message is clear
- [ ] "Go Home" button works
- [ ] Navigation still works

#### 500 Server Error
Simulate server error:

- [ ] 500 page displays (or error boundary)
- [ ] User-friendly message
- [ ] "Try Again" button works
- [ ] Support contact info shown

---

## 3. CROSS-BROWSER TESTING

Test in multiple browsers:

### Chrome
- [ ] All pages load
- [ ] All features work
- [ ] No console errors
- [ ] CSS renders correctly

### Firefox
- [ ] All pages load
- [ ] All features work
- [ ] No console errors
- [ ] CSS renders correctly

### Safari
- [ ] All pages load
- [ ] All features work
- [ ] No console errors
- [ ] CSS renders correctly

### Edge
- [ ] All pages load
- [ ] All features work
- [ ] No console errors

---

## 4. RESPONSIVE DESIGN TESTING

Test on different screen sizes:

### Mobile (320px - 480px)
- [ ] Navigation collapses to hamburger
- [ ] Text readable (not too small)
- [ ] Buttons large enough to tap
- [ ] Forms work properly
- [ ] Tables scroll horizontally
- [ ] Images scale properly
- [ ] No horizontal scroll

### Tablet (481px - 768px)
- [ ] Layout adjusts appropriately
- [ ] Touch targets adequate size
- [ ] Grid/flex layouts work
- [ ] Navigation appropriate

### Desktop (769px+)
- [ ] Full layout displays
- [ ] Sidebar visible (if applicable)
- [ ] Multi-column layouts work
- [ ] Hover states work

---

## 5. API TESTING

### Authentication Endpoints
```bash
# Test signup
POST /api/auth/signup
Body: { email, password, name }
Expected: 201 Created, returns user + token

# Test login
POST /api/auth/login
Body: { email, password }
Expected: 200 OK, returns token

# Test logout
POST /api/auth/logout
Headers: Authorization: Bearer <token>
Expected: 200 OK

# Test protected route without token
GET /api/staffers
Expected: 401 Unauthorized
```

### Staffers Endpoints
```bash
# Search staffers
GET /api/staffers/search?q=johnson&chamber=House
Expected: 200 OK, returns array

# Get specific staffer
GET /api/staffers/1
Expected: 200 OK, returns staffer object

# Get staffer timeline
GET /api/staffers/1/timeline
Expected: 200 OK, returns career positions

# Get staffer network
GET /api/staffers/1/network
Expected: 200 OK, returns nodes + edges
```

### Miro Endpoints
```bash
# Check connection status
GET /api/user/miro-status
Expected: 200 OK, { connected: boolean }

# Create board for office
POST /api/miro/map-office
Body: { member_name: "Mike Johnson" }
Expected: 200 OK, { board_url, board_id }

# Create board for staffer
POST /api/miro/map-staffer
Body: { staffer_id: 1 }
Expected: 200 OK, { board_url }
```

### Error Handling
- [ ] 400 Bad Request for invalid data
- [ ] 401 Unauthorized for missing auth
- [ ] 403 Forbidden for insufficient permissions
- [ ] 404 Not Found for missing resources
- [ ] 500 Internal Server Error handled gracefully

---

## 6. PERFORMANCE TESTING

**Page Load Times:**
- [ ] Homepage loads in < 3 seconds
- [ ] Search results in < 2 seconds
- [ ] Staffer profile in < 2 seconds
- [ ] Network graph in < 5 seconds

**API Response Times:**
- [ ] GET requests < 500ms
- [ ] POST requests < 1 second
- [ ] Search queries < 1 second

**Database Queries:**
- [ ] No N+1 query problems
- [ ] Indexes on frequently queried fields
- [ ] Pagination limits results

**Asset Optimization:**
- [ ] Images compressed
- [ ] CSS/JS minified
- [ ] Lazy loading implemented (if applicable)

---

## 7. SECURITY TESTING

**Authentication:**
- [ ] Passwords hashed (bcrypt/argon2)
- [ ] JWTs expire appropriately
- [ ] Refresh tokens implemented
- [ ] Session management secure

**Authorization:**
- [ ] Admin routes protected
- [ ] Users can't access others' data
- [ ] API routes check permissions

**Input Validation:**
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (input sanitization)
- [ ] CSRF tokens implemented (if applicable)

**API Security:**
- [ ] Rate limiting implemented
- [ ] CORS configured correctly
- [ ] Sensitive data not exposed
- [ ] API keys stored securely

---

## 8. ACCESSIBILITY TESTING

**Keyboard Navigation:**
- [ ] Tab through all interactive elements
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals
- [ ] Focus visible on all elements

**Screen Reader:**
- [ ] Alt text on images
- [ ] ARIA labels on buttons
- [ ] Form labels properly associated
- [ ] Headings hierarchical (h1 → h2 → h3)

**Color Contrast:**
- [ ] Text readable on backgrounds
- [ ] Meets WCAG AA standards
- [ ] Links distinguishable

---

## 9. DATABASE INTEGRITY

**Data Validation:**
- [ ] Foreign keys enforced
- [ ] Required fields not null
- [ ] Unique constraints work
- [ ] Data types correct

**Cascading Deletes:**
- [ ] Deleting staffer removes positions
- [ ] Deleting user removes their boards
- [ ] Orphaned records don't exist

**Backups:**
- [ ] Backup system in place
- [ ] Restore tested

---

## 10. SPECIFIC BUG CHECKS

**Common Issues to Look For:**

- [ ] **Broken images** - Check all img src attributes
- [ ] **Uncaught promise rejections** - Wrap async calls in try/catch
- [ ] **Memory leaks** - Clean up event listeners
- [ ] **Infinite loops** - Check useEffect dependencies
- [ ] **Race conditions** - Check async operations
- [ ] **Stale data** - Ensure data refreshes
- [ ] **Missing error boundaries** - Add React error boundaries
- [ ] **Unhandled null/undefined** - Add null checks
- [ ] **Hardcoded URLs** - Use environment variables
- [ ] **Console.log statements** - Remove debug logs
- [ ] **Dead code** - Remove unused functions/components
- [ ] **Typos** - Spell check all text
- [ ] **Broken redirects** - Test after login/logout
- [ ] **Modal doesn't close** - Test escape key
- [ ] **Form doesn't reset** - Clear after submit

---

## 11. AUTOMATED TESTS TO RUN

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- auth
npm test -- staffers
npm test -- miro

# Run E2E tests (if implemented)
npm run test:e2e

# Run coverage report
npm test -- --coverage
```

---

## 12. DEPLOYMENT CHECKLIST

Before deploying:

- [ ] All tests passing
- [ ] No console errors
- [ ] No console warnings
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] SSL certificate valid
- [ ] Domain configured correctly
- [ ] API keys secure
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Analytics configured (if needed)

---

## BUG REPORT FORMAT

When you find issues, document them:

```markdown
**Bug ID:** #001
**Page:** /staffers/search
**Issue:** Search button not working
**Steps to Reproduce:**
1. Go to /staffers/search
2. Enter "johnson" in search box
3. Click search button
4. Nothing happens

**Expected:** Results should load
**Actual:** Button click does nothing

**Console Errors:**
```
TypeError: Cannot read property 'map' of undefined
  at StafferSearch.js:45
```

**Priority:** High
**Status:** Open
**Assigned To:** [Name]
```

---

## PRIORITY LEVELS

**Critical (Fix Immediately):**
- Site completely broken
- Can't login/signup
- Data loss possible
- Security vulnerability

**High (Fix Before Launch):**
- Major feature broken
- Broken user flow
- Visual bugs affecting usability

**Medium (Fix Soon):**
- Minor features broken
- Cosmetic issues
- Non-critical errors

**Low (Nice to Have):**
- Enhancement requests
- Minor UI polish
- Performance optimizations

---

## FINAL CHECKLIST

Before marking QA complete:

- [ ] All Critical bugs fixed
- [ ] All High bugs fixed
- [ ] Medium bugs documented
- [ ] Low bugs prioritized
- [ ] All links working
- [ ] All buttons functional
- [ ] All forms submitting
- [ ] No console errors
- [ ] Responsive on all devices
- [ ] Cross-browser tested
- [ ] Performance acceptable
- [ ] Security tested
- [ ] Accessibility checked
- [ ] Database integrity verified

---

## EXECUTION INSTRUCTIONS

1. **Start with automated checks** - Run linters, broken link checker
2. **Test systematically** - Go page by page, don't skip
3. **Document everything** - Screenshot bugs, note steps to reproduce
4. **Fix as you go** - For simple fixes, fix immediately
5. **Prioritize** - Use priority system for complex bugs
6. **Re-test after fixes** - Verify fixes work, didn't break anything else
7. **Final pass** - Do one complete walkthrough after all fixes

---

**Start testing now. Report all findings with bug IDs, priority levels, and reproduction steps.**
