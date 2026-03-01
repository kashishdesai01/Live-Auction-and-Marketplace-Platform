require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const http = require('http');

const { initSocket } = require('./sockets');
const { errorHandler } = require('./middleware/error');

// Routes
const authRoutes = require('./routes/auth');
const browseRoutes = require('./routes/browse');
const auctionRoutes = require('./routes/auctions');
const buyerRoutes = require('./routes/buyer');
const sellerRoutes = require('./routes/seller');
const sellerStorefrontRoutes = require('./routes/sellerStorefront');
const uploadRoutes = require('./routes/upload');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

const stripeWebhook = require('./routes/stripeWebhook');

// Core middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));

// Stripe requires the raw body to construct the event signature
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve local uploads in dev
if (process.env.UPLOAD_PROVIDER === 'local') {
  app.use('/uploads', express.static('uploads'));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const categoryRoutes = require('./routes/categories');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/browse', browseRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/buyer', buyerRoutes);
app.use('/api/seller', sellerRoutes);
app.use('/api/sellers', sellerStorefrontRoutes);
app.use('/api/upload', uploadRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Start cron jobs
require('./jobs/auctionJobs');

module.exports = { app, server };
