import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import Redis from "ioredis";
import multer from "multer";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";

dotenv.config();

// ─── CLIENTS ─────────────────────────────────────────────────────────────────
const app = express();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const redis = new Redis(process.env.UPSTASH_REDIS_URL);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));

// Raw body for Stripe webhooks (must come before express.json)
app.use("/webhook/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));

// Global rate limiter
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

// AI-specific rate limiter (tighter)
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: "Too many AI requests. Please slow down." } });

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });

  // Fetch user profile with plan info
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  req.user = { ...user, profile };
  next();
}

// ─── QUOTA MIDDLEWARE ─────────────────────────────────────────────────────────
async function checkQuota(req, res, next) {
  const userId = req.user.id;
  const plan = req.user.profile?.plan || "free";

  if (plan !== "free") return next(); // paid plans have unlimited

  const today = new Date().toISOString().split("T")[0];
  const key = `quota:${userId}:${today}`;
  const count = await redis.incr(key);

  if (count === 1) await redis.expire(key, 86400); // expire at end of day

  if (count > 10) {
    return res.status(429).json({
      error: "Daily limit reached",
      message: "Free plan allows 10 questions/day. Upgrade to continue.",
      upgradeUrl: "/pricing",
      used: count,
      limit: 10,
    });
  }

  req.quotaUsed = count;
  next();
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// ═════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// Register
app.post("/auth/register", async (req, res) => {
  const { email, password, full_name, target_exam } = req.body;
  if (!email || !password || !full_name) return res.status(400).json({ error: "Missing required fields" });

  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, target_exam } } });
  if (error) return res.status(400).json({ error: error.message });

  // Create profile row
  await supabase.from("profiles").insert({
    id: data.user.id,
    full_name,
    target_exam: target_exam || "JAMB",
    plan: "free",
    created_at: new Date().toISOString(),
  });

  res.json({ user: data.user, session: data.session });
});

// Login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ user: data.user, session: data.session, profile: data.user });
});

// Get current user profile
app.get("/auth/me", requireAuth, async (req, res) => {
  const { data: stats } = await supabase
    .from("user_stats").select("*").eq("user_id", req.user.id).single();
  res.json({ ...req.user.profile, stats });
});

// ═════════════════════════════════════════════════════════════════════════════
// AI TUTOR ROUTES
// ═════════════════════════════════════════════════════════════════════════════

app.post("/ai/chat", requireAuth, checkQuota, aiLimiter, async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "Messages required" });

  // Log usage
  await supabase.from("ai_usage").insert({
    user_id: req.user.id,
    type: "chat",
    created_at: new Date().toISOString(),
  });

  // Stream response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: `You are PassAI — Nigeria's expert AI study tutor for JAMB, WAEC, NECO, and GCE exams.

You specialize in: Mathematics, English Language, Physics, Chemistry, Biology, Economics, Government, Literature, Geography, CRS/IRS.

Always:
- Use Nigerian curriculum (NERDC) standards
- Reference JAMB/WAEC syllabus topics
- Give step-by-step workings for science/math
- Use Nigerian examples where relevant (naira, Lagos, Nigerian history, etc.)
- Be encouraging and use friendly Nigerian English
- Format answers clearly with numbered steps
- End with a memory tip or "exam trick" when applicable
- Keep explanations concise but thorough`,
    messages: messages.slice(-20), // limit context window
  });

  stream.on("text", (text) => res.write(`data: ${JSON.stringify({ text })}\n\n`));
  stream.on("finalMessage", () => { res.write("data: [DONE]\n\n"); res.end(); });
  stream.on("error", (err) => { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); });
});

// ─── PDF UPLOAD & PARSE ───────────────────────────────────────────────────────
app.post("/ai/pdf-upload", requireAuth, upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF uploaded" });

  const plan = req.user.profile?.plan || "free";
  if (plan === "free") return res.status(403).json({ error: "PDF upload requires Basic or Pro plan", upgradeUrl: "/pricing" });

  try {
    const { text } = await pdfParse(req.file.buffer);
    const truncated = text.slice(0, 50000); // ~50k chars max

    // Store in Supabase for session
    const { data } = await supabase.from("pdf_sessions").insert({
      user_id: req.user.id,
      filename: req.file.originalname,
      content: truncated,
      created_at: new Date().toISOString(),
    }).select().single();

    res.json({ sessionId: data.id, pages: Math.ceil(text.length / 3000), filename: req.file.originalname });
  } catch (e) {
    res.status(500).json({ error: "Failed to parse PDF" });
  }
});

// Ask questions about uploaded PDF
app.post("/ai/pdf-ask", requireAuth, checkQuota, aiLimiter, async (req, res) => {
  const { sessionId, question } = req.body;

  const { data: session } = await supabase.from("pdf_sessions").select("*").eq("id", sessionId).eq("user_id", req.user.id).single();
  if (!session) return res.status(404).json({ error: "PDF session not found" });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: `You are a study assistant. Answer questions based ONLY on the provided textbook content. If the answer isn't in the content, say so. Format answers clearly for Nigerian exam students.`,
    messages: [
      { role: "user", content: `TEXTBOOK CONTENT:\n${session.content}\n\nSTUDENT QUESTION: ${question}` }
    ],
  });

  res.json({ answer: response.content[0].text });
});

