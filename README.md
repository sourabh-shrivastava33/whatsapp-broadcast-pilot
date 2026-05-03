# WhatsApp Broadcast CRM

A premium, production-grade WhatsApp Broadcast system built with React, Node.js, and BullMQ. This platform allows businesses to manage templates, contacts, and execute mass messaging campaigns across multiple WhatsApp Business Accounts (WABA) with intelligent load balancing and real-time monitoring.

## 🚀 Key Features

- **Broadcast Wizard**: Multi-step flow for creating campaigns with template selection, variable mapping, and recipient filtering.
- **Dynamic Partitioning**: Automatically distributes messages across available WABA accounts based on their messaging tier limits (load balancing).
- **Identity Pinning**: Ensures contacts receive messages from the same account they've interacted with previously.
- **Real-time Monitoring**: Live dashboard showing delivery rates, read rates, and success metrics via Socket.io.
- **Robust Template Engine**: High-fidelity template preview and support for media headers (Images/Videos).
- **Safety Mechanisms**: Automatic pausing on high failure rates and built-in rate limiting (80 msg/s).

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Lucide Icons, Vanilla CSS (Premium Aesthetics).
- **Backend**: Node.js, Express, Socket.io.
- **Database**: PostgreSQL (via Prisma ORM).
- **Queue System**: BullMQ with Redis for reliable message dispatching.
- **Integration**: Meta WhatsApp Business Cloud API.

## 📦 Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL
- Redis
- Meta Developer Account (with WhatsApp Business enabled)

### Backend Setup
1. Navigate to the `server` directory.
2. Install dependencies: `npm install`
3. Configure environment variables in `.env` (use `.env.example` as a template).
4. Run migrations: `npx prisma migrate dev`
5. Start the server: `npm run dev`
6. Start the worker: `node worker.js` (automatically started by `npm run dev` in development).

### Frontend Setup
1. Navigate to the root directory.
2. Install dependencies: `npm install`
3. Configure frontend environment variables in `.env`.
4. Start the development server: `npm run dev`

## 🔒 Security & Performance
- **Rate Limiting**: Integrated `express-rate-limit` for API protection.
- **Security Headers**: `helmet` configured for production safety.
- **Retry Logic**: Exponential backoff for failed messages (429/5xx errors).
- **Clean Architecture**: Decoupled dispatch engine from API routing.

## 📄 License
MIT
