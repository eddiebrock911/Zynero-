const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from root .env or backend .env
const rootEnvPath = path.join(__dirname, '../.env');
const backendEnvPath = path.join(__dirname, '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(backendEnvPath)) {
  dotenv.config({ path: backendEnvPath });
} else {
  dotenv.config();
}

// Validate critical environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 5000;

if (NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is required in production mode.');
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Import routes
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');

// Import Product model for seeding
const Product = require('./models/Product');

const app = express();

// Connect Database
connectDB();

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS Configuration
const allowedOrigin = process.env.CLIENT_ORIGIN;
if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin, credentials: true }));
} else {
  app.use(cors());
}

// Request body parsing with size safety limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: NODE_ENV,
    dbMode: global.dbConnected ? 'MongoDB' : 'JSON Fallback'
  });
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Unknown API routes handler
app.all('/api/*', (req, res) => {
  res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Centralized Express Error Handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : (err.status || 500);
  
  if (NODE_ENV !== 'production') {
    console.error('Express Error Handler:', err);
  }

  res.status(statusCode).json({
    message: err.message || 'An unexpected internal server error occurred',
    ...(NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Helper to seed initial sample products if database is empty
const seedProducts = async () => {
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      const sampleProducts = [
        {
          name: "AuraPulse Wireless Headphones",
          price: 8999,
          images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60"],
          category: "Audio",
          stock: 12,
          description: "Premium noise-cancelling wireless headphones with deep bass, 40-hour battery life, and spatial audio support. Experience studio-quality sound anywhere.",
          rating: 4.8,
          numReviews: 5
        },
        {
          name: "Vortex Pro Gaming Mouse",
          price: 4500,
          images: ["https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60"],
          category: "Gaming",
          stock: 25,
          description: "Ultra-lightweight gaming mouse with a 26k DPI optical sensor, custom RGB lighting, and 6 programmable buttons for ultimate performance.",
          rating: 4.6,
          numReviews: 3
        },
        {
          name: "Chronos Glass Smartwatch",
          price: 12999,
          images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60"],
          category: "Wearables",
          stock: 8,
          description: "Elegant metal smartwatch with a curved AMOLED display, dynamic heart rate tracking, blood oxygen monitors, and an ultra-thin design with 7-day battery life.",
          rating: 4.5,
          numReviews: 2
        },
        {
          name: "Titan Mech Mechanical Keyboard",
          price: 6999,
          images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60"],
          category: "Gaming",
          stock: 15,
          description: "Hot-swappable mechanical keyboard featuring tactile brown switches, pre-lubed stabilizers, double-shot PBT keycaps, and custom RGB backlight.",
          rating: 4.7,
          numReviews: 8
        },
        {
          name: "AeroBook Pro 14",
          price: 64999,
          images: ["https://images.unsplash.com/photo-1496181130204-7552cc1524e2?w=500&auto=format&fit=crop&q=60"],
          category: "Computers",
          stock: 5,
          description: "Sleek aluminum laptop featuring an Octa-core processor, 16GB RAM, 512GB NVMe SSD, and a gorgeous 2.5K high-refresh rate IPS screen.",
          rating: 4.9,
          numReviews: 4
        },
        {
          name: "Zenith Charge 100W Powerbank",
          price: 3499,
          images: ["https://images.unsplash.com/photo-1609592424109-dd7739504a79?w=500&auto=format&fit=crop&q=60"],
          category: "Accessories",
          stock: 30,
          description: "High-capacity 20000mAh power bank supporting up to 100W Power Delivery. Easily charge your laptops, smartphones, and accessories simultaneously.",
          rating: 4.4,
          numReviews: 12
        }
      ];

      await Product.insertMany(sampleProducts);
      console.log('Sample products seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding products:', err.message);
  }
};

// Seed products on start
seedProducts();

const server = app.listen(PORT, () => {
  console.log(`Server running in ${NODE_ENV} mode on port ${PORT}`);
});

module.exports = { app, server };
