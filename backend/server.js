const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
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

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
