# Phase 5: Complete Frontend Integration Plan

**Status**: 🚨 In Progress
**Priority**: Replace component library showcase with marketplace interface
**Backend Status**: ✅ Complete (53 tests passing)

---

## Executive Summary

Phase 5 delivers the complete marketplace user experience by integrating the backend components (Vincent auth, Nexus payments, agent services) into a cohesive frontend interface. The current application displays a component library showcase; this phase replaces it with a functional marketplace where users can:

1. Browse autonomous agent listings
2. Create new listings with AI-powered image analysis
3. Purchase listings using Vincent wallet + PyUSD → USDC swaps
4. Track transactions across chains
5. View agent performance metrics

---

## Complete User Flow

### Flow 1: First-Time Visitor (Browse & Discovery)

```
Landing Page (/)
    ↓
User sees:
- Hero section: "Autonomous Agent Marketplace"
- Live metrics: Total listings, 24h volume, active agents
- Featured listings grid (3 columns)
- CTA: "Create Listing" | "Browse All Listings"
    ↓
User clicks "Browse All Listings"
    ↓
Listings Page (/listings)
    ↓
User sees:
- Search bar (powered by semantic search)
- Filter sidebar: Category, Price range, Agent rating
- Grid of listing cards with:
  * Product image
  * Title + description
  * Price in PYUSD
  * Seller agent address (truncated)
  * "View Details" button
    ↓
User clicks listing card
    ↓
Listing Detail Page (/listings/[id])
    ↓
User sees:
- Large product image
- Full description (AI-generated)
- Price in PYUSD
- Seller information
- "Purchase with Vincent" button (disabled - not authenticated)
- Message: "Connect your Vincent wallet to purchase"
```

### Flow 2: Purchasing a Listing (Core Transaction Flow)

```
Listing Detail Page (/listings/[id])
    ↓
User clicks "Connect Vincent Wallet"
    ↓
VincentConnect Component Renders
    ↓
User clicks "Connect Vincent Wallet" button
    ↓
Redirect to Vincent Authorization Page
(External: https://wallet.heyvincent.ai/authorize)
    ↓
User approves connection in Vincent app
    ↓
Redirect back to app with JWT in URL
    ↓
VincentConnect Component:
1. Extracts JWT from URL
2. Stores in localStorage (key: VINCENT_AUTH_JWT)
3. Removes JWT from URL (clean URL)
4. Calls POST /api/vincent/auth/verify
    ↓
Backend (/api/vincent/auth/verify):
1. Verifies JWT signature
2. Extracts PKP wallet address
3. Stores in VincentAuth table
4. Returns { walletAddress, expiresAt }
    ↓
VincentConnect calls onAuthComplete(jwt, walletAddress)
    ↓
AgentPurchasePanel Component:
- Shows "Connected" badge
- Displays wallet address (truncated)
- Enables "Purchase for X PYUSD" button
    ↓
User clicks "Purchase for X PYUSD"
    ↓
AgentPurchasePanel calls POST /api/agents/purchase
Payload: {
  buyerAgentId: walletAddress,
  sellerWalletAddress: listing.sellerAddress,
  pyusdAmount: listing.price,
  fromChainId: 11155111 (ETH Sepolia),
  toChainId: 421614 (Arbitrum Sepolia),
  listingId: listing.id
}
    ↓
Backend (/api/agents/purchase):
1. Validates request (addresses, chains, amounts)
2. Calls AgentService.executePurchase()
    ↓
AgentService.executePurchase():
Step 1: Swap PyUSD → USDC on ETH Sepolia
    - VincentWalletAbilityService.swapPyusdToUsdc()
    - Returns: { swapTxHash, amountOut }

Step 2: Cross-chain transfer to seller
    - NexusService.executeTransfer()
    - Auto-approves intent (via hook)
    - Auto-approves allowance (via hook)
    - Returns: { explorerUrl, status }

Step 3: Record in database
    - Transaction table: swap hash, amounts, chains
    - Proof table: agent decision record
    ↓
Response to Frontend: {
  success: true,
  swapTxHash: "0x...",
  transferExplorerUrl: "https://arbiscan.io/tx/0x...",
  usdcAmount: "95000000"
}
    ↓
AgentPurchasePanel renders success UI:
- Green checkmark icon
- "Purchase Successful!" message
- Swap transaction hash (with copy button)
- USDC amount received (formatted: "95.00 USDC")
- "View Transfer on Explorer →" link (opens in new tab)
    ↓
User clicks explorer link
    ↓
Opens Arbiscan showing cross-chain transfer
(External: https://sepolia.arbiscan.io/tx/0x...)
```

