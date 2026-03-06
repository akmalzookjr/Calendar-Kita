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
import dotenv from 'dotenv';
dotenv.config();

// Debug helper for Supabase operations
async function debugSupabase(operation: string, supabasePromise: Promise<any>) {
  console.log(`   🔄 Supabase ${operation} - starting...`);
  try {
    const result = await supabasePromise;
    if (result.error) {
      console.error(`   ❌ Supabase ${operation} failed:`, {
        code: result.error.code,
        message: result.error.message,
        details: result.error.details,
        hint: result.error.hint,
        status: result.status,
        statusText: result.statusText
      });
      return { success: false, error: result.error };
    } else {
      console.log(`   ✅ Supabase ${operation} succeeded:`, result.data);
      return { success: true, data: result.data };
    }
  } catch (error) {
    console.error(`   ❌ Supabase ${operation} exception:`, error);
    return { success: false, error };
  }
}

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

// Initialize SQLite database (local backup)
const db = new Database("family_calendar.db");

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

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

// Ensure default settings
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run("holidayCountryCode", "MY");

// --- SYNC LOGIC - Modified to NOT overwrite local data ---
async function syncFromSupabase() {
  console.log("--- STARTING SYNC FROM SUPABASE (MERGING MODE) ---");
  try {
    // Sync Users - only insert if not exists
    const { data: users, error: usersError } = await supabase.from('users').select('*');
    if (usersError) throw usersError;
    if (users) {
      const insertUser = db.prepare(`
        INSERT OR IGNORE INTO users (id, username, name, password, bio, profileImage, themeColor, backgroundStyle, isAdmin, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        for (const user of users) {
          insertUser.run(
            user.id, user.username, user.name || null, user.password, user.bio || null, 
            user.profileImage || null, user.themeColor || '#10b981', user.backgroundStyle || 'default', 
            user.isAdmin ? 1 : 0, user.role || 'User', user.createdAt || new Date().toISOString(), user.updatedAt || new Date().toISOString()
          );
        }
      })();
      console.log(`Merged ${users.length} users from Supabase`);
    }

    // Sync Groups - only insert if not exists
    const { data: groups, error: groupsError } = await supabase.from('groups').select('*');
    if (groupsError) throw groupsError;
    if (groups) {
      const insertGroup = db.prepare("INSERT OR IGNORE INTO groups (id, name, createdAt) VALUES (?, ?, ?)");
      db.transaction(() => {
        for (const group of groups) {
          insertGroup.run(group.id, group.name, group.createdAt || new Date().toISOString());
        }
      })();
      console.log(`Merged ${groups.length} groups from Supabase`);
    }

    // Sync User Groups - only insert if not exists
    const { data: userGroups, error: ugError } = await supabase.from('user_groups').select('*');
    if (ugError) throw ugError;
    if (userGroups) {
      const insertUG = db.prepare("INSERT OR IGNORE INTO user_groups (userId, groupId) VALUES (?, ?)");
      db.transaction(() => {
        for (const ug of userGroups) {
          insertUG.run(ug.userId, ug.groupId);
        }
      })();
      console.log(`Merged ${userGroups.length} user_groups from Supabase`);
    }

    // Sync Events - only insert if not exists
    const { data: events, error: eventsError } = await supabase.from('events').select('*');
    if (eventsError) throw eventsError;
    if (events) {
      const insertEvent = db.prepare(`
        INSERT OR IGNORE INTO events (id, title, description, date, endDate, startTime, endTime, userId, userName, isShared, type, systemGenerated, readOnly, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        for (const event of events) {
          insertEvent.run(
            event.id, event.title, event.description || null, event.date, event.endDate || null, 
            event.startTime || null, event.endTime || null, event.userId, event.userName, 
            event.isShared ? 1 : 0, event.type || 'event', event.systemGenerated ? 1 : 0, 
            event.readOnly ? 1 : 0, event.createdAt || new Date().toISOString()
          );
        }
      })();
      console.log(`Merged ${events.length} events from Supabase`);
    }

    // Sync Event Groups - only insert if not exists
    const { data: eventGroups, error: egError } = await supabase.from('event_groups').select('*');
    if (egError) throw egError;
    if (eventGroups) {
      const insertEG = db.prepare("INSERT OR IGNORE INTO event_groups (eventId, groupId) VALUES (?, ?)");
      db.transaction(() => {
        for (const eg of eventGroups) {
          insertEG.run(eg.eventId, eg.groupId);
        }
      })();
      console.log(`Merged ${eventGroups.length} event_groups from Supabase`);
    }

    // Sync Comments - only insert if not exists
    const { data: comments, error: commentsError } = await supabase.from('comments').select('*');
    if (commentsError) throw commentsError;
    if (comments) {
      const insertComment = db.prepare(`
        INSERT OR IGNORE INTO comments (id, eventId, userId, userName, text, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      db.transaction(() => {
        for (const comment of comments) {
          insertComment.run(
            comment.id, comment.eventId, comment.userId, comment.userName, comment.text, comment.createdAt || new Date().toISOString()
          );
        }
      })();
      console.log(`Merged ${comments.length} comments from Supabase`);
    }

    console.log("--- SYNC FROM SUPABASE COMPLETED ---");
  } catch (error) {
    console.error("--- SYNC FROM SUPABASE FAILED ---", error);
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Sync from Supabase on startup (now using INSERT OR IGNORE)
  await syncFromSupabase();

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
      console.log(`✅ Local user created: ${username} (${id})`);
      
      // Supabase backup
      try {
        const { data, error } = await supabase.from('users').insert([{ 
          id, 
          username, 
          password: hashedPassword, 
          isAdmin: false 
        }]);
        
        if (error) {
          console.error("❌ Supabase registration error:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
        } else {
          console.log(`✅ Supabase user created: ${username}`);
        }
      } catch (supabaseError) {
        console.error("❌ Supabase registration exception:", supabaseError);
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
      // Try local DB first
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

        // Update Supabase
        const supabaseUpdates: any = {};
        if (name !== undefined) supabaseUpdates.name = name;
        if (bio !== undefined) supabaseUpdates.bio = bio;
        if (themeColor !== undefined) supabaseUpdates.themeColor = themeColor;
        if (backgroundStyle !== undefined) supabaseUpdates.backgroundStyle = backgroundStyle;
        if (password) supabaseUpdates.password = await bcrypt.hash(password, 10);
        if (profileImage) supabaseUpdates.profileImage = profileImage;
        supabaseUpdates.updatedAt = new Date().toISOString();

        const { error: supabaseError } = await supabase.from('users').update(supabaseUpdates).eq('id', userId);
        if (supabaseError) console.error("Supabase profile update error:", supabaseError);
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
        await supabase.from('users').update({ username }).eq('id', userId);
      }
      
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, userId);
        await supabase.from('users').update({ password: hashedPassword }).eq('id', userId);
      }
      
      broadcast({ type: "USER_UPDATED", payload: { userId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to update user", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:userId", authenticate, adminOnly, async (req: any, res) => {
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

      // Supabase cleanup
      await supabase.from('events').delete().eq('userId', userId);
      await supabase.from('user_groups').delete().eq('userId', userId);
      await supabase.from('comments').delete().eq('userId', userId);
      await supabase.from('users').delete().eq('id', userId);

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

  app.post("/api/admin/groups", authenticate, adminOnly, async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Group name is required" });
    }
    
    try {
      const id = crypto.randomUUID();
      db.prepare("INSERT INTO groups (id, name) VALUES (?, ?)").run(id, name.trim());
      
      // Supabase
      await supabase.from('groups').insert([{ id, name: name.trim() }]);

      const newGroup = { id, name: name.trim(), createdAt: new Date().toISOString() };
      broadcast({ type: "GROUP_CREATED", payload: newGroup });
      
      res.status(201).json(newGroup);
    } catch (error) {
      console.error("Failed to create group:", error);
      res.status(500).json({ error: "Failed to create group" });
    }
  });

  app.post("/api/admin/groups/:groupId/members", authenticate, adminOnly, async (req, res) => {
    const { groupId } = req.params;
    const { userId, action } = req.body;
    
    if (!userId || !action || !['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: "Invalid request" });
    }
    
    try {
      if (action === 'add') {
        db.prepare("INSERT OR IGNORE INTO user_groups (userId, groupId) VALUES (?, ?)").run(userId, groupId);
        await supabase.from('user_groups').insert([{ userId, groupId }]);
      } else {
        db.prepare("DELETE FROM user_groups WHERE userId = ? AND groupId = ?").run(userId, groupId);
        await supabase.from('user_groups').delete().eq('userId', userId).eq('groupId', groupId);
      }
      broadcast({ type: "USER_UPDATED", payload: { userId } });
      res.json({ success: true });
    } catch (error) {
      console.error("Operation failed:", error);
      res.status(500).json({ error: "Operation failed" });
    }
  });

  app.delete("/api/admin/groups/:groupId", authenticate, adminOnly, async (req, res) => {
    const { groupId } = req.params;
    try {
      // First delete event associations
      db.prepare("DELETE FROM event_groups WHERE groupId = ?").run(groupId);
      
      // Delete user group associations
      db.prepare("DELETE FROM user_groups WHERE groupId = ?").run(groupId);
      
      // Finally delete the group
      const result = db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);

      // Supabase
      await supabase.from('event_groups').delete().eq('groupId', groupId);
      await supabase.from('user_groups').delete().eq('groupId', groupId);
      await supabase.from('groups').delete().eq('id', groupId);
      
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

  // --- SETTINGS ROUTES ---
  app.get("/api/settings", authenticate, adminOnly, (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM settings").all();
      const settingsObj = (settings as any[]).reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {});
      res.json(settingsObj);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", authenticate, adminOnly, (req, res) => {
    const { key, value } = req.body;
    try {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

// --- HOLIDAY ROUTES ---
app.get("/api/holidays/sync/:year", authenticate, async (req: any, res) => {
  const { year } = req.params;
  
  try {
    // First, delete existing holidays from local DB
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    db.prepare(`
      DELETE FROM events 
      WHERE systemGenerated = 1 
      AND type = 'public_holiday'
      AND date >= ? AND date <= ?
    `).run(startDate, endDate);

    let holidays = [];
    let apiSuccess = false;
    
    // Try Nager.Date API first
    try {
      console.log(`Fetching holidays for ${year} from Nager.Date API...`);
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/MY`);
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          holidays = data;
          apiSuccess = true;
          console.log(`Found ${holidays.length} holidays from Nager.Date API`);
        }
      }
    } catch (error) {
      console.error("Nager.Date API failed:", error);
    }

    // If Nager.Date API fails, try Calendarific as backup
    if (!apiSuccess) {
      try {
        console.log(`Trying Calendarific API for ${year}...`);
        const CALENDARIFIC_API_KEY = process.env.CALENDARIFIC_API_KEY;
        
        if (CALENDARIFIC_API_KEY) {
          const response = await fetch(
            `https://calendarific.com/api/v2/holidays?` +
            `api_key=${CALENDARIFIC_API_KEY}&` +
            `country=MY&` +
            `year=${year}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data.response && data.response.holidays) {
              holidays = data.response.holidays.map((h: any) => ({
                date: h.date.iso,
                localName: h.name,
                name: h.description || h.name
              }));
              apiSuccess = true;
              console.log(`Found ${holidays.length} holidays from Calendarific API`);
            }
          }
        }
      } catch (error) {
        console.error("Calendarific API failed:", error);
      }
    }

    // If both APIs fail, use fallback data
    if (!apiSuccess) {
      console.log(`Using fallback holiday data for ${year}`);
      
      // Malaysia public holidays fallback
      if (year === "2026") {
        holidays = [
          { date: "2026-01-01", localName: "New Year's Day", name: "New Year's Day" },
          { date: "2026-02-17", localName: "Chinese New Year", name: "Chinese New Year" },
          { date: "2026-02-18", localName: "Chinese New Year Holiday", name: "Chinese New Year Holiday" },
          { date: "2026-03-20", localName: "Hari Raya Puasa", name: "Eid al-Fitr" },
          { date: "2026-03-21", localName: "Hari Raya Puasa Day 2", name: "Eid al-Fitr Day 2" },
          { date: "2026-05-01", localName: "Labour Day", name: "Labour Day" },
          { date: "2026-05-27", localName: "Hari Raya Haji", name: "Eid al-Adha" },
          { date: "2026-06-01", localName: "Agong's Birthday", name: "Yang di-Pertuan Agong's Birthday" },
          { date: "2026-06-17", localName: "Awal Muharram", name: "Islamic New Year" },
          { date: "2026-08-31", localName: "National Day", name: "Hari Merdeka" },
          { date: "2026-09-16", localName: "Malaysia Day", name: "Malaysia Day" },
          { date: "2026-11-08", localName: "Deepavali", name: "Deepavali" },
          { date: "2026-12-25", localName: "Christmas Day", name: "Christmas Day" }
        ];
      } else if (year === "2025") {
        holidays = [
          { date: "2025-01-01", localName: "New Year's Day", name: "New Year's Day" },
          { date: "2025-01-29", localName: "Chinese New Year", name: "Chinese New Year" },
          { date: "2025-01-30", localName: "Chinese New Year Holiday", name: "Chinese New Year Holiday" },
          { date: "2025-03-31", localName: "Hari Raya Puasa", name: "Eid al-Fitr" },
          { date: "2025-04-01", localName: "Hari Raya Puasa Day 2", name: "Eid al-Fitr Day 2" },
          { date: "2025-05-01", localName: "Labour Day", name: "Labour Day" },
          { date: "2025-06-02", localName: "Agong's Birthday", name: "Yang di-Pertuan Agong's Birthday" },
          { date: "2025-06-07", localName: "Hari Raya Haji", name: "Eid al-Adha" },
          { date: "2025-06-27", localName: "Awal Muharram", name: "Islamic New Year" },
          { date: "2025-08-31", localName: "National Day", name: "Hari Merdeka" },
          { date: "2025-09-16", localName: "Malaysia Day", name: "Malaysia Day" },
          { date: "2025-10-20", localName: "Deepavali", name: "Deepavali" },
          { date: "2025-12-25", localName: "Christmas Day", name: "Christmas Day" }
        ];
      }
    }

    if (!holidays.length) {
      return res.json({ message: "No holidays found", count: 0 });
    }

    // Insert holidays into local database
    const insertHoliday = db.prepare(`
      INSERT INTO events 
      (id, title, description, date, endDate, userId, userName, isShared, type, systemGenerated, readOnly) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let insertedCount = 0;
    
    holidays.forEach((holiday: any) => {
      const safeName = holiday.localName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 50);
      const id = `holiday-${holiday.date}-${safeName}`;
      
      try {
        insertHoliday.run(
          id,
          holiday.localName,
          holiday.name || holiday.localName,
          holiday.date,
          holiday.date,
          'system',
          'System',
          1,
          'public_holiday',
          1,
          1
        );
        insertedCount++;
        console.log(`✅ Inserted holiday: ${holiday.localName} on ${holiday.date}`);
      } catch (err) {
        console.error(`Failed to insert holiday ${holiday.localName}:`, err);
      }
    });

    // Also sync to Supabase
    try {
      const holidayInserts = holidays.map((holiday: any) => ({
        id: `holiday-${holiday.date}-${holiday.localName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().substring(0, 50)}`,
        title: holiday.localName,
        description: holiday.name || holiday.localName,
        date: holiday.date,
        endDate: holiday.date,
        userId: 'system',
        userName: 'System',
        isShared: true,
        type: 'public_holiday',
        systemGenerated: true,
        readOnly: true
      }));
      
      const { error } = await supabase.from('events').upsert(holidayInserts);
      if (error) {
        console.error("Failed to sync holidays to Supabase:", error);
      } else {
        console.log(`✅ Synced ${holidayInserts.length} holidays to Supabase`);
      }
    } catch (supabaseError) {
      console.error("Supabase sync error:", supabaseError);
    }

    console.log(`✅ Total ${insertedCount} holidays synced for ${year}`);
    res.json({ 
      message: `Synced ${insertedCount} holidays for ${year}`, 
      count: insertedCount,
      source: apiSuccess ? "API" : "Fallback"
    });
    
  } catch (error) {
    console.error("Holiday sync error:", error);
    res.json({ message: "Could not fetch holidays", count: 0 });
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

  app.post("/api/events", authenticate, async (req: any, res) => {
    const { id, title, description, date, endDate, startTime, endTime, groupIds } = req.body;
    const userId = req.user.id;
    const userName = req.user.username;
    
    console.log(`📝 Creating event "${title}" for user ${userName} (${userId})`);
    
    try {
      if (groupIds && Array.isArray(groupIds)) {
        for (const gId of groupIds) {
          const isMember = db.prepare("SELECT 1 FROM user_groups WHERE userId = ? AND groupId = ?").get(userId, gId);
          if (!isMember) {
            console.warn(`⚠️ User ${userName} not a member of group ${gId}`);
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

      // Local SQLite transaction
      const transaction = db.transaction(() => {
        insertEvent.run(id, title, description, startDateStr, endDateStr, startTime || null, endTime || null, userId, userName, isShared ? 1 : 0);
        if (isShared) {
          for (const gId of groupIds) {
            insertEventGroup.run(id, gId);
          }
        }
      });

      transaction();
      console.log(`✅ Local event created: ${title} (${id})`);

      // Supabase sync - ALWAYS try to sync, create user if needed
      try {
        console.log(`🔄 Attempting to sync event to Supabase...`);
        
        // First, check if the user exists in Supabase, if not create them
        const { data: userCheck, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();
        
        if (userError) {
          console.log(`⚠️ User ${userId} not found in Supabase, creating user first...`);
          
          // Get user data from local DB
          const localUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
          if (localUser) {
            const { error: createUserError } = await supabase
              .from('users')
              .insert([{
                id: localUser.id,
                username: localUser.username,
                password: localUser.password,
                name: localUser.name,
                bio: localUser.bio,
                profileImage: localUser.profileImage,
                themeColor: localUser.themeColor,
                backgroundStyle: localUser.backgroundStyle,
                isAdmin: !!localUser.isAdmin,
                role: localUser.role,
                createdAt: localUser.createdAt,
                updatedAt: localUser.updatedAt
              }]);
            
            if (createUserError) {
              console.error("❌ Failed to create user in Supabase:", createUserError);
            } else {
              console.log(`✅ User ${userId} created in Supabase`);
            }
          }
        }
        
        // Now try to insert the event again
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .insert([{
            id, 
            title, 
            description, 
            date: startDateStr, 
            endDate: endDateStr, 
            startTime: startTime || null, 
            endTime: endTime || null, 
            userId, 
            userName, 
            isShared: !!isShared
          }])
          .select();
        
        if (eventError) {
          console.error("❌ Supabase event insert error:", {
            code: eventError.code,
            message: eventError.message,
            details: eventError.details,
            hint: eventError.hint
          });
        } else {
          console.log(`✅ Supabase event created:`, eventData);
          
          // Insert event_groups if shared
          if (isShared && groupIds.length > 0) {
            const egInserts = groupIds.map((gId: string) => ({ 
              eventId: id, 
              groupId: gId 
            }));
            
            console.log(`🔄 Inserting ${egInserts.length} event_group relations to Supabase...`);
            
            const { data: egData, error: egError } = await supabase
              .from('event_groups')
              .insert(egInserts)
              .select();
            
            if (egError) {
              console.error("❌ Supabase event_groups insert error:", {
                code: egError.code,
                message: egError.message,
                details: egError.details,
                hint: egError.hint
              });
            } else {
              console.log(`✅ Supabase event_groups created:`, egData);
            }
          }
        }
      } catch (supabaseError) {
        console.error("❌ Supabase exception during event sync:", supabaseError);
      }

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
      console.log(`✅ Event creation complete, returning success to client`);
      res.status(201).json(newEvent);
      
    } catch (error) {
      console.error("❌ Failed to create event:", error);
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.put("/api/events/:id", authenticate, async (req: any, res) => {
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

      // Supabase
      await supabase.from('events').update({
        title, description, date: startDateStr, endDate: endDateStr,
        startTime: startTime || null, endTime: endTime || null,
        isShared: !!isShared
      }).eq('id', id);
      await supabase.from('event_groups').delete().eq('eventId', id);
      if (isShared) {
        const egInserts = groupIds.map((gId: string) => ({ eventId: id, groupId: gId }));
        await supabase.from('event_groups').insert(egInserts);
      }

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

  app.delete("/api/events/:id", authenticate, async (req: any, res) => {
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

      // Supabase
      await supabase.from('event_groups').delete().eq('eventId', id);
      await supabase.from('comments').delete().eq('eventId', id);
      await supabase.from('events').delete().eq('id', id);

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

  app.post("/api/events/:id/comments", authenticate, async (req: any, res) => {
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
      
      // Try Supabase
      try {
        await supabase.from('comments').insert([{
          id: commentId, eventId: id, userId, userName, text
        }]);
        console.log(`✅ Supabase comment created`);
      } catch (supabaseError) {
        console.error("❌ Failed to sync comment to Supabase:", supabaseError);
      }
      
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

  app.delete("/api/events/:eventId/comments/:commentId", authenticate, async (req: any, res) => {
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
      
      // Supabase
      try {
        await supabase.from('comments').delete().eq('id', commentId);
      } catch (supabaseError) {
        console.error("❌ Failed to delete comment from Supabase:", supabaseError);
      }
      
      const countResult = db.prepare("SELECT COUNT(*) as count FROM comments WHERE eventId = ?").get(eventId) as any;
      const newCount = countResult ? countResult.count : 0;

      broadcast({ type: "COMMENT_DELETED", payload: { eventId, commentId, newCount } });
      res.status(204).send();
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // --- PUBLIC TEST ROUTES ---
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: Date.now(),
      supabase_configured: true
    });
  });

  app.get("/api/test/supabase-public", async (req, res) => {
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(5);
      
      res.json({
        status: "ok",
        supabase_connected: !usersError,
        users_sample: users,
        error: usersError
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: String(error)
      });
    }
  });

  // Add this temporary test route to manually sync holidays
  app.get("/api/test/sync-holidays/:year", authenticate, async (req: any, res) => {
    const { year } = req.params;
    
    try {
      // Get the base URL dynamically
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      console.log(`🔍 Manually syncing holidays for ${year}...`);
      
      // Call the holiday sync function
      const response = await fetch(`${baseUrl}/api/holidays/sync/${year}`, {
        headers: {
          'Cookie': req.headers.cookie || ''
        }
      });
      
      const data = await response.json();
      console.log(`✅ Manual sync result:`, data);
      res.json(data);
    } catch (error) {
      console.error("❌ Manual sync error:", error);
      res.status(500).json({ error: String(error) });
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