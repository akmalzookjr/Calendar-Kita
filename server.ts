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

// --- CLOUD CONFIGURATION ---
const SUPABASE_URL = 'https://vshmnnxcskpejlnnbveu.supabase.co';
const SUPABASE_KEY = 'YOUR_KEY_HERE'; // Use the long Key you pasted before
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || "family-sync-secret-key-123";

// Ensure profile-images directory exists (Note: On Render, these delete on restart)
const profileImagesDir = path.join(__dirname, "profile-images");
if (!fs.existsSync(profileImagesDir)) fs.mkdirSync(profileImagesDir, { recursive: true });

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const isProd = process.env.NODE_ENV === "production";
  app.use(express.json());
  app.use(cookieParser());
  app.use("/profile-images", express.static(profileImagesDir));

  // Ngrok/Bot Bypass
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) { res.status(401).json({ error: "Invalid token" }); }
  };

  // --- WebSocket ---
  const clients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => { if (client.readyState === WebSocket.OPEN) client.send(message); });
  };

  // --- AUTH ROUTES ---
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    
    const { error } = await supabase.from('users').insert([{ id, username, password: hashedPassword, role: 'User' }]);
    
    if (error) return res.status(400).json({ error: "Username exists or Cloud Error" });
    res.status(201).json({ message: "User registered" });
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.isAdmin }, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true, sameSite: 'none', secure: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    
    res.json({ id: user.id, username: user.username, isAdmin: !!user.isAdmin });
  });

  // --- EVENT ROUTES ---
  app.get("/api/events", authenticate, async (req: any, res) => {
    // Real Dev Logic: Fetch events where user is owner OR event is shared
    const { data, error } = await supabase
      .from('events')
      .select('*, event_groups(groupId)')
      .or(`userId.eq.${req.user.id},isShared.eq.1`);

    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post("/api/events", authenticate, async (req: any, res) => {
    const { id, title, description, date, endDate, groupIds } = req.body;
    const newEvent = { 
      id: id || crypto.randomUUID(), 
      title, description, date, endDate, 
      userId: req.user.id, userName: req.user.username,
      isShared: groupIds?.length > 0 ? 1 : 0 
    };

    const { error } = await supabase.from('events').insert([newEvent]);
    if (error) return res.status(500).json(error);

    if (groupIds?.length > 0) {
        const links = groupIds.map((gId: string) => ({ eventId: newEvent.id, groupId: gId }));
        await supabase.from('event_groups').insert(links);
    }

    broadcast({ type: "EVENT_CREATED", payload: newEvent });
    res.status(201).json(newEvent);
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

  server.listen(3000, "0.0.0.0", () => {
    console.log(`Cloud-Ready Server running on http://localhost:3000`);
  });
}

startServer();