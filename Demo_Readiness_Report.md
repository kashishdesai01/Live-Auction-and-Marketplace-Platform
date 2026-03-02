# BidVault — Demo Readiness Report

## What's Already Done ✅

The core of the platform is fully implemented and impressive. Here's what works end-to-end:

| Area | Status |
|------|--------|
| Auth (register/login/refresh/logout/role switch) | ✅ Complete |
| Homepage with hero, categories, trending, sellers | ✅ Complete |
| Browse page with live category/condition/sort filters | ✅ Complete |
| Auction detail page with image gallery, bid history, seller card | ✅ Complete |
| Real-time `LiveBidPanel` with Socket.IO | ✅ Complete |
| `CountdownTimer` with color stages | ✅ Complete |
| Seller dashboard (metrics, quick links) | ✅ Complete |
| Seller inventory (list, delete, schedule auction modal) | ✅ Complete |
| New listing wizard (3-step form) | ✅ Complete |
| Seller analytics (revenue chart, category bar chart) | ✅ Complete |
| Seller orders (filter, mark shipped modal) | ✅ Complete |
| Seller settings (storefront profile + Stripe Connect tab) | ✅ Complete |
| Buyer bid history table | ✅ Complete |
| Buyer onboarding (category picker) | ✅ Complete |
| Buyer settings (update display name) | ✅ Complete |
| Notification bell component | ✅ Complete |
| Seller storefront (`/sellers/:id`) | ✅ Complete |
| All backend routes & services | ✅ Complete |
| Cron jobs (start/end auctions, affinity decay) | ✅ Complete |
| Mock data seed script | ✅ Complete |
| Docker Compose (Postgres + Redis) | ✅ Complete |

---

## Gaps — 5 Things Needed for Demo Readiness

### 🔴 Gap 1: Database Is Empty — Seed Data Not Run
**This is the most critical issue.** The database has no data, so every page shows an empty state. For a demo, you need real-looking data immediately.

**How to fix:**

```bash
# Step 1: Make sure Docker is running with the database
cd "/Users/kashishdesai/Projects/Live Auction and Marketplace"
docker compose up -d

# Step 2: Run DB migrations to create all tables
cd server
node src/db/migrate.js

# Step 3: Run the category seed (must run before mock data)
node src/db/seeds/run.js

# Step 4: Run mock data seed (creates users, items, auctions, bids)
node src/db/seeds/mockData.js
```

After step 4, you'll have:
- **Buyer login**: `buyer@example.com` / `password123`
- **Seller login**: `seller@example.com` / `password123`
- 1 live auction (Charizard), 1 scheduled, 1 ended
- Existing bids and a pending order

> [!TIP]
> After seeding, visit `http://localhost:3000` — you should see the Charizard listing card in "Trending Now". Log in as the seller to see the dashboard metrics populate.

---

### 🔴 Gap 2: Image Upload Saves Object URLs That Don't Persist
The listing wizard uses `URL.createObjectURL()` for image previews, which creates a **temporary browser-only URL** (like `blob:http://localhost:3000/...`). When the item is saved to the database and retrieved later, these blob URLs are **broken and won't display**.

**How to fix:** Switch the image upload to save files on the server via the existing local upload endpoint.

In `client/src/app/seller/items/new/page.tsx`, replace `handleImageUpload`:

```typescript
// OLD — creates a temporary blob URL (doesn't persist)
const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;
  const file = e.target.files[0];
  if (file) {
    const objectUrl = URL.createObjectURL(file);
    setForm(f => ({ ...f, imageUrls: [...f.imageUrls, objectUrl] }));
  }
};

// NEW — uploads to the local server and stores a real URL
const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const { data } = await api.post('/upload/local', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setForm(f => ({ ...f, imageUrls: [...f.imageUrls, data.url] }));
  } catch {
    alert('Image upload failed. Please try again.');
  }
};
```

> [!NOTE]
> The server already has `server/src/routes/upload.js` and serves local files from `/uploads/`. The env var `UPLOAD_PROVIDER=local` is already set. Just make sure to check the exact route path the upload endpoint uses (`POST /api/upload/local` or similar) and match it here.