### Flow 3: Creating a Listing (Seller Flow)

```
Navigation Bar
    ↓
User clicks "Create Listing"
    ↓
Create Listing Page (/listings/create)
    ↓
User sees form:
- ImageUpload component (drag-and-drop)
- "AI Analysis" button
- Manual fields (disabled until analysis):
  * Title
  * Description
  * Category
  * Price (PYUSD)
  * Condition
    ↓
User drags image onto ImageUpload component
    ↓
ImageUpload shows preview + file details
    ↓
User clicks "Analyze with AI"
    ↓
Loading state: "Analyzing image..."
    ↓
Frontend calls POST /api/analyze
Payload: { image: base64String }
    ↓
Backend (/api/analyze):
1. Calls OpenAI GPT-4 Vision
2. Extracts: title, category, condition, price, description
3. Returns structured data
    ↓
Form auto-fills with AI results:
- Title: "Vintage Leather Jacket"
- Category: "Clothing"
- Condition: "Good"
- Price: 45 (PYUSD)
- Description: "High-quality vintage..."
    ↓
User reviews and edits if needed
    ↓
User clicks "Create Listing"
    ↓
Frontend calls POST /api/listings
Payload: {
  title, description, category, price,
  condition, imageUrl,
  sellerAddress: walletAddress
}
    ↓
Backend (/api/listings):
1. Creates listing in database
2. Emits ListingCreated event (Envio tracking)
3. Returns: { id, ...listingData }
    ↓
Redirect to listing detail page
    ↓
Success toast: "Listing created successfully!"
```

### Flow 4: Agent Dashboard (Performance Tracking)

```
Navigation Bar
    ↓
User clicks "My Agent"
    ↓
Agent Dashboard Page (/agents/[address])
    ↓
User sees:
- Agent header:
  * Wallet address (full + copy button)
  * Total listings created
  * Total purchases made
  * Success rate percentage
  * Total volume (USDC)

- Active Listings Section:
  * Grid of user's listings
  * Status badges (Active, Sold, Expired)
  * Quick actions (Edit, Deactivate)

- Purchase History Section:
  * Table of completed purchases
  * Columns: Date, Listing, Amount, Status, Explorer Link
  * Real-time status updates

- Transaction Timeline:
  * Visual timeline of all agent activity
  * Icons for different event types
  * Timestamps + transaction links
    ↓
User clicks transaction explorer link
    ↓
Opens blockchain explorer
(External: Etherscan or Arbiscan)
```

### Flow 5: Market Activity (Analytics)

```
Navigation Bar
    ↓
User clicks "Market Activity"
    ↓
Market Activity Page (/activity)
    ↓
User sees dashboard powered by Envio HyperSync:

- Global Metrics (top cards):
  * Total Listings: 1,234
  * 24h Volume: $12,345 USDC
  * Active Agents: 56
  * Avg Transaction Time: 2.3 min

- Live Activity Feed:
  * Real-time event stream
  * Updates every 2 seconds
  * Events: ListingCreated, PurchaseInitiated, PurchaseCompleted
  * Format: "Agent 0x1234 purchased 'Vintage Jacket' for 45 PYUSD"

- Charts:
  * Volume over time (line chart)
  * Transactions by chain (pie chart)
  * Top agents leaderboard (table)
  * Price distribution (histogram)
    ↓
Real-time WebSocket updates
    ↓
Feed auto-scrolls with new events
    ↓
Charts update dynamically
```

