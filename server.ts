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
import multer from "multer";
import Database from "better-sqlite3";

// --- CLOUD CONFIG ---
const SUPABASE_URL = 'https://vshmnnxcskpejlnnbveu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzaG1ubnhjc2twZWpsbm5idmV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2OTgzNzUsImV4cCI6MjA4ODI3NDM3NX0.hjfEaRV7F7EFmA-1OWVllra6Y3E6mLa5MSI0aWkX5z0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || "family-sync-secret-key-123";

// Ensure profile-images directory exists
const profileImagesDir = path.join(__dirname, "profile-images");
if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir, { recursive: true });
}

// Initialize SQLite database (keeping for local data)
const db = new Database("family_calendar.db");

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT NOT NULL,
    bio TEXT,
    profileImage TEXT,
    themeColor TEXT DEFAULT '#10b981',
    backgroundStyle TEXT DEFAULT 'default',
    isAdmin INTEGER DEFAULT 0,
    role TEXT DEFAULT 'User',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_groups (
    userId TEXT,
    groupId TEXT,
    PRIMARY KEY (userId, groupId),
    FOREIGN KEY(userId) REFERENCES users(id),
    FOREIGN KEY(groupId) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    endDate TEXT,
    startTime TEXT,
    endTime TEXT,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    isShared INTEGER DEFAULT 0,
    type TEXT DEFAULT 'event',
    systemGenerated INTEGER DEFAULT 0,
    readOnly INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    eventId TEXT NOT NULL,
    userId TEXT NOT NULL,
    userName TEXT NOT NULL,
    text TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(eventId) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS event_groups (
    eventId TEXT,
    groupId TEXT,
    PRIMARY KEY (eventId, groupId),
    FOREIGN KEY(eventId) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(groupId) REFERENCES groups(id) ON DELETE CASCADE
  );
`);

// Run migrations
try {
  const columnExists = (table: string, column: string) => {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
      return info.some(c => c.name === column);
    } catch (e) {
      return false;
    }
  };

  const ensureColumn = (table: string, column: string, definition: string) => {
    if (!columnExists(table, column)) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`Added column ${column} to ${table}`);
      } catch (e) {
        console.error(`Failed to add column ${column} to ${table}:`, e);
      }
    }
  };

  // Add missing columns
  ensureColumn('users', 'backgroundStyle', "TEXT DEFAULT 'default'");
  ensureColumn('users', 'updatedAt', 'TEXT DEFAULT CURRENT_TIMESTAMP');

  // Ensure 'system' user exists for foreign key constraints (holidays)
  try {
    const systemUser = db.prepare("SELECT * FROM users WHERE id = ? OR username = ?").get("system", "system");
    if (!systemUser) {
      db.prepare("INSERT INTO users (id, username, password, role, isAdmin) VALUES (?, ?, ?, ?, ?)").run(
        "system", "system", "system-no-login", "System", 0
      );
    } else if (systemUser.id !== 'system') {
      db.prepare("UPDATE users SET id = 'system' WHERE username = 'system'").run();
    }
  } catch (e) {
    console.error("Failed to ensure system user:", e);
  }

  // Update existing admin role
  db.prepare("UPDATE users SET role = 'Admin' WHERE isAdmin = 1").run();
  db.prepare("UPDATE users SET role = 'User' WHERE isAdmin = 0 AND role IS NULL").run();

  // Add columns to events if they don't exist
  ensureColumn('events', 'startTime', 'TEXT');
  ensureColumn('events', 'endTime', 'TEXT');
  ensureColumn('events', 'type', "TEXT DEFAULT 'event'");
  ensureColumn('events', 'systemGenerated', 'INTEGER DEFAULT 0');
  ensureColumn('events', 'readOnly', 'INTEGER DEFAULT 0');
  
  // Migrate existing groupId from events to event_groups
  if (columnExists('events', 'groupId')) {
    const eventsWithGroup = db.prepare("SELECT id, groupId FROM events WHERE groupId IS NOT NULL").all() as any[];
    for (const event of eventsWithGroup) {
      db.prepare("INSERT OR IGNORE INTO event_groups (eventId, groupId) VALUES (?, ?)").run(event.id, event.groupId);
    }
  }
} catch (e) {
  console.error("Migration error:", e);
}

// Initial Migration: Create default "Family" group if no groups exist
const groupCount = db.prepare("SELECT COUNT(*) as count FROM groups").get() as any;
if (groupCount.count === 0) {
  const familyGroupId = "family-group-id";
  db.prepare("INSERT INTO groups (id, name) VALUES (?, ?)").run(familyGroupId, "Family");
  
  try {
    // Check if family_members table exists before trying to migrate from it
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='family_members'").get();
    if (tableCheck) {
      const familyMembers = db.prepare("SELECT userId FROM family_members").all() as any[];
      for (const member of familyMembers) {
        db.prepare("INSERT OR IGNORE INTO user_groups (userId, groupId) VALUES (?, ?)").run(member.userId, familyGroupId);
      }
    }
  } catch (e) {
    console.log("No family_members table to migrate");
  }

  const sharedEvents = db.prepare("SELECT id FROM events WHERE isShared = 1").all() as any[];
  for (const event of sharedEvents) {
    db.prepare("INSERT OR IGNORE INTO event_groups (eventId, groupId) VALUES (?, ?)").run(event.id, familyGroupId);
  }
}

// Create or update default admin
const adminUser = db.prepare("SELECT * FROM users WHERE username = ?").get("admin") as any;
const ADMIN_PASSWORD = "Akm@lc0m3l123";
const hashedAdminPassword = bcrypt.hashSync(ADMIN_PASSWORD, 10);

if (!adminUser) {
  db.prepare("INSERT INTO users (id, username, password, isAdmin) VALUES (?, ?, ?, ?)").run(
    "admin-id", "admin", hashedAdminPassword, 1
  );
  db.prepare("INSERT OR IGNORE INTO user_groups (userId, groupId) VALUES (?, ?)").run("admin-id", "family-group-id");
} else {
  db.prepare("UPDATE users SET password = ? WHERE username = ?").run(hashedAdminPassword, "admin");
  db.prepare("INSERT OR IGNORE INTO user_groups (userId, groupId) VALUES (?, ?)").run(adminUser.id, "family-group-id");
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const isProd = process.env.NODE_ENV === "production";
  console.log(`--- RUNNING IN ${isProd ? "PRODUCTION" : "DEVELOPMENT"} MODE ---`);

  app.use(cors({ 
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  }));
  
  app.use(express.json());
  app.use(cookieParser());
  app.use("/profile-images", express.static(profileImagesDir));
  
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  // Multer config for profile images
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, profileImagesDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);
      if (extname && mimetype) {
        return cb(null, true);
      }
      cb(new Error("Only .png, .jpg and .jpeg format allowed!"));
    }
  });

  // WebSocket handling
  const clients = new Set<WebSocket>();
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Auth Middleware
  const authenticate = (req: any, res: any, next: any) => {
    if (!req.cookies) {
      console.error("Cookie parser not initialized or cookies missing from request");
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
    } catch (e) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  const adminOnly = (req: any, res: any, next: any) => {
    if (!req.user?.isAdmin) return res.status(403).json({ error: "Admin only" });
    next();
  };

  // Seed Admin Account (Supabase backup)
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

  // --- AUTH ROUTES ---
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const id = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Local DB
      db.prepare("INSERT INTO users (id, username, password) VALUES (?, ?, ?)").run(id, username, hashedPassword);
      
      // Supabase backup
      try {
        await supabase.from('users').insert([{ id, username, password: hashedPassword, isAdmin: false }]);
      } catch (supabaseError) {
        console.error("Supabase insert error:", supabaseError);
      }
      
      broadcast({
        type: "USER_REGISTERED",
        payload: {
          id,
          username,
          isAdmin: false,
          groups: []
        }
      });

      res.status(201).json({ message: "User registered" });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: "Username already exists" });
      }
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      // Local DB login
      const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const token = jwt.sign({ id: user.id, username: user.username, isAdmin: !!user.isAdmin }, JWT_SECRET);
      res.cookie("token", token, { 
        httpOnly: true, 
        sameSite: 'none', 
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      const groups = db.prepare(`
        SELECT g.id, g.name 
        FROM groups g
        JOIN user_groups ug ON g.id = ug.groupId
        WHERE ug.userId = ?
      `).all(user.id);

      const { password: _, ...userWithoutPassword } = user;

      res.json({ 
        ...userWithoutPassword,
        isAdmin: !!user.isAdmin,
        groups: groups
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token", { 
      httpOnly: true, 
      sameSite: 'none', 
      secure: true,
      maxAge: 0
    });
    res.json({ message: "Logged out" });
  });

  app.get("/api/auth/me", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = db.prepare(`
        SELECT id, username, name, bio, profileImage, role, isAdmin, themeColor, backgroundStyle, 
        strftime('%Y-%m-%dT%H:%M:%SZ', createdAt) as createdAt, 
        strftime('%Y-%m-%dT%H:%M:%SZ', updatedAt) as updatedAt 
        FROM users WHERE id = ?
      `).get(userId) as any;
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      user.isAdmin = !!user.isAdmin;

      const groups = db.prepare(`
        SELECT g.id, g.name 
        FROM groups g
        JOIN user_groups ug ON g.id = ug.groupId
        WHERE ug.userId = ?
      `).all(userId);
      
      res.json({ ...user, groups });
    } catch (error: any) {
      console.error("Auth me error details:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // --- PROFILE ROUTES ---
  app.get("/api/profile", authenticate, (req: any, res) => {
    const userId = req.user.id;
    const user = db.prepare(`
      SELECT id, username, name, bio, profileImage, role, themeColor, backgroundStyle, createdAt, updatedAt 
      FROM users WHERE id = ?
    `).get(userId) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  });

  app.put("/api/profile", authenticate, upload.single('profileImage'), async (req: any, res) => {
    const userId = req.user.id;
    const { name, bio, password, themeColor, backgroundStyle } = req.body;
    const profileImage = req.file ? `/profile-images/${req.file.filename}` : undefined;

    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
      if (!user) return res.status(404).json({ error: "User not found" });

      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
      }
      if (bio !== undefined) {
        updates.push("bio = ?");
        params.push(bio);
      }
      if (themeColor !== undefined) {
        updates.push("themeColor = ?");
        params.push(themeColor);
      }
      if (backgroundStyle !== undefined) {
        updates.push("backgroundStyle = ?");
        params.push(backgroundStyle);
      }
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push("password = ?");
        params.push(hashedPassword);
      }
      if (profileImage) {
        if (user.profileImage) {
          const oldPath = path.join(__dirname, user.profileImage);
          if (fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (e) {}
          }
        }
        updates.push("profileImage = ?");
        params.push(profileImage);
      }

      if (updates.length > 0) {
        updates.push("updatedAt = CURRENT_TIMESTAMP");
        const query = `UPDATE users SET ${updates.join(", ")} WHERE id = ?`;
        params.push(userId);
        db.prepare(query).run(...params);
      }

      const updatedUser = db.prepare(`
        SELECT id, username, name, bio, profileImage, role, isAdmin, themeColor, backgroundStyle, 
        strftime('%Y-%m-%dT%H:%M:%SZ', createdAt) as createdAt, 
        strftime('%Y-%m-%dT%H:%M:%SZ', updatedAt) as updatedAt 
        FROM users WHERE id = ?
      `).get(userId) as any;
      
      if (updatedUser) {
        updatedUser.isAdmin = !!updatedUser.isAdmin;
        updatedUser.groups = db.prepare(`
          SELECT g.id, g.name 
          FROM groups g
          JOIN user_groups ug ON g.id = ug.groupId
          WHERE ug.userId = ?
        `).all(userId);
      }
      
      broadcast({ type: "USER_UPDATED", payload: { userId } });
      res.json(updatedUser);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // --- ADMIN ROUTES ---
  app.get("/api/admin/users", authenticate, adminOnly, (req, res) => {
    try {
      const users = db.prepare(`SELECT id, username, isAdmin, role FROM users`).all() as any[];
      const usersWithGroups = users.map(user => {
        const groups = db.prepare(`
          SELECT g.id, g.name 
          FROM groups g
          JOIN user_groups ug ON g.id = ug.groupId
          WHERE ug.userId = ?
        `).all(user.id);
        return { ...user, groups };
      });
      res.json(usersWithGroups);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:userId", authenticate, adminOnly, async (req, res) => {
    const { userId } = req.params;
    const { username, password } = req.body;
    try {
      if (username) {
        const existing = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, userId);
        if (existing) {
          return res.status(400).json({ error: "Username already exists" });
        }
        db.prepare("UPDATE users SET username = ? WHERE id = ?").run(username, userId);
      }
      
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
      }
      
      broadcast({ type: "USER_UPDATED", payload: { userId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update user", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:userId", authenticate, adminOnly, (req: any, res) => {
    const { userId } = req.params;
    
    if (userId === "admin-id" || userId === req.user.id) {
      return res.status(403).json({ error: "Cannot delete this user" });
    }

    try {
      const deleteEvents = db.prepare("DELETE FROM events WHERE userId = ?");
      const deleteUserGroups = db.prepare("DELETE FROM user_groups WHERE userId = ?");
      const deleteComments = db.prepare("DELETE FROM comments WHERE userId = ?");
      const deleteUser = db.prepare("DELETE FROM users WHERE id = ?");

      const transaction = db.transaction(() => {
        deleteEvents.run(userId);
        deleteUserGroups.run(userId);
        deleteComments.run(userId);
        deleteUser.run(userId);
      });

      transaction();

      broadcast({ type: "USER_DELETED", payload: { userId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete user", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.get("/api/admin/groups", authenticate, adminOnly, (req, res) => {
    try {
      const groups = db.prepare("SELECT id, name, strftime('%Y-%m-%dT%H:%M:%SZ', createdAt) as createdAt FROM groups").all();
      res.json(groups);
    } catch (error) {
      console.error("Failed to fetch groups:", error);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  app.post("/api/admin/groups", authenticate, adminOnly, (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required" });
    }
    
    try {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO groups (id, name) VALUES (?, ?)").run(id, name.trim());
      
      const newGroup = { id, name: name.trim(), createdAt: new Date().toISOString() };
      broadcast({ type: "GROUP_CREATED", payload: newGroup });
      
      res.status(201).json(newGroup);
    } catch (error) {
      console.error("Failed to create group:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.post("/api/admin/groups/:groupId/members", authenticate, adminOnly, (req, res) => {
    const { groupId } = req.params;
    const { userId, action } = req.body;
    
    if (!userId || !action || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    
    try {
      if (action === 'add') {
        db.prepare("INSERT OR IGNORE INTO user_groups (userId, groupId) VALUES (?, ?)").run(userId, groupId);
      } else {
        db.prepare("DELETE FROM user_groups WHERE userId = ? AND groupId = ?").run(userId, groupId);
      }
      broadcast({ type: "USER_UPDATED", payload: { userId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Operation failed:", error);
      res.status(500).json({ error: "Operation failed" });
    }
  });

  app.delete("/api/admin/groups/:groupId", authenticate, adminOnly, (req, res) => {
    const { groupId } = req.params;
    try {
      // First delete event associations
      db.prepare("DELETE FROM event_groups WHERE groupId = ?").run(groupId);
      
      // Delete user group associations
      db.prepare("DELETE FROM user_groups WHERE groupId = ?").run(groupId);
      
      // Finally delete the group
      const result = db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: "Group not found" });
      }

      broadcast({ type: "GROUP_DELETED", payload: { groupId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete group:", error);
      res.status(500).json({ error: "Failed to delete group" });
    }
  });

  // --- HOLIDAY ROUTES ---
  app.get("/api/holidays/sync/:year", authenticate, async (req: any, res) => {
    const { year } = req.params;
    
    // Validate year
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({ error: "Invalid year" });
    }

    try {
      let holidays = [];
      let apiSuccess = false;
      
      // Try to fetch from API
      try {
        console.log(`Fetching holidays for ${year} from API...`);
        const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/MY`);
        if (response.ok) {
          const text = await response.text();
          if (text && text.trim()) {
            holidays = JSON.parse(text);
            apiSuccess = true;
            console.log(`Successfully fetched ${holidays.length} holidays from API`);
          }
        } else {
          console.log(`API returned status ${response.status}`);
        }
      } catch (e) {
        console.warn("Holiday API failed, using fallback:", e);
      }

      // Use fallback data if API failed
      if (!apiSuccess) {
        console.log(`Using fallback holiday data for ${year}`);
        
        // Malaysia public holidays for common years
        const fallbackHolidays: { [key: string]: any[] } = {
          "2024": [
            { date: "2024-01-01", localName: "New Year's Day", name: "New Year's Day" },
            { date: "2024-02-10", localName: "Chinese New Year", name: "Chinese New Year" },
            { date: "2024-02-11", localName: "Chinese New Year Day 2", name: "Chinese New Year Day 2" },
            { date: "2024-03-23", localName: "Hari Raya Puasa", name: "Eid al-Fitr" },
            { date: "2024-03-24", localName: "Hari Raya Puasa Day 2", name: "Eid al-Fitr Day 2" },
            { date: "2024-05-01", localName: "Labour Day", name: "Labour Day" },
            { date: "2024-06-03", localName: "Agong's Birthday", name: "Agong's Birthday" },
            { date: "2024-06-17", localName: "Hari Raya Haji", name: "Eid al-Adha" },
            { date: "2024-07-07", localName: "Islamic New Year", name: "Islamic New Year" },
            { date: "2024-08-31", localName: "National Day", name: "National Day" },
            { date: "2024-09-16", localName: "Malaysia Day", name: "Malaysia Day" },
            { date: "2024-10-19", localName: "Deepavali", name: "Deepavali" },
            { date: "2024-12-25", localName: "Christmas Day", name: "Christmas Day" },
          ],
          "2025": [
            { date: "2025-01-01", localName: "New Year's Day", name: "New Year's Day" },
            { date: "2025-01-29", localName: "Chinese New Year", name: "Chinese New Year" },
            { date: "2025-01-30", localName: "Chinese New Year Day 2", name: "Chinese New Year Day 2" },
            { date: "2025-03-31", localName: "Hari Raya Puasa", name: "Eid al-Fitr" },
            { date: "2025-04-01", localName: "Hari Raya Puasa Day 2", name: "Eid al-Fitr Day 2" },
            { date: "2025-05-01", localName: "Labour Day", name: "Labour Day" },
            { date: "2025-06-02", localName: "Agong's Birthday", name: "Agong's Birthday" },
            { date: "2025-06-07", localName: "Hari Raya Haji", name: "Eid al-Adha" },
            { date: "2025-06-27", localName: "Islamic New Year", name: "Islamic New Year" },
            { date: "2025-08-31", localName: "National Day", name: "National Day" },
            { date: "2025-09-16", localName: "Malaysia Day", name: "Malaysia Day" },
            { date: "2025-10-20", localName: "Deepavali", name: "Deepavali" },
            { date: "2025-12-25", localName: "Christmas Day", name: "Christmas Day" },
          ],
          "2026": [
            { date: "2026-01-01", localName: "New Year's Day", name: "New Year's Day" },
            { date: "2026-02-17", localName: "Chinese New Year", name: "Chinese New Year" },
            { date: "2026-02-18", localName: "Chinese New Year Day 2", name: "Chinese New Year Day 2" },
            { date: "2026-03-20", localName: "Hari Raya Puasa", name: "Eid al-Fitr" },
            { date: "2026-03-21", localName: "Hari Raya Puasa Day 2", name: "Eid al-Fitr Day 2" },
            { date: "2026-05-01", localName: "Labour Day", name: "Labour Day" },
            { date: "2026-05-27", localName: "Hari Raya Haji", name: "Eid al-Adha" },
            { date: "2026-06-01", localName: "Agong's Birthday", name: "Agong's Birthday" },
            { date: "2026-06-17", localName: "Islamic New Year", name: "Islamic New Year" },
            { date: "2026-08-31", localName: "National Day", name: "National Day" },
            { date: "2026-09-16", localName: "Malaysia Day", name: "Malaysia Day" },
            { date: "2026-11-08", localName: "Deepavali", name: "Deepavali" },
            { date: "2026-12-25", localName: "Christmas Day", name: "Christmas Day" },
          ]
        };
        
        holidays = fallbackHolidays[year] || fallbackHolidays["2026"];
      }

      // Insert holidays into database
      const insertHoliday = db.prepare(`
        INSERT OR IGNORE INTO events 
        (id, title, description, date, endDate, userId, userName, isShared, type, systemGenerated, readOnly) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let insertedCount = 0;
      const transaction = db.transaction(() => {
        for (const holiday of holidays) {
          // Create a consistent ID that won't duplicate
          const id = `holiday-${year}-${holiday.date}-${holiday.localName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
          
          try {
            const result = insertHoliday.run(
              id,
              holiday.localName,
              holiday.name,
              holiday.date,
              holiday.date,
              'system',
              'System',
              1,  // isShared
              'public_holiday',
              1,  // systemGenerated
              1   // readOnly
            );
            
            if (result.changes && result.changes > 0) {
              insertedCount++;
            }
          } catch (err) {
            console.error(`Failed to insert holiday ${holiday.localName}:`, err);
          }
        }
      });

      transaction();
      
      console.log(`Successfully inserted ${insertedCount} holidays for ${year}`);
      res.json({ 
        message: `Synced ${insertedCount} holidays for ${year}`, 
        count: insertedCount 
      });
      
    } catch (error) {
      console.error("Holiday sync error:", error);
      res.status(500).json({ error: "Failed to sync holidays" });
    }
  });

  // --- EVENT ROUTES ---
  app.get("/api/events", authenticate, (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const userGroups = db.prepare("SELECT groupId FROM user_groups WHERE userId = ?").all(userId) as any[];
      const groupIds = userGroups.map(ug => ug.groupId);

      let events;
      if (groupIds.length > 0) {
        const placeholders = groupIds.map(() => "?").join(",");
        events = db.prepare(`
          SELECT DISTINCT e.*, strftime('%Y-%m-%dT%H:%M:%SZ', e.createdAt) as createdAt, 
          (SELECT COUNT(*) FROM comments WHERE eventId = e.id) as commentCount 
          FROM events e
          LEFT JOIN event_groups eg ON e.id = eg.eventId
          WHERE e.userId = ? OR eg.groupId IN (${placeholders}) OR e.type = 'public_holiday'
          ORDER BY e.date ASC
        `).all(userId, ...groupIds) as any[];
      } else {
        events = db.prepare(`
          SELECT e.*, strftime('%Y-%m-%dT%H:%M:%SZ', e.createdAt) as createdAt, 
          (SELECT COUNT(*) FROM comments WHERE eventId = e.id) as commentCount 
          FROM events e 
          WHERE e.userId = ? OR e.type = 'public_holiday' 
          ORDER BY e.date ASC
        `).all(userId) as any[];
      }

      const eventsWithGroups = events.map(event => {
        const groups = db.prepare("SELECT groupId FROM event_groups WHERE eventId = ?").all(event.id) as any[];
        return { 
          ...event, 
          isShared: !!event.isShared,
          systemGenerated: !!event.systemGenerated,
          readOnly: !!event.readOnly,
          groupIds: groups.map(g => g.groupId) 
        };
      });

      res.json(eventsWithGroups);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events", authenticate, (req: any, res) => {
    const { id, title, description, date, endDate, startTime, endTime, groupIds } = req.body;
    const userId = req.user.id;
    const userName = req.user.username;
    
    try {
      if (groupIds && Array.isArray(groupIds)) {
        for (const gId of groupIds) {
          const isMember = db.prepare("SELECT 1 FROM user_groups WHERE userId = ? AND groupId = ?").get(userId, gId);
          if (!isMember) {
            return res.status(403).json({ error: `You are not a member of group ${gId}` });
          }
        }
      }

      const insertEvent = db.prepare(`
        INSERT INTO events (id, title, description, date, endDate, startTime, endTime, userId, userName, isShared)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const insertEventGroup = db.prepare(`
        INSERT INTO event_groups (eventId, groupId) VALUES (?, ?)
      `);

      const startDateStr = date.split('T')[0];
      const endDateStr = (endDate || date).split('T')[0];
      const isShared = groupIds && groupIds.length > 0;

      const transaction = db.transaction(() => {
        insertEvent.run(id, title, description, startDateStr, endDateStr, startTime || null, endTime || null, userId, userName, isShared ? 1 : 0);
        if (isShared) {
          for (const gId of groupIds) {
            insertEventGroup.run(id, gId);
          }
        }
      });

      transaction();

      const newEvent = { 
        id, 
        title, 
        description, 
        date: startDateStr, 
        endDate: endDateStr, 
        startTime, 
        endTime, 
        userId, 
        userName, 
        isShared, 
        groupIds: groupIds || [],
        commentCount: 0
      };
      broadcast({ type: "EVENT_CREATED", payload: newEvent });
      res.status(201).json(newEvent);
    } catch (error) {
      console.error("Failed to create event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.put("/api/events/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    const { title, description, date, endDate, startTime, endTime, groupIds } = req.body;
    const userId = req.user.id;

    try {
      const event = db.prepare("SELECT userId, userName, readOnly FROM events WHERE id = ?").get(id) as any;
      if (!event || (event.userId !== userId && !req.user.isAdmin)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (event.readOnly && !req.user.isAdmin) {
        return res.status(403).json({ error: "This event is read-only" });
      }

      if (groupIds && Array.isArray(groupIds)) {
        for (const gId of groupIds) {
          const isMember = db.prepare("SELECT 1 FROM user_groups WHERE userId = ? AND groupId = ?").get(userId, gId);
          if (!isMember && !req.user.isAdmin) {
            return res.status(403).json({ error: `You are not a member of group ${gId}` });
          }
        }
      }

      const updateEvent = db.prepare(`
        UPDATE events 
        SET title = ?, description = ?, date = ?, endDate = ?, startTime = ?, endTime = ?, isShared = ?
        WHERE id = ?
      `);
      
      const deleteEventGroups = db.prepare("DELETE FROM event_groups WHERE eventId = ?");
      const insertEventGroup = db.prepare("INSERT INTO event_groups (eventId, groupId) VALUES (?, ?)");

      const startDateStr = date.split('T')[0];
      const endDateStr = (endDate || date).split('T')[0];
      const isShared = groupIds && groupIds.length > 0;

      const transaction = db.transaction(() => {
        updateEvent.run(title, description, startDateStr, endDateStr, startTime || null, endTime || null, isShared ? 1 : 0, id);
        deleteEventGroups.run(id);
        if (isShared) {
          for (const gId of groupIds) {
            insertEventGroup.run(id, gId);
          }
        }
      });

      transaction();

      const commentCount = db.prepare("SELECT COUNT(*) as count FROM comments WHERE eventId = ?").get(id) as any;

      const updatedEvent = { 
        id, 
        title, 
        description, 
        date: startDateStr, 
        endDate: endDateStr, 
        startTime,
        endTime,
        isShared, 
        groupIds: groupIds || [],
        userId: event.userId,
        userName: event.userName,
        commentCount: commentCount.count
      };
      broadcast({ type: "EVENT_UPDATED", payload: updatedEvent });
      res.json(updatedEvent);
    } catch (error) {
      console.error("Failed to update event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", authenticate, (req: any, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const event = db.prepare("SELECT userId, readOnly FROM events WHERE id = ?").get(id) as any;
      if (!event || (event.userId !== userId && !req.user.isAdmin)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (event.readOnly && !req.user.isAdmin) {
        return res.status(403).json({ error: "This event is read-only" });
      }

      const deleteEventGroups = db.prepare("DELETE FROM event_groups WHERE eventId = ?");
      const deleteComments = db.prepare("DELETE FROM comments WHERE eventId = ?");
      const deleteEvent = db.prepare("DELETE FROM events WHERE id = ?");

      const transaction = db.transaction(() => {
        deleteEventGroups.run(id);
        deleteComments.run(id);
        deleteEvent.run(id);
      });

      transaction();

      broadcast({ type: "EVENT_DELETED", payload: { id } });
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // --- COMMENT ROUTES ---
  app.get("/api/events/:id/comments", authenticate, (req: any, res) => {
    const { id } = req.params;
    try {
      const comments = db.prepare(`
        SELECT c.id, c.eventId, c.userId, c.userName, c.text, strftime('%Y-%m-%dT%H:%M:%SZ', c.createdAt) as createdAt, u.profileImage 
        FROM comments c
        JOIN users u ON c.userId = u.id
        WHERE c.eventId = ?
        ORDER BY c.createdAt ASC
      `).all(id);
      res.json(comments);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/events/:id/comments", authenticate, (req: any, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    const userName = req.user.username;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    try {
      const commentId = crypto.randomUUID();
      db.prepare("INSERT INTO comments (id, eventId, userId, userName, text) VALUES (?, ?, ?, ?, ?)").run(
        commentId, id, userId, userName, text
      );
      
      const newComment = db.prepare(`
        SELECT c.id, c.eventId, c.userId, c.userName, c.text, strftime('%Y-%m-%dT%H:%M:%SZ', c.createdAt) as createdAt, u.profileImage 
        FROM comments c
        JOIN users u ON c.userId = u.id
        WHERE c.id = ?
      `).get(commentId);

      const countResult = db.prepare("SELECT COUNT(*) as count FROM comments WHERE eventId = ?").get(id) as any;
      const newCount = countResult ? countResult.count : 0;

      broadcast({ type: "COMMENT_ADDED", payload: { eventId: id, comment: newComment, newCount } });
      res.status(201).json(newComment);
    } catch (error) {
      console.error("Failed to add comment:", error);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  app.delete("/api/events/:eventId/comments/:commentId", authenticate, (req: any, res) => {
    const { eventId, commentId } = req.params;
    const userId = req.user.id;

    try {
      const comment = db.prepare("SELECT * FROM comments WHERE id = ?").get(commentId) as any;
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      if (comment.userId !== userId && !req.user.isAdmin) {
        return res.status(403).json({ error: "You can only delete your own comments" });
      }

      db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
      
      const countResult = db.prepare("SELECT COUNT(*) as count FROM comments WHERE eventId = ?").get(eventId) as any;
      const newCount = countResult ? countResult.count : 0;

      broadcast({ type: "COMMENT_DELETED", payload: { eventId, commentId, newCount } });
      res.status(204).send();
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // --- FRONTEND SERVING ---
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(express.static("public"));
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on Port ${PORT}`);
  });
}

startServer();