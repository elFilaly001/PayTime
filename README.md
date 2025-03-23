# 💳 PayTime - Money Management Platform

A modern web application for managing payments, tickets, and friend-based transactions with real-time updates.

## 📁 Project Structure

paytime/
├── 📱 paytime-front/ # React Frontend
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/ # Route-based components
│   │   ├── store/ # Redux state management
│   │   ├── hooks/ # Custom React hooks
│   │   └── services/ # API services
│   ├── public/ # Static assets
│   └── package.json # Frontend dependencies
├── ⚙️ paytime-back/ # NestJS Backend
│   ├── src/
│   │   ├── controllers/ # Route controllers
│   │   ├── services/ # Business logic
│   │   ├── helpers/ # Utility functions
│   │   └── models/ # Data models
│   └── package.json # Backend dependencies
└── docker-compose.yml # Container orchestration

## ✨ Features

- 🔐 User authentication with OTP support and key rotation
- 💰 Real-time payment processing
- 🤝 Friend management system with real-time notifications
- 🎫 Ticket creation and management with live updates
- 💳 Stripe payment integration
- 📱 Responsive design
- 🔄 Real-time updates via WebSocket for:
  - Friend requests and responses
  - Transaction status changes
  - Ticket updates and notifications
  - Payment confirmations

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.x
- npm or yarn
- Docker & Docker Compose (optional)
- MongoDB instance
- Stripe account

### Frontend Setup

```bash
# Navigate to frontend directory
cd paytime-front

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add required environment variables
VITE_API_URL=http://localhost:3000
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key

# Start development server
npm run dev
```

### Backend Setup

```bash
# Navigate to backend directory
cd paytime-back

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add required environment variables
DATABASE_URL=mongodb://localhost:27017/paytime
STRIPE_SECRET_KEY=your_stripe_secret
JWT_SECRET=your_jwt_secret

# Start development server
npm run start:dev
```

### Docker Setup (Optional)

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down
```

## 🛠 Tech Stack

### Frontend

- React 18
- Redux Toolkit + Redux Persist
- Stripe Elements
- TailwindCSS
- Socket.io Client
- Vite

### Backend

- NestJS
- MongoDB + Mongoose
- Stripe API
- JWT Authentication
- Socket.io
- Bull Queue

## 📚 Documentation

### API Routes

- `POST /auth/login` - User authentication
- `POST /auth/register` - New user registration
- `POST /auth/verify-otp` - OTP verification
- `GET /tickets` - Fetch user tickets
- `POST /tickets/create` - Create new ticket
- `POST /payment/process` - Process payment
- More endpoints documented in API docs

### Environment Variables

#### Frontend

| Variable                      | Description            |
|-------------------------------|------------------------|
| `VITE_API_URL`                | Backend API URL        |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe public key      |

#### Backend

| Variable            | Description              |
|---------------------|--------------------------|
| `DATABASE_URL`      | MongoDB connection string|
| `STRIPE_SECRET_KEY` | Stripe secret key        |
| `JWT_SECRET`        | JWT signing secret       |

## 🔒 Security

- OTP verification for sensitive operations
- JWT-based authentication with automatic key rotation
- Secure WebSocket connections with token validation
- Regular session key rotation
- Encrypted WebSocket messages
- Secure payment processing via Stripe
- Rate limiting on API endpoints
- Input validation and sanitization
- Real-time session management and invalidation

## 🔌 WebSocket Events

### Client Events
- `friend:request` - Send friend request
- `friend:accept` - Accept friend request
- `friend:decline` - Decline friend request
- `ticket:update` - Real-time ticket status changes
- `transaction:status` - Live transaction updates

### Server Events
- `friend:request:received` - New friend request notification
- `friend:request:accepted` - Friend request accepted notification
- `friend:request:declined` - Friend request declined notification
- `ticket:status:changed` - Ticket status updates
- `transaction:confirmed` - Transaction confirmation
- `session:expired` - Session expiration notification