---

## Page Architecture

### Page 1: Landing Page (`/`)

**Purpose**: First impression, drive engagement, show live marketplace activity

**Components**:
- `Hero` - Headline, tagline, dual CTAs
- `LiveMetrics` - Cards showing total listings, 24h volume, active agents
- `FeaturedListings` - 3-column grid of top listings
- `HowItWorks` - 3-step visual guide
- `Footer` - Links, social, legal

**Data Sources**:
- Featured listings: `GET /api/listings?featured=true&limit=6`
- Live metrics: `GET /api/metrics/summary`

**File**: `src/app/page.tsx`

---

### Page 2: Listings Browse (`/listings`)

**Purpose**: Search and filter all marketplace listings

**Components**:
- `SearchBar` - Semantic search input
- `FilterSidebar` - Category, price range, agent rating
- `ListingGrid` - Responsive grid of `ListingCard` components
- `Pagination` - Page navigation

**Data Sources**:
- Listings: `GET /api/listings?page=1&limit=20&category=...&search=...`

**File**: `src/app/listings/page.tsx`

---

### Page 3: Listing Detail (`/listings/[id]`)

**Purpose**: View listing details and execute purchase

**Components**:
- `ListingHeader` - Title, price, seller info
- `ProductImageGallery` - Full-size images
- `ListingDescription` - AI-generated description
- `AgentPurchasePanel` - **Already implemented**
  * `VincentConnect` - **Already implemented**
- `RelatedListings` - Similar items

**Data Sources**:
- Listing: `GET /api/listings/[id]`

**Files**:
- `src/app/listings/[id]/page.tsx` (new)
- `src/app/components/AgentPurchasePanel.tsx` ✅ (complete)
- `src/app/components/VincentConnect.tsx` ✅ (complete)

---

### Page 4: Create Listing (`/listings/create`)

**Purpose**: Upload images and create new listings with AI assistance

**Components**:
- `ImageUpload` - **Already implemented** (drag-and-drop)
- `AIAnalysisButton` - Trigger AI image analysis
- `ListingForm` - Title, description, price, category
- `PreviewCard` - Live preview of listing

**Data Sources**:
- AI analysis: `POST /api/analyze` (body: `{ image }`)
- Create listing: `POST /api/listings` (body: listing data)

**Files**:
- `src/app/listings/create/page.tsx` (new)
- `src/app/components/ImageUpload.tsx` ✅ (complete)

---

### Page 5: Agent Dashboard (`/agents/[address]`)

**Purpose**: Agent performance metrics and activity history

**Components**:
- `AgentHeader` - Address, stats, reputation badge
- `PerformanceMetrics` - Cards with success rate, volume, count
- `ActiveListings` - User's listings grid
- `PurchaseHistory` - Table with transaction links
- `TransactionTimeline` - Visual activity log

**Data Sources**:
- Agent data: `GET /api/agents/[address]`
- Listings: `GET /api/listings?sellerAddress=[address]`
- Purchases: `GET /api/transactions?buyerAgentId=[address]`

**File**: `src/app/agents/[address]/page.tsx` (new)

---

### Page 6: Market Activity (`/activity`)

**Purpose**: Real-time market analytics and event stream

**Components**:
- `GlobalMetrics` - Summary cards
- `ActivityFeed` - Live event stream (WebSocket)
- `VolumeChart` - Time-series chart
- `ChainDistribution` - Pie chart
- `TopAgentsLeaderboard` - Ranked table

**Data Sources**:
- Metrics: `GET /api/metrics/summary`
- Events: WebSocket subscription to Envio HyperSync
- Charts: `GET /api/analytics/volume` + `/api/analytics/distribution`

**File**: `src/app/activity/page.tsx` (new)

---

## Navigation Structure

### Global Navigation (`src/app/layout.tsx`)

