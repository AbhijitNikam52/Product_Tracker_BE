# Product Tracker — Backend

Backend REST API server for the Product Price Tracker, built with Node.js, Express, MongoDB/Mongoose, and Playwright for web scraping.

## Setup & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Fill in your `MONGODB_URI`, `JWT_SECRET`, and optionally `GMAIL_USER`/`GMAIL_PASS` for email alerts.

3. **Start local server**:
   ```bash
   npm run dev
   ```
   Starts by default on [http://localhost:4000](http://localhost:4000).
