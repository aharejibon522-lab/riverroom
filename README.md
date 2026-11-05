# RiverRoom

RiverRoom is a real-time Texas Hold'em **virtual-chip** multiplayer MVP built with Node.js, Express and Socket.IO.

## Included
- Public tables and password-protected private tables
- Up to 8 players per table
- Server-controlled dealing, turns, betting and showdown
- Virtual starting stack of 1,000 chips
- Responsive browser interface

## Important MVP limitations
- This first deployable version uses in-memory rooms. Rooms and chip balances reset when the server restarts or redeploys.
- Guest nicknames only: no permanent accounts or password recovery yet.
- This is a learning/MVP build, not a security-audited production gambling platform. It has no real-money features.
- Before inviting the public, add persistent storage, account authentication, rate limiting, anti-collusion controls and extensive poker-rule testing.

## Run locally
1. Install Node.js 20 or newer.
2. In this folder run `npm install`
3. Run `npm start`
4. Open http://localhost:3000 in a browser. Open a second browser/device to test multiplayer.

## Deploy to Render
1. Upload this folder's contents to a GitHub repository (not the ZIP file itself).
2. In Render, choose **New + → Web Service**, connect the GitHub repository.
3. Runtime: Node. Build command: `npm install`. Start command: `npm start`.
4. Choose the free instance if offered. Render will provide a URL such as `your-service-name.onrender.com`.
5. Free instances may sleep when idle; the first visit after sleep can take a little time.

Do not publish secrets in GitHub. This project does not require environment secrets for the initial MVP.
