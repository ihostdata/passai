# PassAI — Complete Deployment Guide 🚀

## Stack Overview
```
Frontend  → Vercel (React/Next.js)
Backend   → Railway (Node.js Express)
Database  → Supabase (Postgres + Auth + RLS)
Cache     → Upstash Redis
Payments  → Stripe
AI        → Anthropic Claude (claude-sonnet-4-20250514)
```

---

## Step 1 — Supabase Setup (Database + Auth)

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `passai` → Choose region closest to Nigeria (eu-west or us-east)
3. In the SQL Editor, run `schema.sql` (this file is in your project)
4. Go to **Authentication → Settings**:
   - Enable Email/Password sign-ins ✅
   - Set Site URL to your frontend URL
5. Get your keys from **Project Settings → API**:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_KEY` = `service_role` key (keep secret!)

---

## Step 2 — Stripe Setup (Payments)

1. Create account at [stripe.com](https://stripe.com)
2. In **Products**, create two products:
   - **PassAI Basic** → ₦4,000/month recurring
   - **PassAI Pro** → ₦8,000/month recurring
3. Copy each Price ID → set as `STRIPE_PRICE_BASIC` and `STRIPE_PRICE_PRO`
4. Go to **Developers → Webhooks** → Add endpoint:
   - URL: `https://your-railway-app.railway.app/webhook/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
5. Copy Webhook Signing Secret → set as `STRIPE_WEBHOOK_SECRET`

> **Note on Nigerian payments:** Stripe supports Naira (NGN). Enable in Dashboard → Settings → Currencies. For local Nigerian payments (Paystack/Flutterwave), you can add them as an alternative alongside Stripe.

---

## Step 3 — Upstash Redis (Rate Limiting + Cache)

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a Redis database → Choose closest region
3. Copy the **ioredis connection string** → set as `UPSTASH_REDIS_URL`

---

## Step 4 — Railway Deployment (Backend)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Connect your `passai-backend` repository
3. In **Settings → Variables**, add all env vars from `.env.example`
4. Railway auto-deploys on every `git push`

Your API will be live at: `https://passai-backend-production.up.railway.app`

**railway.toml** (add to project root):
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/health"
healthcheckTimeout = 100
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

---

## Step 5 — Frontend (Connect to Backend)

Add to your React app's `.env`:
```
VITE_API_URL=https://passai-backend-production.up.railway.app
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # anon key (safe for frontend)
```

Update API calls in PassAI.jsx to use `VITE_API_URL` instead of calling Anthropic directly.

---

## API Reference

### Auth
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| POST | `/auth/register` | `{email, password, full_name, target_exam}` | Register user |
| POST | `/auth/login` | `{email, password}` | Login |
| GET | `/auth/me` | — | Get profile + stats |

### AI Features
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| POST | `/ai/chat` | `{messages: [{role, content}]}` | AI tutor (streaming SSE) |
| POST | `/ai/pdf-upload` | FormData `pdf` file | Upload & parse PDF |
| POST | `/ai/pdf-ask` | `{sessionId, question}` | Ask about PDF |
| POST | `/ai/generate-test` | `{subject, exam, count, difficulty}` | Generate practice test |
| POST | `/ai/submit-test` | `{testId, answers, score, subject, exam}` | Save test results |
| POST | `/ai/generate-schedule` | `{examDate, exam, hoursPerDay, weakSubjects}` | AI study schedule |

### Past Questions
| Method | Route | Query | Description |
|--------|-------|-------|-------------|
| GET | `/questions` | `?exam=JAMB&subject=Math&year=2023` | Fetch questions |
| POST | `/questions/:id/explain` | — | Get AI explanation |
| POST | `/questions/:id/attempt` | `{selected_index, is_correct}` | Record answer |

### Progress
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/progress` | Full progress dashboard data |
| GET | `/progress/weekly` | Last 7 days activity |

### Payments
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| POST | `/payments/checkout` | `{plan: "basic"\|"pro"}` | Create Stripe checkout |
| POST | `/payments/portal` | — | Open billing portal |
| GET | `/payments/subscription` | — | Check subscription status |

---

## Rate Limits

| Plan | Questions/day | AI requests/min |
|------|--------------|-----------------|
| Free | 10 | 20 |
| Basic | Unlimited | 20 |
| Pro | Unlimited | 20 |

---

## Adding More Past Questions

Use the Supabase Dashboard → Table Editor → `past_questions`, or run:
```sql
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty)
VALUES ('JAMB', 2024, 'Mathematics', 'Algebra', 'Your question here...', '["A","B","C","D"]', 0, 'Explanation', 'medium');
```

Or build a bulk import script using the Supabase JS client.

---

## Scaling Checklist

- [ ] Add Supabase connection pooling (PgBouncer) for high traffic
- [ ] Enable Supabase Realtime for live leaderboards
- [ ] Add Paystack as payment alternative for users without international cards
- [ ] Set up Supabase pg_cron to delete old PDF sessions daily
- [ ] Add email notifications (Resend.com) for payment events
- [ ] Integrate with WhatsApp Business API for Nigerian market reach
- [ ] Add Ghana support (WASSCE/BECE subjects + past questions)

---

## Cost Estimate (Monthly, 1000 active users)

| Service | Cost |
|---------|------|
| Railway (backend) | ~$5 |
| Supabase (Pro) | $25 |
| Upstash Redis | $10 |
| Anthropic API (~500k tokens/day) | ~$15 |
| Stripe fees (2.9% + $0.30/transaction) | Variable |
| **Total** | **~$55/month** |

Break-even: ~11 Basic subscribers or ~6 Pro subscribers.
