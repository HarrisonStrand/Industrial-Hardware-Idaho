<div align="center">
  
  <img src="https://via.placeholder.com/160x160.png?text=LOGO" alt="Industrial Hardware Idaho Logo" width="160" />
  
  # 🏗️ Industrial Hardware Idaho  
  ### Fullstack E-Commerce Platform  
  Developed by **Strand Creations LLC** for **Wollam Ventures LLC**

  ---
  ![React](https://img.shields.io/badge/Frontend-React-blue?logo=react)
  ![Node.js](https://img.shields.io/badge/Backend-Node.js-green?logo=node.js)
  ![MongoDB](https://img.shields.io/badge/Database-MongoDB-darkgreen?logo=mongodb)
  ![License](https://img.shields.io/badge/License-Proprietary-orange)
  ![Docker](https://img.shields.io/badge/Containerized-Docker-blue?logo=docker)
  ---

  <p align="center">
    A custom-built fullstack application powering Industrial Hardware Idaho’s online inventory, sales, and account management system.
  </p>

</div>

---

## 🚀 Tech Stack

**Frontend:** React + Vite, React Router, Axios  
**Backend:** Node.js, Express.js, JWT Authentication  
**Database:** MongoDB (Mongoose ORM)  
**Deployment:** Docker + Docker Compose  
**Integration:** Fishbowl Inventory Sync (stubbed for future API/CSV import)

---

## 🧩 Core Features

- 🛒 **E-Commerce Functionality**
  - Product catalog with categories and real-time stock
  - Cart and checkout workflow with order creation
  - Order history and fulfillment tracking

- 🔐 **Authentication**
  - JWT-based login, registration, and role-based access (Customer, Staff, Admin)

- 🧰 **Admin Dashboard**
  - Product CRUD (Create, Read, Update, Delete)
  - Manage user orders and statuses

- 🔄 **Fishbowl Integration Stub**
  - Placeholder service to sync inventory from external system

- 🐳 **Dockerized Infrastructure**
  - Ready for local or cloud deployment (MongoDB, API, Client)

---

<details>
<summary><b>🛠️ Local Development Setup</b></summary>

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/industrial-hardware-idaho-fullstack.git
cd industrial-hardware-idaho-fullstack
````

### 2️⃣ Install Dependencies

```bash
npm run install-all
```

### 3️⃣ Configure Environment Variables

Create `.env` in `/server` (based on `.env.example`):

```bash
MONGO_URI=mongodb://127.0.0.1:27017/hardware
JWT_SECRET=super-long-random-string
PORT=5000
```

Optional: set `VITE_API_URL` in `/client/.env` if API runs on a different host.

### 4️⃣ Run Development Servers

```bash
npm run dev
```

| Service  | Port | Description           |
| -------- | ---- | --------------------- |
| Frontend | 3000 | React + Vite app      |
| Backend  | 5000 | Express + MongoDB API |

</details>

---

<details>
<summary><b>🐳 Docker Deployment</b></summary>

### 1️⃣ Build & Run with Docker

```bash
export JWT_SECRET='your-production-secret'
docker-compose up --build
```

### 2️⃣ Access Services

| Service  | Port  | Description             |
| -------- | ----- | ----------------------- |
| Frontend | 3000  | Nginx serving React app |
| Backend  | 5000  | Express API             |
| MongoDB  | 27017 | Database                |

### 3️⃣ Stop Containers

```bash
docker-compose down
```

</details>

---

## 📦 API Overview

| Route                    | Method | Description          | Auth   |
| ------------------------ | ------ | -------------------- | ------ |
| `/api/auth/register`     | POST   | Register new user    | Public |
| `/api/auth/login`        | POST   | Log in existing user | Public |
| `/api/products`          | GET    | List all products    | Public |
| `/api/products/:id`      | GET    | Get product details  | Public |
| `/api/products`          | POST   | Add product          | Admin  |
| `/api/orders`            | POST   | Create order         | Auth   |
| `/api/orders/mine`       | GET    | Get user orders      | Auth   |
| `/api/orders/:id/status` | PUT    | Update order status  | Admin  |

---

## 🧾 License & Ownership

© 2025 **Strand Creations LLC**
All rights reserved.
Developed exclusively for **Wollam Ventures LLC** (*Industrial Hardware Idaho*).
Unauthorized reproduction, redistribution, or modification is prohibited.

---

<div align="center">
  <sub>Crafted with ❤️ by Strand Creations LLC</sub><br/>
  <a href="mailto:strandcreations@gmail.com">strandcreations@gmail.com</a> · 
  [strandcreations.com](https://strandcreations.com)
</div>