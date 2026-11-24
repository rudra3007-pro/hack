# MargFlow — Uttar Pradesh Bus Traffic Model & Journey Planner

A full-stack smart mobility platform that transforms live and historical bus GPS telemetry into a city-wide traffic intelligence dashboard, journey planner, seat-booking portal, and REST API playground focused on Uttar Pradesh (Lucknow Metro, UPSRTC Janrath, Shaheed Path, and intercity corridors).

## Key Features
- **Panoramic Traffic Intelligence Dashboard**: Real-time bus probe tracking, road congestion polylines, bottleneck hotspot detection, and live route highlighting on Google Maps.
- **Intelligent Journey Planner**: Computes multimodal bus journeys (walk, headway wait time, in-vehicle travel time, and transfer segments) with dwell-time filtering.
- **Live Bus GPS Tracking**: Track UPSRTC Janrath, Lucknow Electric (`EV-202`), Shaheed Path (`SHD-303`), and express buses with instant route corridor highlighting.
- **Bus Ticket Booking**: Interactive 2x2 bus seat map (40 seats), fare calculation, digital e-ticket pass with PNR/QR token, and Firestore booking management.
- **Historical Traffic Analytics**: 24-hour / 7-day / 30-day corridor speed degradation curves and peak-hour reliability comparisons.
- **REST API Playground**: Interactive tester for `/api/v1/travel-time`, `/api/v1/traffic-segments`, `/api/v1/buses/live`, `/api/v1/stops`, and `/api/v1/analytics/historical` with cURL, JavaScript, and Python snippets.
- **Dark Mode & Light Mode**: Persistent warm obsidian & terracotta theme synced with Google Maps `colorScheme`.

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and add your Google Maps API key:
   ```bash
   cp .env.example .env
   ```
   Set `VITE_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"` in `.env`.

3. **Start the full-stack server** (Express API + Vite middleware on port 3000):
   ```bash
   npm run dev
   ```

4. **Production build & start**:
   ```bash
   npm run build
   NODE_ENV=production npx tsx server.ts
   ```

## Firebase Configuration
- Update `firebase-applet-config.json` with your Firebase project settings if deploying to a new Firebase project.
- Deploy Firestore rules from `firestore.rules` and enable Google Sign-In (and optionally Email/Password) under **Firebase Console → Authentication → Sign-in method**.
- Add your deployment domain under **Authentication → Settings → Authorized domains**.
