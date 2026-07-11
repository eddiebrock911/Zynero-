# 🛒 Zynero

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Razorpay](https://img.shields.io/badge/Payments-Razorpay-0C2451?style=flat)

**Premium Technology & Setup Store** — a full-stack e-commerce app for gadgets and PC gear: browse products, add to cart, check out with Razorpay, and manage it all from an admin dashboard.

## About

Zynero pairs a Node.js/Express/MongoDB REST API with a hand-written HTML/CSS/JS storefront. One server hosts both the API and the frontend, so there's nothing extra to wire up — and it even runs without MongoDB installed, falling back to a local JSON file database automatically.

## ✨ Features

**Storefront**
- Product catalog with categories, stock, ratings & customer reviews
- Product detail pages, cart, and a Razorpay-powered checkout
- Signup/login with JWT-based sessions
- Order history for logged-in customers

**Admin**
- Dashboard to create, edit, and delete products
- Order management with status updates
- Role-gated (`isAdmin`) routes, separate from regular customers

**Backend niceties**
- Auto-seeds 6 sample products on first run, so the store isn't empty out of the box
- Falls back to a JSON file database (`backend/data/db.json`) if MongoDB isn't running — nothing to install to try it locally
- Password hashing with bcrypt, JWT auth, CORS-enabled REST API

## 🛠️ Tech Stack

| | |
|---|---|
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose), with an automatic JSON-file fallback |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Payments | Razorpay |
| Frontend | Vanilla HTML, CSS, JavaScript |

## 📁 Project Structure

```
Zynero-/
├── backend/
│   ├── config/           # DB connection + JSON-file fallback
│   ├── controllers/       # Route handlers — users, products, orders, cart
│   ├── data/                # db.json, used only in fallback mode
│   ├── middleware/           # JWT auth ("protect") & admin guard
│   ├── models/                 # Mongoose schemas: User, Product, Order, Cart
│   ├── routes/                   # Express routers
│   ├── server.js                   # App entry point
│   └── package.json
├── frontend/
│   ├── index.html, products.html, product-detail.html
│   ├── cart.html, checkout.html, auth.html
│   ├── dashboard.html, admin.html
│   ├── css/style.css
│   └── js/                            # One script per page, plus api.js & common.js
└── .env
```

## 🔌 API Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/users` | Register a new user | – |
| POST | `/api/users/login` | Log in | – |
| GET / PUT | `/api/users/profile` | Get / update your profile | User |
| GET | `/api/products` | List products | – |
| GET | `/api/products/:id` | Product detail | – |
| POST | `/api/products` | Create a product | Admin |
| PUT / DELETE | `/api/products/:id` | Update / delete a product | Admin |
| POST | `/api/products/:id/reviews` | Add a review | User |
| GET / POST / DELETE | `/api/cart` | Get, sync, or clear your cart | User |
| POST | `/api/orders` | Place an order | User |
| POST | `/api/orders/verify` | Verify a Razorpay payment | User |
| GET | `/api/orders/myorders` | Your order history | User |
| GET | `/api/orders/:id` | Order detail | User |
| GET | `/api/orders` | All orders | Admin |
| PUT | `/api/orders/:id/status` | Update order status | Admin |

## 🚀 Getting Started

```bash
git clone https://github.com/eddiebrock911/Zynero-.git
cd Zynero-/backend
npm install
npm run dev
```

Then open **http://localhost:5000** — the same server hosts both the storefront and the API. MongoDB is optional; without it, Zynero automatically stores data in `backend/data/db.json` instead.

## 🔑 Environment Variables

Create a `.env` file in the project root (one level above `backend/`):

| Variable | Purpose |
|---|---|
| `PORT` | Port the server listens on (defaults to `5000`) |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | MongoDB connection string — optional, omit to use the JSON fallback |
| `JWT_SECRET` | Secret used to sign login tokens |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | From your [Razorpay dashboard](https://dashboard.razorpay.com/) |

> ⚠️ **Before this goes any further, a heads-up:** a `.env` file (and a `backend/data/db.json` with one real registered account in it) are currently committed to this repo, which is public. Treat every value in that `.env` as burned — rotate `JWT_SECRET` and the Razorpay keys, then:
> ```bash
> git rm --cached .env backend/data/db.json
> ```
> and add both to `.gitignore`. Commit a `.env.example` (same variable names, no real values) in its place for documentation. It's also worth removing the hardcoded fallback secret in `backend/middleware/auth.js` (`process.env.JWT_SECRET || '...'`) so the app fails loudly instead of silently signing tokens with a well-known default if the env var is ever missing.

## 📄 License

No license specified yet — add one (MIT is a common default) if you plan to let others use or contribute to this.

---

<p align="center">Built with 🛒 — Zynero</p>