**Desktop Nav Bar**:
```
┌──────────────────────────────────────────────────────────────┐
│ Dans List 🏠   Browse   Create Listing   Market Activity      │
│                                                 [My Agent 👤]  │
└──────────────────────────────────────────────────────────────┘
```

**Mobile Nav (Hamburger)**:
- Home
- Browse Listings
- Create Listing
- Market Activity
- My Agent Dashboard
- Transaction History

**Footer**:
- About
- How It Works
- GitHub Repo
- Documentation
- Privacy Policy

---

## Implementation Tasks (Phase 5.0 - 5.6)

### ✅ Already Completed (Phase 4)

**Backend API Routes**:
- [x] `POST /api/vincent/auth/verify` - JWT verification
- [x] `POST /api/agents/purchase` - Purchase execution

**Frontend Components**:
- [x] `VincentConnect.tsx` - JWT authentication flow
- [x] `AgentPurchasePanel.tsx` - Purchase UI with status tracking
- [x] `ImageUpload.tsx` - Drag-and-drop image upload
- [x] `Button.tsx` - Reusable button component
- [x] `Input.tsx` - Form input with validation
- [x] `LoadingSpinner.tsx` - Loading indicator
- [x] `ErrorBoundary.tsx` - Error handling

**Backend Services**:
- [x] `AgentService` - Purchase orchestration
- [x] `VincentWalletAbilityService` - PyUSD → USDC swaps
- [x] `NexusService` - Cross-chain transfers
- [x] `JWT Service` - Vincent JWT verification

---

### Task 5.0: Marketplace Shell & Navigation (2 hours)

**Sub-task 5.0.1**: Replace Component Showcase (30 min)

**Current**: `src/app/page.tsx` shows component library
**Target**: Marketplace landing page

Create `src/app/page.tsx`:
```typescript
import { Suspense } from 'react';
import { Hero } from '@/app/components/Hero';
import { LiveMetrics } from '@/app/components/LiveMetrics';
import { FeaturedListings } from '@/app/components/FeaturedListings';

export default async function HomePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Hero />
      <Suspense fallback={<LoadingSpinner />}>
        <LiveMetrics />
      </Suspense>
      <Suspense fallback={<div>Loading listings...</div>}>
        <FeaturedListings />
      </Suspense>
      <HowItWorks />
    </main>
  );
}
```

**Files to Create**:
- `src/app/components/Hero.tsx`
- `src/app/components/LiveMetrics.tsx`
- `src/app/components/FeaturedListings.tsx`
- `src/app/components/HowItWorks.tsx`

---

**Sub-task 5.0.2**: Create Global Navigation (30 min)

Update `src/app/layout.tsx`:
```typescript
import { Navigation } from '@/app/components/Navigation';
import { Footer } from '@/app/components/Footer';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

**Files to Create**:
- `src/app/components/Navigation.tsx`
- `src/app/components/Footer.tsx`

---

**Sub-task 5.0.3**: Create API Routes (30 min)

**Listings API** (`src/app/api/listings/route.ts`):
```typescript
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const category = searchParams.get('category');

  const prisma = getPrismaClient();
  const listings = await prisma.listing.findMany({
    where: category ? { category } : undefined,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ listings, page, total: count });
}
```

**Metrics API** (`src/app/api/metrics/summary/route.ts`):
```typescript
export async function GET() {
  const prisma = getPrismaClient();

  const [totalListings, totalVolume, activeAgents] = await Promise.all([
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'CONFIRMED' }
    }),
    prisma.agent.count({ where: { lastActivity: { gte: oneDayAgo } } })
  ]);

  return NextResponse.json({ totalListings, totalVolume, activeAgents });
}
```

**Files to Create**:
- `src/app/api/listings/route.ts`
- `src/app/api/listings/[id]/route.ts`
- `src/app/api/metrics/summary/route.ts`

---

**Sub-task 5.0.4**: Style Enhancements (30 min)

Update `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --primary: 220 90% 56%;
    --primary-foreground: 0 0% 100%;
    --background: 0 0% 98%;
    --foreground: 222 47% 11%;
  }

  .dark {
    --primary: 220 90% 56%;
    --primary-foreground: 0 0% 100%;
    --background: 222 47% 11%;
    --foreground: 0 0% 98%;
  }
}
```

---

### Task 5.1: Listing Pages (3 hours)

**Sub-task 5.1.1**: Listings Browse Page (1.5 hours)

Create `src/app/listings/page.tsx`:
```typescript
'use client';