// ─── PRACTICE TEST GENERATOR ─────────────────────────────────────────────────
app.post("/ai/generate-test", requireAuth, checkQuota, aiLimiter, async (req, res) => {
  const { subject, exam, count = 10, difficulty = "Mixed", topics = [] } = req.body;

  const topicStr = topics.length ? `Focus specifically on these topics: ${topics.join(", ")}` : "";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    messages: [{
      role: "user",
      content: `Generate exactly ${count} ${difficulty} multiple choice questions for ${exam} ${subject}. ${topicStr}
      
Return ONLY valid JSON array:
[{"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"...","topic":"..."}]

Requirements:
- Authentic ${exam} style and difficulty
- Nigerian curriculum (NERDC)
- Answer is 0-based index
- Explanations must be clear and educational
- Include topic tag for each question`
    }],
  });

  let text = response.content[0].text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const questions = JSON.parse(text);

  // Save test attempt to DB
  await supabase.from("test_attempts").insert({
    user_id: req.user.id,
    subject, exam, difficulty, count,
    questions: JSON.stringify(questions),
    created_at: new Date().toISOString(),
  });

  res.json({ questions });
});

// Submit test results
app.post("/ai/submit-test", requireAuth, async (req, res) => {
  const { testId, answers, score, subject, exam } = req.body;

  // Update test attempt
  await supabase.from("test_attempts").update({ answers: JSON.stringify(answers), score, completed_at: new Date().toISOString() }).eq("id", testId);

  // Update user stats
  await supabase.rpc("update_user_stats", { p_user_id: req.user.id, p_subject: subject, p_score: score, p_total: answers.length });

  res.json({ success: true });
});

// ─── STUDY SCHEDULE GENERATOR ────────────────────────────────────────────────
app.post("/ai/generate-schedule", requireAuth, aiLimiter, async (req, res) => {
  const { examDate, exam, hoursPerDay, weakSubjects, targetScore } = req.body;

  const daysLeft = Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Create a study schedule for a Nigerian student:
- Exam: ${exam} in ${daysLeft} days (${examDate})
- Hours available: ${hoursPerDay}/day
- Weak subjects: ${weakSubjects?.join(", ") || "none"}
- Target score: ${targetScore || "high score"}

Return ONLY valid JSON:
{
  "overview": "strategy summary",
  "examReadiness": 65,
  "phases": [{"name":"","duration":"","focus":"","weeklyPlan":[{"day":"Mon","sessions":[{"time":"08:00","subject":"","topic":"","duration":"1hr"}]}]}],
  "resources": [{"title":"","type":"past_questions|textbook|youtube","url":""}],
  "tips": ["tip1","tip2"]
}`
    }],
  });

  let text = response.content[0].text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const schedule = JSON.parse(text);

  // Save schedule
  await supabase.from("study_schedules").upsert({
    user_id: req.user.id,
    exam_date: examDate,
    schedule: JSON.stringify(schedule),
    updated_at: new Date().toISOString(),
  });

  res.json(schedule);
});

// ═════════════════════════════════════════════════════════════════════════════
// PAST QUESTIONS ROUTES
// ═════════════════════════════════════════════════════════════════════════════

app.get("/questions", requireAuth, async (req, res) => {
  const { exam, subject, year, limit = 20, offset = 0 } = req.query;

  let query = supabase.from("past_questions").select("*", { count: "exact" });
  if (exam && exam !== "All") query = query.eq("exam", exam);
  if (subject && subject !== "All") query = query.eq("subject", subject);
  if (year && year !== "All") query = query.eq("year", parseInt(year));

  query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1).order("year", { ascending: false });

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ questions: data, total: count, offset, limit });
});

// Get AI explanation for a specific question
app.post("/questions/:id/explain", requireAuth, checkQuota, aiLimiter, async (req, res) => {
  const { data: question } = await supabase.from("past_questions").select("*").eq("id", req.params.id).single();
  if (!question) return res.status(404).json({ error: "Question not found" });

  // Check cache
  const cacheKey = `explain:${req.params.id}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json({ explanation: cached });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `${question.exam} ${question.year} ${question.subject}:

Question: ${question.question}
Options: ${question.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(", ")}
Correct Answer: ${question.options[question.correct_index]}

Write a clear explanation for a Nigerian student covering:
1. Why the correct answer is right (with working if math/science)
2. Why each wrong option is incorrect
3. A memory tip for exam day

Keep it concise and educational.`
    }],
  });

  const explanation = response.content[0].text;
  await redis.setex(cacheKey, 86400 * 7, explanation); // cache 7 days

  res.json({ explanation });
});

