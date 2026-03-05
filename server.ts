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
import multer from "multer";
import cors from "cors";

// --- CLOUD CONFIGURATION ---
const SUPABASE_URL = 'https://vshmnnxcskpejlnnbveu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaG1ubnhjc2twZWpsbm5idmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTgzNzUsImV4cCI6MjA4ODI3NDM3NX0.hjfEaRV7F7EFmA-1OWVllra6Y3E6mLa5MSI0aWkX5z0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || "family-sync-secret-key-123";

// Ensure profile-images directory exists
const profileImagesDir = path.join(__dirname, "profile-images");
if (!fs.existsSync(profileImagesDir)) fs.mkdirSync(profileImagesDir, { recursive: true });

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const isProd = process.env.NODE_ENV === "production";

  // --- Middleware ---
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use("/profile-images", express.static(profileImagesDir));
  
  // Ngrok Bypass
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  // --- Seed Admin Account in Cloud ---
  const ADMIN_PASSWORD = "Akm@lc0m3l123";
  const hashedPw = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  
  const { data: existingAdmin } = await supabase.from('users').select('*').eq('username', 'admin').single();
  if (!existingAdmin) {
    await supabase.from('users').insert([{ 
        id: 'admin-id', username: 'admin', password: hashedPw, isAdmin: true, role: 'Admin' 
    }]);
    await supabase.from('user_groups').insert([{ userId: 'admin-id', groupId: 'family-group-id' }]);
    console.log("Admin seeded to Supabase");
  }

  // --- WebSocket Logic ---
  const clients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(message); });
  };

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) { res.status(401).json({ error: "Invalid token" }); }
  };

  const adminOnly = (req: any, res: any, next: any) => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin only" });
    next();
  };

  // --- AUTH ROUTES ---
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const hashed = await bcrypt.hash(password, 10);
      const { error } = await supabase.from('users').insert([{ id: crypto.randomUUID(), username, password: hashed }]);
      if (error) throw error;
      res.status(201).json({ message: "User registered" });
    } catch (error) { res.status(400).json({ error: "Username exists or Cloud Error" }); }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.isAdmin }, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
      
      const { data: groups } = await supabase.from('user_groups').select('groups(id, name)').eq('userId', user.id);
      res.json({ ...user, isAdmin: !!user.isAdmin, groups: groups?.map((g:any) => g.groups) });
    } catch (error) { res.status(500).json({ error: "Login failed" }); }
  });

  app.get("/api/auth/me", authenticate, async (req: any, res) => {
    const { data: user } = await supabase.from('users').select('*, strftime("%Y-%m-%dT%H:%M:%SZ", createdAt) as createdAt').eq('id', req.user.id).single();
    const { data: groups } = await supabase.from('user_groups').select('groups(id, name)').eq('userId', req.user.id);
    res.json({ ...user, isAdmin: !!user?.isAdmin, groups: groups?.map((g:any) => g.groups) });
  });

  // --- EVENT ROUTES ---
  app.get("/api/events", authenticate, async (req: any, res) => {
    const { data: events } = await supabase.from('events').select('*, event_groups(groupId)').or(`userId.eq.${req.user.id},isShared.eq.1,type.eq.public_holiday`);
    res.json(events?.map(e => ({ ...e, isShared: !!e.isShared, groupIds: e.event_groups?.map((eg:any) => eg.groupId) || [] })));
  });

  app.post("/api/events", authenticate, async (req: any, res) => {
    const { id, title, description, date, endDate, groupIds } = req.body;
    const eventId = id || crypto.randomUUID();
    const newEvent = { 
        id: eventId, title, description, date, endDate, 
        userId: req.user.id, userName: req.user.username, isShared: groupIds?.length > 0 ? 1 : 0 
    };
    await supabase.from('events').insert([newEvent]);
    if (groupIds?.length > 0) {
      await supabase.from('event_groups').insert(groupIds.map((gId:string) => ({ eventId, groupId: gId })));
    }
    broadcast({ type: "EVENT_CREATED", payload: newEvent });
    res.status(201).json(newEvent);
  });

  // --- COMMENT ROUTES ---
  app.get("/api/events/:id/comments", authenticate, async (req, res) => {
    const { data } = await supabase.from('comments').select('*, users(profileImage)').eq('eventId', req.params.id).order('createdAt', { ascending: true });
    res.json(data);
  });

  app.post("/api/events/:id/comments", authenticate, async (req: any, res) => {
    const comment = { id: crypto.randomUUID(), eventId: req.params.id, userId: req.user.id, userName: req.user.username, text: req.body.text };
    await supabase.from('comments').insert([comment]);
    broadcast({ type: "COMMENT_ADDED", payload: { eventId: req.params.id, comment } });
    res.status(201).json(comment);
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

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`--- FULL SYSTEM READY ON PORT ${PORT} ---`);
  });
}

startServer();