import { useState, useEffect } from 'react';
import { ListingCard } from '@/app/components/ListingCard';
import { FilterSidebar } from '@/app/components/FilterSidebar';
import { SearchBar } from '@/app/components/SearchBar';

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [filters, setFilters] = useState({ category: null, priceRange: null });

  useEffect(() => {
    fetch('/api/listings?' + new URLSearchParams(filters))
      .then(res => res.json())
      .then(data => setListings(data.listings));
  }, [filters]);

  return (
    <div className="container mx-auto px-4 py-8">
      <SearchBar onSearch={handleSearch} />
      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-3">
          <FilterSidebar filters={filters} onChange={setFilters} />
        </aside>
        <main className="col-span-9">
          <div className="grid grid-cols-3 gap-4">
            {listings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
```

**Files to Create**:
- `src/app/listings/page.tsx`
- `src/app/components/ListingCard.tsx`
- `src/app/components/FilterSidebar.tsx`
- `src/app/components/SearchBar.tsx`

---

**Sub-task 5.1.2**: Listing Detail Page (1.5 hours)

Create `src/app/listings/[id]/page.tsx`:
```typescript
import { AgentPurchasePanel } from '@/app/components/AgentPurchasePanel';
import { notFound } from 'next/navigation';

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const listing = await fetch(`/api/listings/${params.id}`).then(res => res.json());

  if (!listing) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-2 gap-8">
        <div>
          <img src={listing.imageUrl} alt={listing.title} className="rounded-lg" />
        </div>
        <div>
          <h1 className="text-3xl font-bold mb-4">{listing.title}</h1>
          <p className="text-gray-600 mb-6">{listing.description}</p>

          <AgentPurchasePanel
            listing={{
              id: listing.id,
              title: listing.title,
              price: listing.price,
              sellerAddress: listing.sellerAddress,
              description: listing.description,
              imageUrl: listing.imageUrl,
            }}
            onPurchaseComplete={(result) => {
              console.log('Purchase complete:', result);
              // Show success toast
            }}
            onPurchaseError={(error) => {
              console.error('Purchase failed:', error);
              // Show error toast
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

**Files to Create**:
- `src/app/listings/[id]/page.tsx`
- `src/app/components/ProductImageGallery.tsx` (optional enhancement)

**Integration**: Uses existing `AgentPurchasePanel` and `VincentConnect` ✅

---

### Task 5.2: Create Listing Page (2 hours)

Create `src/app/listings/create/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { ImageUpload } from '@/app/components/ImageUpload';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';

export default function CreateListingPage() {
  const [image, setImage] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: 0,
    category: '',
    condition: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    const base64 = await fileToBase64(image);

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
    });

    const result = await response.json();
    setFormData(result);
    setIsAnalyzing(false);
  };

  const handleSubmit = async () => {
    const response = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, imageUrl: await uploadImage(image) }),
    });

    const listing = await response.json();
    router.push(`/listings/${listing.id}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Create New Listing</h1>

      <ImageUpload
        onFileSelected={setImage}
        accept="image/*"
      />

      <Button
        onClick={handleAnalyze}
        disabled={!image || isAnalyzing}
        className="mt-4"
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
      </Button>

      <form className="mt-6 space-y-4">
        <Input
          label="Title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
        <Input
          label="Description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          multiline
        />
        <Input
          label="Price (PYUSD)"
          type="number"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
        />

        <Button onClick={handleSubmit}>Create Listing</Button>
      </form>
    </div>
  );
}
```

**Files to Create**:
- `src/app/listings/create/page.tsx`
- `src/app/api/analyze/route.ts` (AI image analysis)
- `src/app/api/listings/route.ts` (POST handler)

**Integration**: Uses existing `ImageUpload`, `Button`, `Input` ✅

---

### Task 5.3: Agent Dashboard Page (2 hours)

Create `src/app/agents/[address]/page.tsx`:
```typescript
export default async function AgentDashboardPage({ params }: { params: { address: string } }) {
  const agent = await fetch(`/api/agents/${params.address}`).then(res => res.json());
  const listings = await fetch(`/api/listings?sellerAddress=${params.address}`).then(res => res.json());
  const purchases = await fetch(`/api/transactions?buyerAgentId=${params.address}`).then(res => res.json());

  return (
    <div className="container mx-auto px-4 py-8">
      <AgentHeader agent={agent} />

      <div className="grid grid-cols-4 gap-4 mt-6">
        <MetricCard title="Total Listings" value={agent.totalListings} />
        <MetricCard title="Purchases Made" value={agent.totalPurchases} />
        <MetricCard title="Success Rate" value={`${agent.successRate}%`} />
        <MetricCard title="Total Volume" value={`${agent.totalVolume} USDC`} />
      </div>

      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Active Listings</h2>
        <ListingGrid listings={listings.filter(l => l.status === 'ACTIVE')} />
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Purchase History</h2>
        <TransactionTable transactions={purchases} />
      </section>
    </div>
  );
}
```

**Files to Create**:
- `src/app/agents/[address]/page.tsx`
- `src/app/components/AgentHeader.tsx`
- `src/app/components/MetricCard.tsx`
- `src/app/components/TransactionTable.tsx`
- `src/app/api/agents/[address]/route.ts`

---

### Task 5.4: Market Activity Page (2 hours)

Create `src/app/activity/page.tsx` with Envio HyperSync integration:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { HyperSyncClient } from '@envio-dev/hypersync-client';
import { ActivityFeed } from '@/app/components/ActivityFeed';
import { VolumeChart } from '@/app/components/VolumeChart';

export default function MarketActivityPage() {
  const [metrics, setMetrics] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Fetch initial metrics
    fetch('/api/metrics/summary')
      .then(res => res.json())
      .then(setMetrics);

    // Subscribe to real-time events via WebSocket
    const ws = new WebSocket('ws://localhost:3000/api/events');
    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data);
      setEvents(prev => [event, ...prev].slice(0, 50));
    };

    return () => ws.close();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Market Activity</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard title="Total Listings" value={metrics?.totalListings} />
        <MetricCard title="24h Volume" value={`$${metrics?.totalVolume}`} />
        <MetricCard title="Active Agents" value={metrics?.activeAgents} />
        <MetricCard title="Avg Time" value="2.3 min" />
      </div>

      <div className="grid grid-cols-2 gap-8">
        <ActivityFeed events={events} />
        <VolumeChart />
      </div>
    </div>
  );
}
```

**Files to Create**:
- `src/app/activity/page.tsx`
- `src/app/components/ActivityFeed.tsx`
- `src/app/components/VolumeChart.tsx`
- `src/app/api/events/route.ts` (WebSocket handler)

---

## Testing Strategy

### Unit Tests (Vitest)

**Component Tests**:
- [ ] `Hero.test.tsx` - Renders CTAs, text content
- [ ] `ListingCard.test.tsx` - Price display, image, click handling
- [ ] `AgentHeader.test.tsx` - Address truncation, copy button
- [ ] `ActivityFeed.test.tsx` - Event rendering, auto-scroll

**API Route Tests**:
- [ ] `listings/route.test.ts` - Pagination, filtering
- [ ] `metrics/summary/route.test.ts` - Aggregation logic

### Integration Tests

**Purchase Flow**:
```typescript
test('complete purchase flow', async () => {
  // 1. Load listing detail page
  render(<ListingDetailPage params={{ id: 'test-listing' }} />);

  // 2. Connect Vincent wallet
  const connectButton = screen.getByText('Connect Vincent Wallet');
  await userEvent.click(connectButton);
  // Mock JWT redirect and verification

  // 3. Execute purchase
  const purchaseButton = screen.getByText(/Purchase for/);
  await userEvent.click(purchaseButton);

  // 4. Verify success state
  await waitFor(() => {
    expect(screen.getByText('Purchase Successful!')).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

**Critical Paths**:
1. Browse → Detail → Purchase → Success
2. Create Listing → AI Analysis → Submit → View
3. Agent Dashboard → Transaction History → Explorer Link

---

## Deployment Checklist

### Environment Variables
```bash
# Required for Phase 5
NEXT_PUBLIC_VINCENT_APP_ID=2353371285
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
VINCENT_APP_PRIVATE_KEY=0x...
NEXUS_CLIENT_ID=...
NEXUS_SECRET_KEY=...
```

### Pre-launch Tasks
- [ ] Run full test suite: `npm run test`
- [ ] Type check: `npm run typecheck`
- [ ] Lint: `npm run lint`
- [ ] Build verification: `npm run build`
- [ ] Database migration: `npx prisma migrate deploy`
- [ ] Seed database: `npx prisma db seed`

### Performance Targets
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Bundle size < 200KB (gzipped)

---

## Success Criteria

Phase 5 is complete when:

✅ **User Can**:
1. Browse marketplace listings without authentication
2. Search listings using semantic search
3. Connect Vincent wallet via OAuth flow
4. Purchase listing with PyUSD → USDC swap
5. View transaction on blockchain explorer
6. Create new listing with AI image analysis
7. View agent dashboard with performance metrics
8. Monitor real-time market activity

✅ **Technical**:
1. All pages render without errors
2. Vincent authentication persists across sessions
3. Purchase flow completes end-to-end
4. All API routes return correct data
5. Real-time events update UI without refresh
6. Mobile responsive (tested on 3 screen sizes)

✅ **Quality**:
1. 80%+ test coverage
2. Zero TypeScript errors
3. Zero ESLint errors
4. Accessibility score > 90
5. All user flows documented

---

## Next Steps After Phase 5

### Phase 6: Production Readiness
- Error monitoring (Sentry)
- Analytics (PostHog)
- Rate limiting
- DDOS protection
- CDN integration

### Phase 7: Advanced Features
- Multi-token support (beyond PyUSD)
- Agent reputation system
- Escrow contracts
- Dispute resolution
- Mobile app (React Native)

---

## Questions & Decisions Log

**Q**: Should we support multiple images per listing?
**A**: Phase 5 uses single image. Multi-image in Phase 6.

**Q**: How to handle JWT expiration during purchase?
**A**: VincentConnect checks expiration before purchase. Auto-refresh if needed.

**Q**: What if Nexus transfer fails after swap succeeds?
**A**: Transaction marked FAILED. Manual reconciliation required. Phase 6: Auto-refund.

**Q**: Real-time updates via WebSocket or polling?
**A**: WebSocket for ActivityFeed. Polling (30s) for metrics. Hybrid approach.

---

## Conclusion

Phase 5 transforms the application from a component showcase into a fully functional autonomous agent marketplace. By integrating the completed backend services (Vincent auth, Nexus payments, agent orchestration) with a comprehensive frontend interface, users can execute complete purchase flows with zero manual blockchain interactions.

**Estimated Timeline**: 12-15 hours total
**Risk**: Medium (most backend complete, frontend mostly new code)
**Dependencies**: OpenAI API key, Database seed data

**Priority Actions**:
1. **Immediate**: Replace `src/app/page.tsx` component showcase
2. **Day 1**: Create listing detail page with purchase integration
3. **Day 2**: Build create listing page with AI analysis
4. **Day 3**: Complete agent dashboard and market activity

Let's ship this! 🚀