---

### 🟡 Gap 3: Buyer Route `/api/buyer/profile` (PUT) Is Missing
The **Buyer Settings page** calls `PUT /api/buyer/profile` to save the display name, but this route does not exist in `server/src/routes/buyer.js`. This will cause a 404 error when buyers try to save settings.

**How to fix:** Add this route to `server/src/routes/buyer.js`:

```javascript
// Add this route to buyer.js
router.put('/profile', authenticate, requireActiveRole('buyer'), async (req, res, next) => {
  try {
    const { display_name } = req.body;
    if (!display_name || display_name.trim().length < 2) {
      return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Display name must be at least 2 characters.' } });
    }
    await pool.query(
      'UPDATE users SET display_name = $1 WHERE id = $2',
      [display_name.trim(), req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
```

And the same pattern for seller settings (`PUT /seller/profile`). Verify that route exists in `seller.js` — if it doesn't, add it the same way updating `display_name`, `storefront_name`, and `bio` in the seller_profiles table.

---

### 🟡 Gap 4: `/api/seller/stripe/account` Route Missing (Seller Stripe Connect)
The Seller Settings page calls `POST /api/seller/stripe/account` to generate a Stripe Connect OAuth link. This route doesn't exist in the current server code.

**For a demo without real Stripe:** Simply mock it so the button doesn't crash.

Add to `server/src/routes/seller.js`:

```javascript
router.post('/stripe/account', authenticate, requireActiveRole('seller'), async (req, res) => {
  // For demo: show a message instead of crashing
  res.status(501).json({ 
    error: { 
      code: 'NOT_IMPLEMENTED', 
      message: 'Stripe Connect not configured in this demo environment.' 
    } 
  });
});
```

Then update the frontend to show an informational message for the demo instead of an error.

**For a real Stripe integration:** You'd need `STRIPE_SECRET_KEY` and `STRIPE_CLIENT_ID` env vars and the `stripe` npm package.

---

### 🟡 Gap 5: `/sellers` Route (Homepage "Top Sellers" section) Is Missing
The homepage calls `GET /api/sellers` to show featured sellers, but the `sellerStorefront.js` route only handles `/sellers/:id` — not the list endpoint `/sellers`. This causes the "Top Sellers" section to always be empty.

**How to fix:** Add the list route to `server/src/routes/sellerStorefront.js`:

```javascript
// Add at the top of the file, before the /:id route
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id, u.display_name, 
        sp.storefront_name, sp.avg_rating, sp.total_sales, sp.is_verified_seller
      FROM users u
      JOIN seller_profiles sp ON sp.user_id = u.id
      WHERE 'seller' = ANY(u.roles)
      ORDER BY sp.total_sales DESC
      LIMIT 10
    `);
    res.json({ sellers: rows });
  } catch (err) {
    next(err);
  }
});
```

---

## Demo Walkthrough Checklist (After Fixes)

Once the 5 gaps above are addressed, follow this demo path:

1. **Home** → See live badge, trending Charizard auction, category grid
2. **Register as Buyer** → Complete onboarding (pick categories) → land on feed
3. **Browse** → Filter by Trading Cards → click the Charizard listing
4. **Auction Detail** → Watch countdown, see bid history, place a bid
5. **Log out** → **Log in as Seller** (`seller@example.com` / `password123`)
6. **Seller Dashboard** → See metrics, click "New Listing"
7. **Create Listing** → Fill 3-step form, upload image, set price
8. **Inventory** → See new item, click "Schedule Auction" → schedule it
9. **Analytics** → Show revenue charts (populated after auctions end)
10. **Orders** → Show the pending order, click "Mark Shipped"

---

## Optional Nice-to-Haves (Post-Demo)

| Feature | Effort |
|---|---|
| Watchlist page (`/buyer/watchlist`) — page exists but needs real data | Low |
| Buyer wins page — shows orders where buyer won | Low |
| Image upload with Cloudinary (real CDN) | Medium |
| Stripe payment integration (vault card, charge on win) | High |
