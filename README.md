This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

# 🧠 Workflow Orchestrator 🚀

A **human-in-the-loop workflow management system** built with **Next.js**, **Prisma**, and **PostgreSQL**.  
It enables **automated workflows** that can pause for **human approvals** and resume automatically once approved — through **email**, **Slack**, or a **web dashboard**.

---

## 🌟 Features

✅ **Human-in-the-Loop Workflows**  
Seamlessly integrate human approvals into automated or AI-driven processes.

✅ **Multi-Channel Approvals**  
Supports Email, Slack, and Web dashboard for approval actions.

✅ **State Management**  
Tracks workflow state transitions and ensures recovery from failures.

✅ **Event Sourcing**  
Complete audit trail of all workflow activities for observability.

✅ **Dynamic Workflow Definitions**  
Define and modify workflows in the database without redeployment.

✅ **Retry & Resilience**  
Automatic retry and rollback using compensation logic.

✅ **Real-Time Dashboard**  
Monitor workflow progress, human responses, and event timelines.

---

## 🏗️ Architecture Decisions

### 1. **Database-Driven Workflow Definitions**
**Choice:** Store workflow definitions in **PostgreSQL (via Prisma)**  
**Why:**
- Dynamic workflow creation and modification without code changes  
- Version control and runtime management  
- Separation of business logic from code  
- Easier A/B testing and workflow iteration  

---

### 2. **Event-Driven State Management**
**Choice:** Use event sourcing and state transition logs  
**Why:**
- Complete audit trail and compliance visibility  
- Easier debugging and replaying of workflows  
- Robust to failures, retries, and asynchronous actions  

---

### 3. **Asynchronous Human Approvals**
**Choice:** Non-blocking approval handling (via Queue + Worker)  
**Why:**
- System doesn’t block waiting for human input  
- Supports long-running workflows (hours/days)  
- Multiple channels (Slack, Email) for approvals  
- Automatic continuation or rollback once approved/rejected  

---

### 4. **Multi-Tenant & Extensible Schema**
**Choice:** Modular schema supporting multiple teams and channels  
**Why:**
- Multi-tenant by design  
- Extensible to new communication platforms (Teams, WhatsApp, etc.)  
- Dynamic approval forms and input fields  

---

## 🧩 System Architecture

```text
Client/UI  →  Next.js API Routes  →  Queue (BullMQ)
                              ↘        ↙
                         Worker (Redis)
                              ↓
                         Postgres (Neon)

2️⃣ Install dependencies
npm install

3️⃣ Set up your environment file

Create a .env file in the project root and add:

DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<db>"
REDIS_URL="redis://<user>:<password>@<host>:6379"
RESEND_API_KEY="your-resend-api-key"
JWT_SECRET="super-secret-key"
NODE_ENV=development


You can use:

Neon (for free Postgres)

Upstash Redis (for hosted Redis)

Resend (for email approvals)

4️⃣ Initialize the Database

Make sure your database connection works:

npx prisma db push   # Sync schema
npx prisma generate  # Generate Prisma client


(Optional) Seed some dummy data:

npx prisma db seed


Check DB tables:

npx prisma studio

5️⃣ Run Redis locally (if not using hosted)

Using Docker:

docker run -d -p 6379:6379 redis

6️⃣ Start Development Server
npm run dev


This will start your Next.js app on:
👉 http://localhost:3000

7️⃣ Start the Worker

In a new terminal:

npm run worker


The worker listens to BullMQ jobs from Redis and executes workflow logic.

8️⃣ Test API Endpoints
Create a workflow
curl -X POST http://localhost:3000/api/workflows \
-H "Content-Type: application/json" \
-d '{"steps":[{"kind":"HUMAN","type":"approval"}]}'