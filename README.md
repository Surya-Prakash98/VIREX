# VIREX Marketplace

This is a vanilla HTML/CSS/JS frontend with a Node.js + Express backend. 

## Where Mandatory Items Live
- **Routing**: Backend API routes are defined directly in `index.js`. Page routes are handled by serving the `public` directory.
- **Validation**: Backend validation is present in the `index.js` route handlers. Frontend validation must be placed inside the `public/*.js` files.
- **HTML/CSS**: All static assets and pages are located in the `public/` directory.
- **localStorage**: The frontend JavaScript (like `auth.js` and `home.js`) uses `localStorage` for quick navbar updates and caching form drafts.
- **Nodemailer**: The configuration and the `sendMail` helper function are defined in `index.js` under the `MAIL` block.
- **MongoDB**: The connection to MongoDB is initiated at the end of `index.js` using Mongoose, and the models are defined in the `DATABASE MODELS` section.

## Application Flow
1. **Page**: User visits an HTML page (e.g., `index.html`).
2. **Fetch**: Frontend JavaScript calls the backend API using `fetch()`.
3. **Route**: `index.js` receives the request at the corresponding route.
4. **Validation**: The backend re-validates the input for correctness, returning appropriate HTTP status codes on failure.
5. **MongoDB**: Validated data is queried, saved, or updated in the MongoDB database via Mongoose models.
6. **Nodemailer**: If a booking is requested or status changes, an email is fired off asynchronously.
7. **Response**: A JSON response is returned to the frontend to update the UI.