// Record answer attempt
app.post("/questions/:id/attempt", requireAuth, async (req, res) => {
  const { selected_index, is_correct, time_taken } = req.body;

  await supabase.from("question_attempts").insert({
    user_id: req.user.id,
    question_id: req.params.id,
    selected_index,
    is_correct,
    time_taken,
    created_at: new Date().toISOString(),
  });

  // Update streak/stats
  await supabase.rpc("record_daily_activity", { p_user_id: req.user.id });

  res.json({ success: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// PROGRESS & STATS ROUTES
// ═════════════════════════════════════════════════════════════════════════════

app.get("/progress", requireAuth, async (req, res) => {
  const userId = req.user.id;

  const [statsResult, subjectResult, recentResult, streakResult] = await Promise.all([
    supabase.from("user_stats").select("*").eq("user_id", userId).single(),
    supabase.from("subject_performance").select("*").eq("user_id", userId),
    supabase.from("question_attempts").select("*, past_questions(subject,exam)").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.rpc("get_study_streak", { p_user_id: userId }),
  ]);

  res.json({
    stats: statsResult.data,
    subjects: subjectResult.data,
    recent: recentResult.data,
    streak: streakResult.data,
  });
});

app.get("/progress/weekly", requireAuth, async (req, res) => {
  const { data } = await supabase.rpc("get_weekly_activity", { p_user_id: req.user.id });
  res.json(data);
});

// ═════════════════════════════════════════════════════════════════════════════
// STRIPE PAYMENT ROUTES
// ═════════════════════════════════════════════════════════════════════════════

const PLANS = {
  basic: { priceId: process.env.STRIPE_PRICE_BASIC, name: "Basic Plan", amount: 400000 }, // ₦4,000 in kobo
  pro:   { priceId: process.env.STRIPE_PRICE_PRO,   name: "Pro Plan",   amount: 800000 }, // ₦8,000 in kobo
};

// Create checkout session
app.post("/payments/checkout", requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: "Invalid plan" });

  const profile = req.user.profile;

  // Get or create Stripe customer
  let customerId = profile.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      name: profile.full_name,
      metadata: { supabase_user_id: req.user.id },
    });
    customerId = customer.id;
    await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("id", req.user.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.FRONTEND_URL}/pricing`,
    metadata: { user_id: req.user.id, plan },
    subscription_data: { metadata: { user_id: req.user.id, plan } },
    // Allow Nigerian cards
    payment_method_options: { card: { request_three_d_secure: "automatic" } },
  });

  res.json({ url: session.url });
});

// Create billing portal session (manage subscription)
app.post("/payments/portal", requireAuth, async (req, res) => {
  const customerId = req.user.profile?.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: "No subscription found" });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.FRONTEND_URL}/dashboard`,
  });

  res.json({ url: session.url });
});

// Get current subscription status
app.get("/payments/subscription", requireAuth, async (req, res) => {
  const customerId = req.user.profile?.stripe_customer_id;
  if (!customerId) return res.json({ plan: "free", status: "inactive" });

  const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
  const sub = subscriptions.data[0];

  res.json({
    plan: req.user.profile?.plan || "free",
    status: sub?.status || "inactive",
    currentPeriodEnd: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end || false,
  });
});

// ─── STRIPE WEBHOOK ───────────────────────────────────────────────────────────
app.post("/webhook/stripe", async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const { user_id, plan } = session.metadata;
      await supabase.from("profiles").update({ plan, stripe_subscription_id: session.subscription }).eq("id", user_id);
      console.log(`✅ User ${user_id} upgraded to ${plan}`);
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const userId = sub.metadata.user_id;
      const plan = sub.metadata.plan;
      const status = sub.status;
      if (userId) {
        await supabase.from("profiles").update({ plan: status === "active" ? plan : "free" }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const userId = sub.metadata.user_id;
      if (userId) {
        await supabase.from("profiles").update({ plan: "free", stripe_subscription_id: null }).eq("id", userId);
        console.log(`⚠️ Subscription cancelled for user ${userId}`);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      console.error(`❌ Payment failed for customer ${invoice.customer}`);
      // TODO: send email notification
      break;
    }
  }

  res.json({ received: true });
});

// ═════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═════════════════════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", message: process.env.NODE_ENV === "development" ? err.message : undefined });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 PassAI API running on port ${PORT}`));
