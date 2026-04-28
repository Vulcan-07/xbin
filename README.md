# 0xD3ad — Premium Ephemeral Relay Protocol

![0xD3ad Logo](https://img.shields.io/badge/Security-Level_MAX-green?style=for-the-badge&logo=target)
![License](https://img.shields.io/badge/Status-Operational-blue?style=for-the-badge)

0xD3ad is a high-end, cinematic, and ephemeral real-time collaboration platform designed for the underground aesthetic. It functions as a secure "Tunnel" for code sharing, file relaying, and encrypted communication with a strict zero-footprint policy.

---

## 🛠 Technology Stack

### Frontend
- **Framework**: [React](https://reactjs.org/) (via Vite)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with a custom Cyber-Neon design system.
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for cinematic transitions and parallax effects.
- **Editor**: [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) (VS Code's engine).
- **Icons**: [Lucide React](https://lucide.dev/).
- **Real-time**: [Socket.io-client](https://socket.io/).

### Backend
- **Runtime**: [Node.js](https://nodejs.org/).
- **Server**: [Express](https://expressjs.com/).
- **WebSockets**: [Socket.io](https://socket.io/) for bidirectional low-latency sync.
- **File Handling**: [Multer](https://github.com/expressjs/multer) for secure payload uploads.
- **Logic**: TypeScript for type-safe state management.

---

## 🚀 Key Features

### 1. Secure Tunnels
- **Auto-Generation**: Each tunnel gets a unique 8-character ID.
- **Access Control**: Optional password protection for private nodes.
- **Ephemeral Storage**: All data (code, files, chats) is purged from the server after **24 hours**.

### 2. Live Collaboration
- **Real-time Editor**: Multiple users can edit code simultaneously with syntax highlighting for 10+ languages.
- **Terminal Chat**: A high-contrast, terminal-style chat room for coordinated operations.
- **User Presence**: Live tracking of active nodes in the tunnel.

### 3. Payload Relay
- **File Sharing**: Upload files (up to 10MB) directly into the tunnel.
- **Secure Deletion**: Creators can "Burn" the tunnel, instantly deleting all files and terminating all active connections.

### 4. Cinematic UI/UX
- **System Telemetry**: Dynamic IP and Location tracking on the landing page.
- **Parallax Background**: Interactive digital mesh that responds to mouse movement.
- **Glassmorphism**: Premium frosted-glass effects with neon accents.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js (v18+)
- npm / yarn

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd PasteBin
   ```

2. **Backend Setup**:
   ```bash
   cd server
   npm install
   # Create a .env file
   echo "PORT=3001\nCLIENT_URL=http://localhost:5173" > .env
   npm run dev
   ```

3. **Frontend Setup**:
   ```bash
   cd ../client
   npm install
   # Create a .env.local file
   echo "VITE_SERVER_URL=http://localhost:3001" > .env.local
   npm run dev
   ```

---

## 🌐 Deployment Guide

### Frontend (Vercel)
1. Push your code to GitHub.
2. Import the `client` directory to Vercel.
3. Add Environment Variable: `VITE_SERVER_URL` (pointing to your Render URL).

### Backend (Render)
1. Create a "Web Service" pointing to the `server` directory.
2. **Build Command**: `npm install && npm run build`
3. **Start Command**: `npm start`
4. **Environment Variables**:
   - `PORT`: 10000 (standard for Render)
   - `CLIENT_URL`: `https://0xd3ad.qzz.io` (your custom domain)

### DNS (Cloudflare)
1. Add a **CNAME** record for your root/subdomain pointing to Vercel/Render.
2. Ensure SSL is set to **Full (Strict)**.

---

## 💾 Data Management & Storage

0xD3ad is designed with a **privacy-first, ephemeral** storage model. It does not use a traditional database (like PostgreSQL or MongoDB) to ensure that no permanent logs remain.

### 1. In-Memory State (RAM)
Real-time data is stored in the server's RAM using a high-performance JavaScript `Map`. This includes:
- **Tunnel Metadata**: Password hashes, creator IDs, and creation timestamps.
- **Code Content**: The current state of the editor.
- **Chat History**: Recent messages exchanged within the node.
- **Active Users**: A list of currently connected socket IDs and display names.

*Note: Since this is in-memory, a server restart will securely wipe all active sessions.*

### 2. Local Filesystem (Payloads)
Uploaded files are stored physically on the server's disk to handle larger payloads without consuming RAM:
- **Location**: `server/uploads/{TunnelId}/`
- **Organization**: Each tunnel has its own isolated directory.
- **Access**: Files are served via a secure static route (`/uploads/*`).

### 3. Automated Purge Protocol (TTL)
To maintain the zero-footprint policy, the server runs a background cleanup process:
- **Interval**: Every 60 minutes.
- **Threshold**: Any Tunnel older than **24 hours** is flagged.
- **Action**: The server deletes the Tunnel from memory and recursively removes its `uploads` directory from the disk.

### 4. The "Burn" Protocol (Manual Purge)
The creator of a tunnel has the power to "Burn" the session at any time:
- **Instant Deletion**: All files are deleted from the disk using `fs.rmSync`.
- **Memory Wipe**: The Tunnel is removed from the server state.
- **Connection Severance**: All connected clients are forcefully disconnected and redirected to the landing page.

---

## 🛡 Security & CORS

The backend uses a strict CORS policy. If you see "Not allowed by CORS", ensure the `CLIENT_URL` environment variable on Render matches your frontend origin exactly (no trailing slash).

```typescript
// server/src/index.ts
const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(o => o.trim())
    : ['*'];
```

---

## 📝 Architecture Notes

- **State Management**: The server maintains an in-memory `Map` of active Tunnels. This ensures maximum speed but means a server restart clears current sessions (consistent with the ephemeral nature).
- **Cleanup**: A `setInterval` runs every hour to check for Tunnels older than 24 hours and Purge their associated file directories.
- **Purge/Burn**: Terminating a tunnel uses `fs.rmSync` to physically delete all uploaded assets from the disk.

---

**0xD3ad Protocol** — *Building privacy in a world of illusions.*
