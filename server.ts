import { createClient } from '@supabase/supabase-js';
import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import cors from "cors";

// --- CLOUD CONFIG ---
const SUPABASE_URL = 'https://vshmnnxcskpejlnnbveu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaG1ubnhjc2twZWpsbm5idmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTgzNzUsImV4cCI6MjA4ODI3NDM3NX0.hjfEaRV7F7EFmA-1OWVllra6Y3E6mLa5MSI0aWkX5z0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || "family-sync-secret-key-123";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const isProd = process.env.NODE_ENV === "production";

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  // --- Seed Admin Account ---
  const seedAdmin = async () => {
    const hashed = bcrypt.hashSync("Akm@lc0m3l123", 10);
    const { data } = await supabase.from('users').select('*').eq('username', 'admin');
    if (!data || data.length === 0) {
      await supabase.from('users').insert([{ 
        id: 'admin-id', username: 'admin', password: hashed, isAdmin: true, role: 'Admin' 
      }]);
      await supabase.from('user_groups').insert([{ userId: 'admin-id', groupId: 'family-group-id' }]);
      console.log("Admin seeded to Cloud Database");
    }
  };
  seedAdmin();

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) { res.status(401).json({ error: "Invalid token" }); }
  };

  // --- AUTH ROUTES ---
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashed = await bcrypt.hash(password, 10);
      const { error } = await supabase.from('users').insert([{ id: crypto.randomUUID(), username, password: hashed, isAdmin: false }]);
      if (error) throw error;
      res.status(201).json({ message: "User registered" });
    } catch (error: any) {
      console.error("Register Error:", error.message);
      res.status(400).json({ error: "Username exists or database error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const { data: user, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
      if (!user || error || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.isAdmin }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
      res.json({ id: user.id, username: user.username, isAdmin: !!user.isAdmin });
    } catch (error) { res.status(500).json({ error: "Login failed" }); }
  });

  app.get("/api/auth/me", authenticate, async (req: any, res) => {
    try {
      const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).maybeSingle();
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ ...user, isAdmin: !!user.isAdmin });
    } catch (e) { res.status(500).json({ error: "Server error" }); }
  });

  // --- EVENT ROUTES ---
  app.get("/api/events", authenticate, async (req: any, res) => {
    const { data: events } = await supabase.from('events').select('*').or(`userId.eq.${req.user.id},isShared.eq.true`);
    res.json(events || []);
  });

  // --- FRONTEND SERVING ---
  if (!isProd) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(express.static("public"));
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) { next(e); }
    });
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // PORT casting to Number fixes TypeScript error
  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on Port ${PORT}`);
  });
}

startServer();