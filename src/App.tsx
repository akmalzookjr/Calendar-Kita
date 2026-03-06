import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO,
  isToday,
  isWithinInterval,
  startOfDay,
  endOfDay,
  differenceInDays
} from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Users, 
  Lock, 
  Trash2, 
  Calendar as CalendarIcon,
  User,
  X,
  Check,
  Edit2,
  LogOut,
  Shield,
  UserPlus,
  UserMinus,
  Settings,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  Timer,
  Search,
  Filter,
  Camera,
  Save,
  ArrowLeft,
  Moon,
  Sun,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const calculateDuration = (start?: string, end?: string) => {
  if (!start || !end) return null;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (diffMinutes < 0) diffMinutes += 24 * 60; // Handle overnight
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const formatTime = (time?: string) => {
  if (!time) return "";
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

const getCountdown = (eventDate: string) => {
  const now = new Date();
  const target = parseISO(eventDate);
  const diff = differenceInDays(startOfDay(target), startOfDay(now));
  
  if (diff < 0) return "Passed";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff} days to go`;
};

function AuthView({ onLogin }: { onLogin: (user: UserProfile) => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok) {
        if (isRegister) {
          setIsRegister(false);
          setError("Registration successful! Please login.");
        } else {
          onLogin(data);
        }
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans relative bg-stone-50 dark:bg-stone-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-stone-900 p-8 rounded-3xl shadow-xl max-w-md w-full border border-stone-200 dark:border-stone-800"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
            <CalendarIcon size={32} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-stone-900 dark:text-white mb-2">Calendar Kita</h1>
        <p className="text-stone-500 dark:text-stone-400 text-center mb-8">
          {isRegister ? "Create an account to start planning" : "Login to access your family calendar"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className={cn(
              "p-3 rounded-xl text-sm font-medium text-center",
              error.includes("successful") ? "bg-accent/10 text-accent" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
            )}>
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
              placeholder="Enter username"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
              placeholder="Enter password"
              required
            />
          </div>
          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isRegister ? "Register" : "Login")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-brand transition-colors"
          >
            {isRegister ? "Already have an account? Login" : "Don't have an account? Register"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AdminView({ user, onBack }: { user: UserProfile, onBack: () => void }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState("");
  const [editUserData, setEditUserData] = useState<{ userId: string, username: string } | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userToDelete, setUserToDelete] = useState<{ id: string, username: string } | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<{ id: string, name: string } | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [usersRes, groupsRes, settingsRes] = await Promise.all([
        fetch("/api/admin/users", { credentials: "include" }),
        fetch("/api/admin/groups", { credentials: "include" }),
        fetch("/api/settings", { credentials: "include" })
      ]);
      
      if (usersRes.status === 401) {
        onBack();
        return;
      }

      const usersData = await usersRes.json();
      const groupsData = await groupsRes.json();
      const settingsData = await settingsRes.json();

      if (usersRes.ok && Array.isArray(usersData)) setUsers(usersData);
      if (groupsRes.ok && Array.isArray(groupsData)) setGroups(groupsData);
      if (settingsRes.ok) setSettings(settingsData);
    } catch (e) {
      console.error("Failed to fetch admin data", e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
        credentials: "include"
      });
      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: value }));
      }
    } catch (e) {
      console.error("Failed to update setting", e);
    }
  };

  const handleSyncHolidays = async () => {
    setIsSyncingHolidays(true);
    try {
      const year = new Date().getFullYear();
      
      const res = await fetch(`/api/holidays/sync/${year}`, { credentials: "include" });
      const data = await res.json();
      
      if (res.ok) {
        if (data.count > 0) {
          alert(`Successfully synced ${data.count} holidays from ${data.source}!`);
        } else {
          alert(`No holidays found for ${year}. ${data.message || ''}`);
        }
        // Refresh events to show holidays
        window.location.reload();
      } else {
        alert("Failed to sync holidays: " + (data.message || "Unknown error"));
      }
    } catch (e) {
      console.error("Sync failed", e);
      alert("Network error during holiday sync.");
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up WebSocket for real-time updates in Admin View
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // For admin view, we can just re-fetch data when relevant changes occur
      // This ensures we always have the latest state including group memberships
      if (
        data.type === "USER_REGISTERED" || 
        data.type === "USER_UPDATED" || 
        data.type === "USER_DELETED" ||
        data.type === "GROUP_CREATED" ||
        data.type === "GROUP_DELETED"
      ) {
        fetchData(true);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const res = await fetch("/api/admin/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName }),
        credentials: "include"
      });
      if (res.ok) {
        setNewGroupName("");
        fetchData();
      }
    } catch (e) {
      console.error("Failed to create group", e);
    }
  };

  const toggleGroupMember = async (userId: string, groupId: string, isMember: boolean) => {
    try {
      const res = await fetch(`/api/admin/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: isMember ? 'remove' : 'add' }),
        credentials: "include"
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error("Toggle failed", e);
    }
  };
  
  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      const res = await fetch(`/api/admin/groups/${groupToDelete.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        setGroupToDelete(null);
        fetchData();
      } else {
        const data = await res.json();
        alert("Failed to delete group: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Delete group failed", e);
    }
  };

  const handleUpdateUser = async () => {
    if (!editUserData) return;
    try {
      const res = await fetch(`/api/admin/users/${editUserData.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: newUsername !== editUserData.username ? newUsername : undefined, 
          password: newPassword.trim() || undefined 
        }),
        credentials: "include"
      });
      if (res.ok) {
        alert(`User ${editUserData.username} has been updated.`);
        setEditUserData(null);
        setNewUsername("");
        setNewPassword("");
        fetchData();
      } else {
        const data = await res.json();
        alert("Update failed: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Update failed", e);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (res.ok) {
        setUserToDelete(null);
        fetchData();
      } else {
        const data = await res.json();
        alert("Failed to delete user: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  return (
    <div className="min-h-screen bg-transparent font-sans pb-20">
      <header className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-400 dark:text-stone-500">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold tracking-tight dark:text-white">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Group Management */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="p-6 border-b border-stone-100 dark:border-stone-800 bg-accent/5 dark:bg-accent/10">
            <h2 className="text-xl font-semibold text-stone-800 dark:text-white">Calendar Groups</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">Create groups like "Family", "Partner", or "Work".</p>
            
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="New Group Name (e.g. Partner)"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-sm"
              />
              <button 
                onClick={handleCreateGroup}
                className="px-6 py-2 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20 flex items-center gap-2"
              >
                <Plus size={16} />
                Create Group
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {groups.map(group => (
                <div key={group.id} className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 border border-stone-100 dark:border-stone-800">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-accent/10 text-accent rounded-lg">
                        <Users size={18} />
                      </div>
                      <h3 className="font-bold text-stone-800 dark:text-white">{group.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setGroupToDelete({ id: group.id, name: group.name })}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-all"
                        title="Delete Group"
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                        {users.filter(u => u.groups.some(g => g.id === group.id)).length} Members
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {users.map(u => {
                      const isMember = u.groups.some(g => g.id === group.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-2 bg-white dark:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700 text-xs">
                          <span className="font-medium text-stone-600 dark:text-stone-300">{u.username}</span>
                          <button 
                            onClick={() => toggleGroupMember(u.id, group.id, isMember)}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              isMember ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" : "bg-accent/10 text-accent"
                            )}
                          >
                            {isMember ? <UserMinus size={14} /> : <UserPlus size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Management & Password Reset */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="p-6 border-b border-stone-100 dark:border-stone-800">
            <h2 className="text-xl font-semibold text-stone-800 dark:text-white">User Management</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">Manage all users and reset forgotten passwords.</p>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : users.map(u => (
              <div key={u.id} className="p-4 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center text-stone-400 dark:text-stone-500">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="font-semibold text-stone-800 dark:text-white flex items-center gap-2">
                      {u.username}
                      <span className="px-1.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase rounded border border-stone-200 dark:border-stone-700">
                        {u.role || (u.isAdmin ? 'Admin' : 'User')}
                      </span>
                      {u.isAdmin && <Shield size={12} className="text-accent" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.groups.map(g => (
                        <span key={g.id} className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-700 text-[9px] font-bold text-stone-500 dark:text-stone-400 uppercase rounded">
                          {g.name}
                        </span>
                      ))}
                      {u.groups.length === 0 && (
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 italic">No groups assigned</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditUserData({ userId: u.id, username: u.username });
                      setNewUsername(u.username);
                      setNewPassword("");
                    }}
                    className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center gap-2"
                  >
                    <Settings size={14} />
                    Edit User
                  </button>
                  {u.id !== user.id && u.id !== "admin-id" && (
                    <button 
                      onClick={() => setUserToDelete({ id: u.id, username: u.username })}
                      className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Settings */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
          <div className="p-6 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/50">
            <h2 className="text-xl font-semibold text-stone-800 dark:text-white">System Settings</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">Global application configuration.</p>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-stone-800 dark:text-white">Holiday Country Code</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">ISO 3166-1 alpha-2 code (e.g., MY, US, GB, ID).</p>
              </div>
              <div className="flex gap-2">
                <input 
                  type="text"
                  maxLength={2}
                  value={settings.holidayCountryCode || ""}
                  onChange={(e) => handleUpdateSetting("holidayCountryCode", e.target.value.toUpperCase())}
                  className="w-20 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent outline-none text-center font-bold uppercase"
                  placeholder="MY"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-800">
              <div>
                <h3 className="font-bold text-stone-800 dark:text-white">Manual Holiday Sync</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">Force fetch latest holidays from the API for the current year.</p>
              </div>
              <button 
              onClick={handleSyncHolidays}
              disabled={isSyncingHolidays}
              className="px-6 py-2.5 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-accent/20"
            >
                {isSyncingHolidays ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Timer size={16} />}
                {isSyncingHolidays ? "Syncing..." : "Sync Now"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editUserData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditUserData(null)}
              className="absolute inset-0 bg-stone-900/40 dark:bg-stone-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-sm max-h-[calc(100dvh-32px)] flex flex-col overflow-hidden border border-stone-200 dark:border-stone-800"
            >
              <div className="p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-bold text-stone-800 dark:text-white">Edit User</h3>
                <button onClick={() => setEditUserData(null)} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-400 dark:text-stone-500">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Update details for <span className="font-bold text-stone-800 dark:text-white">{editUserData.username}</span>.
                </p>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1 ml-1">Username</label>
                  <input 
                    type="text"
                    placeholder="New Username"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1 ml-1">New Password (optional)</label>
                  <input 
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent outline-none transition-all"
                  />
                </div>
              </div>
              <div className="p-5 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/50 flex gap-3 shrink-0">
                <button 
                  onClick={() => setEditUserData(null)}
                  className="flex-1 py-3 text-stone-600 dark:text-stone-300 font-bold text-sm hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateUser}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserToDelete(null)}
              className="absolute inset-0 bg-stone-900/40 dark:bg-stone-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-stone-200 dark:border-stone-800"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-red-50 dark:bg-red-900/20">
                <h3 className="text-lg font-bold text-red-800 dark:text-red-400">Delete User?</h3>
                <button onClick={() => setUserToDelete(null)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors text-red-400 dark:text-red-500">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle size={20} className="shrink-0" />
                  <p>
                    Are you sure you want to delete user <span className="font-bold text-stone-900 dark:text-white">"{userToDelete.username}"</span>? 
                    This will forcefully delete all their events and group associations. This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setUserToDelete(null)}
                    className="flex-1 py-3 text-stone-600 dark:text-stone-300 font-bold text-sm hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteUser}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-100 dark:shadow-red-900/20"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Group Delete Confirmation Modal */}
      <AnimatePresence>
        {groupToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setGroupToDelete(null)}
              className="absolute inset-0 bg-stone-900/40 dark:bg-stone-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-stone-200 dark:border-stone-800"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-red-50 dark:bg-red-900/20">
                <h3 className="text-lg font-bold text-red-800 dark:text-red-400">Delete Group?</h3>
                <button onClick={() => setGroupToDelete(null)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors text-red-400 dark:text-red-500">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-700 dark:text-red-400 text-sm">
                  <AlertCircle size={20} className="shrink-0" />
                  <p>
                    Are you sure you want to delete <span className="font-bold text-stone-900 dark:text-white">"{groupToDelete.name}"</span>? 
                    This will forcefully delete all events and user associations within this group. This action cannot be undone.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setGroupToDelete(null)}
                    className="flex-1 py-3 text-stone-600 dark:text-stone-300 font-bold text-sm hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteGroup}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-100 dark:shadow-red-900/20"
                  >
                    Delete Forcefully
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Group {
  id: string;
  name: string;
}

interface Comment {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  profileImage?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  userId: string;
  userName: string;
  isShared: boolean;
  groupIds: string[];
  type?: string;
  systemGenerated?: boolean;
  readOnly?: boolean;
  commentCount?: number;
  profileImage?: string;
}

interface UserProfile {
  id: string;
  username: string;
  name?: string;
  bio?: string;
  profileImage?: string;
  role: string;
  isAdmin: boolean;
  groups: Group[];
  createdAt?: string;
  updatedAt?: string;
  themeColor?: string;
  accentColor?: string;
  backgroundStyle?: string;
}

function MyPlansListView({ 
  user, 
  events, 
  onBack, 
  onEdit, 
  onDelete,
  onViewDetail
}: { 
  user: UserProfile, 
  events: CalendarEvent[], 
  onBack: () => void,
  onEdit: (event: CalendarEvent) => void,
  onDelete: (id: string) => void,
  onViewDetail: (event: CalendarEvent) => void
}) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "title">("date");

  const myEvents = useMemo(() => {
    return events
      .filter(e => e.userId === user.id)
      .filter(e => 
        e.title.toLowerCase().includes(search.toLowerCase()) || 
        (e.description || "").toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === "date") return a.date.localeCompare(b.date);
        return a.title.localeCompare(b.title);
      });
  }, [events, user.id, search, sortBy]);

  return (
    <div className="min-h-screen bg-transparent font-sans pb-20">
      <header className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-400 dark:text-stone-500">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-bold tracking-tight dark:text-white">My Plans</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
              <input 
                type="text"
                placeholder="Search my plans..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs focus:ring-2 focus:ring-brand outline-none w-48"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="sm:hidden relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
            <input 
              type="text"
              placeholder="Search my plans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl text-sm focus:ring-2 focus:ring-brand outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Sort by:</span>
            <button 
              onClick={() => setSortBy("date")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                sortBy === "date" ? "bg-brand text-white" : "bg-white dark:bg-stone-900 text-stone-500 border border-stone-200 dark:border-stone-800"
              )}
            >
              Date
            </button>
            <button 
              onClick={() => setSortBy("title")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                sortBy === "title" ? "bg-brand text-white" : "bg-white dark:bg-stone-900 text-stone-500 border border-stone-200 dark:border-stone-800"
              )}
            >
              Title
            </button>
          </div>
          
          <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
            Showing {myEvents.length} Plans
          </div>
        </div>

        <div className="space-y-4">
          {myEvents.length === 0 ? (
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-12 text-center border border-stone-200 dark:border-stone-800">
              <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-4 text-stone-300 dark:text-stone-600">
                <CalendarIcon size={32} />
              </div>
              <h3 className="text-lg font-bold text-stone-800 dark:text-white mb-1">No plans found</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">You haven't added any plans that match your search.</p>
              <button 
                onClick={onBack}
                className="px-6 py-2 bg-brand text-white rounded-xl font-bold text-sm hover:bg-brand-hover transition-colors"
              >
                Go to Calendar
              </button>
            </div>
          ) : (
            myEvents.map(event => (
              <motion.div 
                key={event.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm hover:border-brand/30 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 bg-brand/10 rounded-2xl flex flex-col items-center justify-center text-brand shrink-0 border border-brand/20">
                          <span className="text-[10px] font-bold uppercase leading-none mb-1">{format(parseISO(event.date), "MMM")}</span>
                          <span className="text-lg font-black leading-none">{format(parseISO(event.date), "d")}</span>
                        </div>
                        {event.profileImage && (
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-stone-900 overflow-hidden shadow-sm">
                            <img src={event.profileImage} alt={event.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                      <div>
                      <h3 className="font-bold text-stone-800 dark:text-white group-hover:text-brand transition-colors">{event.title}</h3>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                          <Clock size={14} className="text-stone-400" />
                          {event.startTime ? `${formatTime(event.startTime)} ${event.endTime ? `– ${formatTime(event.endTime)}` : ''}` : 'All Day'}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                          {event.isShared ? (
                            <div className="flex items-center gap-1 text-brand font-bold uppercase text-[10px] tracking-wider">
                              <Users size={12} />
                              Shared
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-stone-400 dark:text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                              <Lock size={12} />
                              Private
                            </div>
                          )}
                        </div>
                        {(event.commentCount || 0) > 0 && (
                          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold uppercase text-[10px] tracking-wider">
                            <MessageSquare size={12} />
                            {event.commentCount} Comments
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 md:self-center">
                    <button 
                      onClick={() => onViewDetail(event)}
                      className="flex-1 md:flex-none px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Eye size={14} />
                      Details
                    </button>
                    <button 
                      onClick={() => onEdit(event)}
                      className="flex-1 md:flex-none px-4 py-2 bg-brand/10 text-brand rounded-xl text-xs font-bold hover:bg-brand/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button 
                      onClick={() => onDelete(event.id)}
                      className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {event.description && (
                  <p className="mt-3 text-sm text-stone-500 dark:text-stone-400 line-clamp-2 pl-16">
                    {event.description}
                  </p>
                )}
              </motion.div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function ProfileView({ user, onUpdate, onBack, darkMode, onToggleDarkMode }: { user: UserProfile, onUpdate: (user: UserProfile) => void, onBack: () => void, darkMode: boolean, onToggleDarkMode: () => void }) {
  const [name, setName] = useState(user.name || "");
  const [bio, setBio] = useState(user.bio || "");
  const [password, setPassword] = useState("");
  const [themeColor, setThemeColor] = useState(user.themeColor || "#10b981");
  const [accentColor, setAccentColor] = useState(user.accentColor || "#10b981");
  const [backgroundStyle, setBackgroundStyle] = useState(user.backgroundStyle || "default");
  const [imagePreview, setImagePreview] = useState<string | null>(user.profileImage || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const darken = (hex: string, percent: number) => {
      try {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
      } catch (e) { return hex; }
    };

    const root = document.documentElement;
    root.style.setProperty('--brand-color', themeColor);
    root.style.setProperty('--brand-color-hover', darken(themeColor, 15));
    root.style.setProperty('--accent-color', accentColor);
    root.style.setProperty('--accent-color-hover', darken(accentColor, 15));
  }, [themeColor, accentColor]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('bio', bio);
    formData.append('themeColor', themeColor);
    formData.append('accentColor', accentColor);
    formData.append('backgroundStyle', backgroundStyle);
    if (password) formData.append('password', password);
    if (imageFile) formData.append('profileImage', imageFile);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        onUpdate(data);
        setPassword("");
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-white dark:hover:bg-stone-900 rounded-xl transition-colors text-stone-600 dark:text-stone-400 shadow-sm border border-transparent dark:border-stone-800"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-white">My Profile</h1>
          </div>
          <button 
            onClick={onToggleDarkMode}
            className="p-3 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-sm text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200 dark:border-stone-800 overflow-hidden"
        >
          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {message && (
              <div className={cn(
                "p-4 rounded-2xl text-sm font-medium flex items-center gap-3",
                message.type === 'success' ? "bg-accent/10 text-accent border border-accent/20" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-800"
              )}>
                {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                {message.text}
              </div>
            )}

            <div className="flex flex-col items-center gap-4">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-stone-100 dark:border-stone-800 shadow-inner bg-stone-50 dark:bg-stone-800 flex items-center justify-center">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={64} className="text-stone-300 dark:text-stone-600" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-accent text-white rounded-full shadow-lg cursor-pointer hover:bg-accent-hover transition-colors">
                  <Camera size={20} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1">Account Role</p>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-100 dark:bg-stone-800 rounded-full text-stone-600 dark:text-stone-300 text-xs font-bold border border-stone-200 dark:border-stone-700">
                  <Shield size={12} />
                  {user.role}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Username</label>
                <input 
                  type="text" 
                  value={user.username} 
                  disabled 
                  className="w-full px-4 py-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-500 cursor-not-allowed"
                />
                <p className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">Username cannot be changed</p>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Display Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Bio</label>
              <textarea 
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all resize-none"
                placeholder="Tell us about yourself..."
              />
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Primary Theme Color</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { name: 'Emerald', color: '#10b981' },
                  { name: 'Blue', color: '#3b82f6' },
                  { name: 'Violet', color: '#8b5cf6' },
                  { name: 'Rose', color: '#f43f5e' },
                  { name: 'Amber', color: '#f59e0b' },
                  { name: 'Indigo', color: '#6366f1' },
                  { name: 'Slate', color: '#475569' },
                  { name: 'Orange', color: '#f97316' },
                  { name: 'Cyan', color: '#06b6d4' },
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setThemeColor(c.color)}
                    className={cn(
                      "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shadow-sm",
                      themeColor === c.color ? "border-stone-900 dark:border-white scale-110" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  >
                    {themeColor === c.color && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Button & Card Color (Accent)</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { name: 'Emerald', color: '#10b981' },
                  { name: 'Blue', color: '#3b82f6' },
                  { name: 'Violet', color: '#8b5cf6' },
                  { name: 'Rose', color: '#f43f5e' },
                  { name: 'Amber', color: '#f59e0b' },
                  { name: 'Indigo', color: '#6366f1' },
                  { name: 'Slate', color: '#475569' },
                  { name: 'Orange', color: '#f97316' },
                  { name: 'Cyan', color: '#06b6d4' },
                ].map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setAccentColor(c.color)}
                    className={cn(
                      "w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center shadow-sm",
                      accentColor === c.color ? "border-stone-900 dark:border-white scale-110" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  >
                    {accentColor === c.color && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Background Style</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'default', name: 'Classic', desc: 'Clean & Simple' },
                  { id: 'soft', name: 'Soft', desc: 'Pastel Tones' },
                  { id: 'glass', name: 'Glass', desc: 'Modern Blur' },
                  { id: 'vibrant', name: 'Vibrant', desc: 'Bold Colors' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setBackgroundStyle(s.id)}
                    className={cn(
                      "p-3 rounded-2xl border-2 transition-all text-left flex flex-col gap-1",
                      backgroundStyle === s.id 
                        ? "border-accent bg-accent/5 ring-4 ring-accent/5" 
                        : "border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/50 hover:border-stone-200 dark:hover:border-stone-700"
                    )}
                  >
                    <span className={cn("text-xs font-bold", backgroundStyle === s.id ? "text-accent" : "text-stone-700 dark:text-stone-200")}>{s.name}</span>
                    <span className="text-[9px] text-stone-400 dark:text-stone-500 font-medium uppercase tracking-tighter">{s.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">New Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                  placeholder="Leave blank to keep current"
                />
                <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-300 dark:text-stone-600" />
              </div>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">No strength requirements. Change anytime.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-4">
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-1 py-4 bg-accent text-white rounded-2xl font-bold hover:bg-accent-hover disabled:opacity-50 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
              >
                {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
                {isSaving ? "Saving Changes..." : "Save Profile"}
              </button>
              <button 
                type="button"
                onClick={onBack}
                className="flex-1 py-4 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all border border-transparent dark:border-stone-700"
              >
                Cancel
              </button>
            </div>

            {(user.createdAt || user.updatedAt) && (
              <div className="pt-8 border-t border-stone-100 dark:border-stone-800 flex flex-col md:flex-row justify-between gap-4 text-[10px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-widest">
                {user.createdAt && <span>Created: {format(parseISO(user.createdAt), "MMM d, yyyy")}</span>}
                {user.updatedAt && <span>Last Updated: {format(parseISO(user.updatedAt), "MMM d, yyyy HH:mm")}</span>}
              </div>
            )}
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function Toast({ message, onClose }: { message: string, onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: 20, x: "-50%" }}
      className="fixed bottom-8 left-1/2 z-[100] bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-500"
    >
      <AlertCircle size={20} />
      <span className="font-bold text-sm tracking-tight">{message}</span>
    </motion.div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "admin" | "profile" | "list">("calendar");
  const [toast, setToast] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const darken = (hex: string, percent: number) => {
      try {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
      } catch (e) { return hex; }
    };

    const root = document.documentElement;
    const color = user?.themeColor || '#10b981';
    const accent = user?.accentColor || '#10b981';
    
    root.style.setProperty('--brand-color', color);
    root.style.setProperty('--brand-color-hover', darken(color, 15));
    root.style.setProperty('--accent-color', accent);
    root.style.setProperty('--accent-color-hover', darken(accent, 15));
  }, [user?.themeColor, user?.accentColor]);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarEvent | null>(null);
  const selectedEventIdRef = useRef<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDateDetailModalOpen, setIsDateDetailModalOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isFetchingComments, setIsFetchingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPerson, setFilterPerson] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    isShared: false,
    groupIds: [] as string[],
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    startTime: "",
    endTime: "",
    hasTime: false,
  });

  const ws = useRef<WebSocket | null>(null);

const checkAuth = async (retryCount = 0) => {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.ok) {
      const userData = await res.json();
      setUser(userData);
    } else if (res.status === 401 && retryCount < 3) {
      // Retry up to 3 times with increasing delays
      setTimeout(() => checkAuth(retryCount + 1), 500 * (retryCount + 1));
    }
  } catch (e) {
    console.error("Auth check failed", e);
  } finally {
    setIsLoading(false);
  }
};

// Auth Check
useEffect(() => {
  checkAuth();
}, []);

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  // Auto-scroll to bottom of comments
  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments]);

  const fetchEvents = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/events", { credentials: "include" });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setEvents(data.map((e: any) => ({ 
          ...e, 
          isShared: !!e.isShared, 
          date: e.date.split('T')[0],
          endDate: (e.endDate || e.date).split('T')[0],
          startTime: e.startTime || "",
          endTime: e.endTime || ""
        })));
      } else {
        console.error("Failed to fetch events", data.error || "Unknown error");
        setEvents([]);
      }
    } catch (error) {
      console.error("Failed to fetch events", error);
      setEvents([]);
    }
  };

  const fetchComments = async (eventId: string) => {
    setIsFetchingComments(true);
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Failed to fetch comments", error);
    } finally {
      setIsFetchingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForDetail || !newCommentText.trim() || isPostingComment || !user) return;

    const text = newCommentText;
    setNewCommentText("");
    setIsPostingComment(true);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: Comment = {
      id: tempId,
      eventId: selectedEventForDetail.id,
      userId: user.id,
      userName: user.username,
      text: text,
      createdAt: new Date().toISOString(),
      profileImage: user.profileImage
    };

    const previousComments = [...comments];
    const previousEvents = [...events];

    setComments(prev => [...prev, optimisticComment]);
    setEvents(prev => prev.map(ev => ev.id === selectedEventForDetail.id ? { ...ev, commentCount: (ev.commentCount || 0) + 1 } : ev));

    try {
      const res = await fetch(`/api/events/${selectedEventForDetail.id}/comments`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user.token}`
        },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        throw new Error("Failed to post comment");
      }
      // Real comment will be added via WebSocket, replacing the temp one if IDs match
      // Actually, WebSocket uses real ID, so we should filter out tempId when real one arrives
    } catch (error) {
      console.error("Failed to add comment", error);
      setComments(previousComments);
      setEvents(previousEvents);
      setNewCommentText(text);
      setToast("Failed to post comment");
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedEventForDetail || !user) return;
    
    // Optimistic update
    const previousComments = [...comments];
    const previousEvents = [...events];
    
    setComments(prev => prev.filter(c => c.id !== commentId));
    setEvents(prev => prev.map(e => e.id === selectedEventForDetail.id ? { ...e, commentCount: Math.max(0, (e.commentCount || 0) - 1) } : e));

    try {
      const response = await fetch(`/api/events/${selectedEventForDetail.id}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${user.token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete comment");
      }
      
      // Local state is already updated optimistically and will be confirmed via WebSocket
    } catch (error) {
      console.error(error);
      // Rollback on error
      setComments(previousComments);
      setEvents(previousEvents);
      setToast(error instanceof Error ? error.message : "Failed to delete comment");
    }
  };

  const handleOpenDetail = (event: CalendarEvent) => {
    setSelectedEventForDetail(event);
    selectedEventIdRef.current = event.id;
    setIsDetailModalOpen(true);
    setIsDateDetailModalOpen(false); // Close date detail if opening specific event
    fetchComments(event.id);
  };

  const handleDateDoubleClick = (day: Date) => {
    setSelectedDate(day);
    setIsDateDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedEventForDetail(null);
    selectedEventIdRef.current = null;
    setComments([]);
  };

  const handleCloseDateDetail = () => {
    setIsDateDetailModalOpen(false);
  };

  // Initialize WebSocket
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "EVENT_CREATED") {
        const payload = { 
          ...data.payload, 
          isShared: !!data.payload.isShared,
          date: data.payload.date.split('T')[0],
          endDate: data.payload.endDate.split('T')[0],
          startTime: data.payload.startTime || "",
          endTime: data.payload.endTime || "",
          groupIds: data.payload.groupIds || []
        };
        
        const isOwner = payload.userId === user.id;
        const isInGroup = !!(payload.groupIds && payload.groupIds.some(gId => user.groups.some(g => g.id === gId)));
        
        if (isOwner || isInGroup) {
          setEvents((prev) => {
            if (prev.some(e => e.id === payload.id)) return prev;
            return [...prev, payload];
          });
        }
      } else if (data.type === "EVENT_UPDATED") {
        setEvents((prev) => {
          const existing = prev.find(e => e.id === data.payload.id);
          const userId = data.payload.userId || existing?.userId;
          const isOwner = userId === user.id;
          const groupIds = data.payload.groupIds || existing?.groupIds || [];
          const isInGroup = !!(groupIds && groupIds.some(gId => user.groups.some(g => g.id === gId)));

          if (isOwner || isInGroup) {
            const updatedPayload = { 
              ...existing,
              ...data.payload, 
              isShared: typeof data.payload.isShared !== 'undefined' ? !!data.payload.isShared : existing?.isShared,
              date: data.payload.date ? data.payload.date.split('T')[0] : existing?.date,
              endDate: data.payload.endDate ? data.payload.endDate.split('T')[0] : existing?.endDate,
              startTime: typeof data.payload.startTime !== 'undefined' ? data.payload.startTime : existing?.startTime,
              endTime: typeof data.payload.endTime !== 'undefined' ? data.payload.endTime : existing?.endTime,
              groupIds: groupIds
            };

            if (selectedEventIdRef.current === data.payload.id) {
              setSelectedEventForDetail(updatedPayload);
            }

            if (existing) {
              return prev.map((e) => e.id === data.payload.id ? updatedPayload : e);
            } else {
              // It wasn't visible before, but it is now! Add it.
              return [...prev, updatedPayload];
            }
          } else {
            if (selectedEventIdRef.current === data.payload.id) {
              handleCloseDetail();
            }
            // If it was previously visible but now isn't (e.g. moved from group to personal), remove it instantly
            return prev.filter((e) => e.id !== data.payload.id);
          }
        });
      } else if (data.type === "EVENT_DELETED") {
        setEvents((prev) => prev.filter((e) => e.id !== data.payload.id));
        if (selectedEventIdRef.current === data.payload.id) {
          handleCloseDetail();
        }
      } else if (data.type === "COMMENT_ADDED") {
        setEvents(prev => prev.map(e => e.id === data.payload.eventId ? { ...e, commentCount: data.payload.newCount } : e));
        if (selectedEventIdRef.current === data.payload.eventId) {
          setComments(prev => {
            // Remove any temporary optimistic comments from the same user with the same text
            const filtered = prev.filter(c => !(c.id.startsWith('temp-') && c.userId === data.payload.comment.userId && c.text === data.payload.comment.text));
            if (filtered.some(c => c.id === data.payload.comment.id)) return filtered;
            return [...filtered, data.payload.comment];
          });
        }
      } else if (data.type === "COMMENT_DELETED") {
        setEvents(prev => prev.map(e => e.id === data.payload.eventId ? { ...e, commentCount: data.payload.newCount } : e));
        if (selectedEventIdRef.current === data.payload.eventId) {
          setComments(prev => prev.filter(c => c.id !== data.payload.commentId));
        }
      } else if (data.type === "GROUP_DELETED") {
        setEvents((prev) => prev.filter((e) => !e.groupIds.includes(data.payload.groupId)));
        if (user) {
          checkAuth(); // Refresh user groups
        }
      } else if (data.type === "USER_UPDATED") {
        if (data.payload.userId === user.id) {
          checkAuth();
        }
        setEvents(prev => prev.map(e => e.userId === data.payload.userId ? { ...e, profileImage: data.payload.profileImage } : e));
      } else if (data.type === "USER_DELETED") {
        if (data.payload.userId === user.id) {
          handleLogout();
        } else {
          setEvents((prev) => prev.filter((e) => e.userId !== data.payload.userId));
        }
      }
    };

    ws.current = socket;
    return () => socket.close();
  }, [user]);

  // Fetch initial events
  useEffect(() => {
    fetchEvents();
  }, [user]);

// Holiday Sync Logic - replace your existing useEffect with this
useEffect(() => {
  if (!user) return;
  
  const syncHolidays = async () => {
    const year = format(currentMonth, "yyyy");
    try {
      console.log(`Syncing holidays for ${year}...`);
      const res = await fetch(`/api/holidays/sync/${year}`, { credentials: "include" });
      const data = await res.json();
      console.log(`Holiday sync response:`, data);
      
      if (res.ok) {
        // Always fetch events after sync attempt, even if count is 0
        // This ensures we get any existing holidays from the database
        await fetchEvents();
      }
    } catch (e) {
      console.error("Failed to sync holidays", e);
    }
  };
  
  syncHolidays();
}, [currentMonth.getFullYear(), !!user]); // Only depend on year change and user login

  // Update newEvent dates when selectedDate changes
  useEffect(() => {
    if (!editingEvent && !isModalOpen) {
      setNewEvent(prev => ({
        ...prev,
        startDate: format(selectedDate, "yyyy-MM-dd"),
        endDate: format(selectedDate, "yyyy-MM-dd"),
      }));
    }
  }, [selectedDate, editingEvent, isModalOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setEvents([]);
    setView("calendar");
  };

  const handleOpenEdit = (event: CalendarEvent) => {
    if (event.userId !== user?.id && !user?.isAdmin) {
      setToast("Only the owner or an Admin can edit this plan.");
      return;
    }
    setEditingEvent(event);
    setNewEvent({
      title: event.title,
      description: event.description,
      isShared: event.isShared,
      groupIds: event.groupIds || [],
      startDate: event.date,
      endDate: event.endDate,
      startTime: event.startTime || "",
      endTime: event.endTime || "",
      hasTime: !!event.startTime,
    });
    setIsModalOpen(true);
  };

  const handleAddEvent = async () => {
    if (!newEvent.title.trim() || !user) return;
    setIsSaving(true);

    const eventData = {
      title: newEvent.title,
      description: newEvent.description,
      date: newEvent.startDate,
      endDate: newEvent.endDate,
      startTime: newEvent.hasTime ? (newEvent.startTime || "09:00") : null,
      endTime: newEvent.hasTime ? (newEvent.endTime || "10:00") : null,
      groupIds: newEvent.groupIds.length > 0 ? newEvent.groupIds : [],
    };

    try {
      let res;
      if (editingEvent) {
        res = await fetch(`/api/events/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(eventData),
          credentials: "include"
        });
      } else {
        res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            ...eventData, 
            id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2) 
          }),
          credentials: "include"
        });
      }
      
      if (res.ok) {
        setIsModalOpen(false);
        setEditingEvent(null);
        setNewEvent({ 
          title: "", 
          description: "", 
          isShared: false, 
          groupIds: [],
          startDate: format(selectedDate, "yyyy-MM-dd"), 
          endDate: format(selectedDate, "yyyy-MM-dd"),
          startTime: "",
          endTime: "",
          hasTime: false
        });
        fetchEvents();
      } else {
        const err = await res.json();
        alert("Error: " + (err.error || "Failed to save plan"));
      }
    } catch (error) {
      console.error("Failed to save event", error);
      alert("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!id) return;
    const event = events.find(e => e.id === id);
    if (event && event.userId !== user?.id && !user?.isAdmin) {
      setToast("Only the owner or an Admin can delete this plan.");
      return;
    }
    setEventToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    const id = eventToDelete;
    
    try {
      const res = await fetch(`/api/events/${id}`, { 
        method: "DELETE",
        credentials: "include"
      });
      
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== id));
        if (editingEvent?.id === id) {
          setIsModalOpen(false);
          setEditingEvent(null);
        }
      } else {
        const data = await res.json();
        alert("Failed to delete: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Failed to delete event", error);
      alert("Network error while deleting. Please check your connection.");
    } finally {
      setIsDeleteConfirmOpen(false);
      setEventToDelete(null);
    }
  };

  // Calendar Logic
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = 
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPerson = 
        filterPerson === "all" || 
        (event.type === 'public_holiday' && filterPerson === 'malaysia') ||
        event.userId === filterPerson;
      
      const matchesCategory = 
  filterCategory === "all" || 
  (event.type === filterCategory) ||
  (filterCategory === 'other' && !event.type && !event.type?.startsWith('public'));

return matchesSearch && matchesPerson && matchesCategory;
    });
  }, [events, searchQuery, filterPerson, filterCategory]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    // Always return 42 days (6 rows) to keep the calendar grid height static
    return eachDayOfInterval({ start, end: addDays(start, 41) });
  }, [currentMonth]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const isEventOnDay = (event: CalendarEvent, day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return dayStr >= event.date && dayStr <= event.endDate;
  };

  const navigateToDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    setSelectedDate(date);
    setCurrentMonth(startOfMonth(date));
    // Scroll to calendar if on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const eventsOnSelectedDate = useMemo(() => {
    return filteredEvents
      .filter((event) => isEventOnDay(event, selectedDate))
      .sort((a, b) => (a.startTime || "00:00").localeCompare(b.startTime || "00:00"));
  }, [filteredEvents, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return events
      .filter(e => e.isShared && e.endDate >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [events]);

  const themeStyles = useMemo(() => {
    const color = user?.themeColor || '#10b981';
    const accent = user?.accentColor || '#10b981';
    
    // Simple hex darken helper
    const darken = (hex: string, percent: number) => {
      try {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 255 ? R < 0 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 0 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 0 ? 0 : B : 255)).toString(16).slice(1);
      } catch (e) {
        return hex;
      }
    };

    return {
      '--brand-color': color,
      '--brand-color-hover': darken(color, 15),
      '--accent-color': accent,
      '--accent-color-hover': darken(accent, 15),
    } as React.CSSProperties;
  }, [user?.themeColor, user?.accentColor]);

  const backgroundStyles = useMemo(() => {
    const style = user?.backgroundStyle || 'default';
    const color = user?.themeColor || '#10b981';
    
    if (style === 'default') return {};

    if (darkMode) {
      switch (style) {
        case 'soft': return { background: `linear-gradient(to bottom right, #0c0a09, #1c1917, ${color}1a)` };
        case 'glass': return { background: `radial-gradient(circle at top right, ${color}33, transparent 40%), radial-gradient(circle at bottom left, ${color}33, transparent 40%), #0c0a09` };
        case 'vibrant': return { background: `linear-gradient(to bottom right, ${color}33, #0c0a09, ${color}4d)` };
        default: return {};
      }
    } else {
      switch (style) {
        case 'soft': return { background: `linear-gradient(to bottom right, #fafaf9, #ffffff, ${color}0d)` };
        case 'glass': return { background: `radial-gradient(circle at top right, ${color}1a, transparent 20%), radial-gradient(circle at bottom left, ${color}1a, transparent 20%), #fafaf9` };
        case 'vibrant': return { background: `linear-gradient(to bottom right, ${color}1a, #fafaf9, ${color}33)` };
        default: return {};
      }
    }
  }, [user?.backgroundStyle, darkMode, user?.themeColor]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <AuthView onLogin={setUser} />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen font-sans transition-all duration-500", darkMode && "dark", !user?.backgroundStyle || user.backgroundStyle === 'default' ? (darkMode ? "bg-stone-950" : "bg-stone-50") : "")} style={backgroundStyles}>
      {view === "admin" && user.isAdmin && (
        <AdminView user={user} onBack={() => setView("calendar")} />
      )}

      {view === "profile" && (
        <ProfileView 
          user={user} 
          onUpdate={setUser} 
          onBack={() => setView("calendar")} 
          darkMode={darkMode} 
          onToggleDarkMode={() => setDarkMode(!darkMode)} 
        />
      )}

      {view === "list" && (
        <MyPlansListView 
          user={user} 
          events={events} 
          onBack={() => setView("calendar")} 
          onEdit={handleOpenEdit}
          onDelete={handleDeleteEvent}
          onViewDetail={handleOpenDetail}
        />
      )}

      {view === "calendar" && (
        <div className="min-h-screen bg-transparent text-stone-900 dark:text-stone-100 font-sans pb-20 md:pb-0">
      {/* Header */}
      <header className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md border-b border-stone-200 dark:border-stone-800 px-4 md:px-6 py-3 md:py-4 sticky top-0 z-50 w-full isolate">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-brand rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
              <CalendarIcon size={18} className="md:w-5 md:h-5" />
            </div>
            <div className="hidden xs:block">
              <h1 className="text-sm md:text-lg font-bold tracking-tight leading-none dark:text-white">Calendar Kita</h1>
              <p className="text-[10px] md:text-xs text-stone-500 dark:text-stone-400 font-medium">Shared Calendar</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
            <button 
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all flex items-center gap-2",
                view === "list" ? "bg-accent text-white" : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
              )}
              title="My Plans"
            >
              <Filter size={18} className="md:w-5 md:h-5" />
              <span className="text-xs font-bold hidden sm:inline">My Plans</span>
            </button>

            <div className="h-8 w-px bg-stone-100 dark:bg-stone-800 mx-1 hidden xs:block" />
            <div className="flex flex-col items-end shrink-0">
              <span className="text-xs md:text-sm font-bold text-stone-800 dark:text-stone-200 tabular-nums leading-none">
                {format(currentTime, "HH:mm:ss")}
              </span>
              <span className="text-[8px] md:text-[9px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-wider md:tracking-widest leading-none mt-1">
                {format(currentTime, "MMM do")}
              </span>
            </div>

            <div className="h-8 w-px bg-stone-100 dark:bg-stone-800 mx-1 hidden xs:block" />

            <button 
              onClick={() => setView("profile")}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border-2 border-stone-100 dark:border-stone-800 hover:border-brand transition-all shadow-sm shrink-0"
            >
              {user.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-400 dark:text-stone-500">
                  <User size={18} />
                </div>
              )}
            </button>

            {/* Username - Visible on mobile with truncation */}
            <div className="hidden xs:flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-stone-200 dark:border-stone-700 max-w-[80px] sm:max-w-none">
              <User size={12} className="text-stone-400 dark:text-stone-500 shrink-0" />
              <span className="text-xs md:text-sm font-medium text-stone-600 dark:text-stone-300 truncate">{user.name || user.username}</span>
            </div>

            {user.isAdmin && (
              <button 
                onClick={() => setView(view === "calendar" ? "admin" : "calendar")}
                className="p-1.5 md:p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg md:rounded-xl transition-colors text-stone-600 dark:text-stone-400 shrink-0"
                title="Admin Settings"
              >
                <Shield size={18} className="md:w-5 md:h-5" />
              </button>
            )}

            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 px-2 md:px-3 py-1 md:py-1.5 rounded-full border border-stone-200 dark:border-stone-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-900/30 transition-all text-stone-600 dark:text-stone-300 shrink-0"
              title="Logout"
            >
              <LogOut size={12} />
              <span className="text-xs md:text-sm font-medium hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Section */}
        <div className="lg:col-span-8 space-y-6">
          {/* Search & Filter Bar */}
          <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md p-4 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" size={18} />
              <input 
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 rounded-2xl focus:ring-2 focus:ring-accent outline-none transition-all text-sm text-stone-900 dark:text-white"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-40">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" size={14} />
                <select 
                  value={filterPerson}
                  onChange={(e) => setFilterPerson(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 rounded-2xl focus:ring-2 focus:ring-brand outline-none transition-all text-xs font-medium appearance-none text-stone-900 dark:text-white"
                  >
                    <option value="all">All People</option>
                  <option value="malaysia">Malaysia (Holidays)</option>
                  {/* We could dynamically list users here if we had a users list in state */}
                  {Array.from(new Set(events.filter(e => e.userName).map(e => e.userId))).map(uId => {
                    const event = events.find(e => e.userId === uId);
                    return <option key={uId} value={uId}>{event?.userName}</option>;
                  })}
                </select>
              </div>
              <div className="relative flex-1 md:w-40">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" size={14} />
                <select 
  value={filterCategory}
  onChange={(e) => setFilterCategory(e.target.value)}
  className="w-full pl-9 pr-3 py-2.5 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 rounded-2xl focus:ring-2 focus:ring-brand outline-none transition-all text-xs font-medium appearance-none text-stone-900 dark:text-white"
>
  <option value="all">All Categories</option>
  <option value="public_holiday">Public Holidays</option>
  <option value="observance">Special Days</option>
  <option value="work">Work</option>
  <option value="personal">Personal</option>
  <option value="other">Other</option>
</select>
              </div>
            </div>
          </div>

          {/* Search Results List */}
{(searchQuery || filterPerson !== 'all' || filterCategory !== 'all') && (
  <motion.div 
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden"
  >
    <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center bg-stone-50/50 dark:bg-stone-800/50">
      <h3 className="text-sm font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-2">
        <Search size={16} className="text-brand" />
        Search Results ({filteredEvents.length})
      </h3>
      <button 
        onClick={() => {
          setSearchQuery("");
          setFilterPerson("all");
          setFilterCategory("all");
        }}
        className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
      >
        Clear all
      </button>
    </div>
    <div className="max-h-60 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800">
      {filteredEvents.length > 0 ? (
        filteredEvents.sort((a, b) => a.date.localeCompare(b.date)).map(event => (
          <div
            key={event.id}
            className="w-full text-left p-4 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => navigateToDate(event.date)}>
              <div className={clsx(
                "w-2 h-2 rounded-full",
                event.type === 'public_holiday' ? "bg-red-500" : 
                event.type === 'observance' ? "bg-purple-500" : 
                "bg-brand"
              )} />
              <div>
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200 group-hover:text-brand transition-colors">
                  {event.title}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {format(parseISO(event.date), "PPP")}
                  {event.startTime && ` • ${event.startTime}`}
                  {event.type === 'observance' && (
                    <span className="ml-2 text-purple-500 dark:text-purple-400 text-[10px] font-medium">Special Day</span>
                  )}
                  {event.type === 'public_holiday' && (
                    <span className="ml-2 text-red-500 dark:text-red-400 text-[10px] font-medium">Public Holiday</span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleOpenDetail(event)}
                className="p-2 text-stone-400 dark:text-stone-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                title="View Details"
              >
                <Eye size={16} />
              </button>
              <ChevronRight size={14} className="text-stone-300 dark:text-stone-600 group-hover:text-brand transition-all transform group-hover:translate-x-1" />
            </div>
          </div>
        ))
      ) : (
        <div className="p-8 text-center">
          <p className="text-sm text-stone-400 dark:text-stone-500 italic">No events match your search criteria.</p>
        </div>
      )}
    </div>
  </motion.div>
)}

          <div className="w-full bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 dark:border-stone-800">
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-stone-800 dark:text-white leading-tight">
                  <span className="block sm:inline">{format(currentMonth, "MMMM")}</span>
                  <span className="block sm:inline sm:ml-2 text-stone-400 dark:text-stone-500 font-medium">{format(currentMonth, "yyyy")}</span>
                </h2>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-2 sm:ml-4">
                <button 
                  onClick={prevMonth}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-600 dark:text-stone-400"
                >
                  <ChevronLeft size={20} />
                </button>
                <button 
                  onClick={() => {
                    const today = new Date();
                    setCurrentMonth(today);
                    setSelectedDate(today);
                  }}
                  className="px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-600 dark:text-stone-400"
                >
                  Today
                </button>
                <button 
                  onClick={nextMonth}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-600 dark:text-stone-400"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4 relative overflow-hidden min-h-[320px]">
              <div className="grid grid-cols-7 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest py-2">
                    {day}
                  </div>
                ))}
              </div>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div 
                  key={format(currentMonth, "yyyy-MM")}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -20, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => {
                    if (info.offset.x > 100) prevMonth();
                    else if (info.offset.x < -100) nextMonth();
                  }}
                  className="grid grid-cols-7 gap-1 cursor-grab active:cursor-grabbing"
                >
                {days.map((day, idx) => {
                  const dayEvents = filteredEvents.filter(e => isEventOnDay(e, day));
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      onDoubleClick={() => handleDateDoubleClick(day)}
                      className={cn(
                        "relative aspect-square p-1 sm:p-2 rounded-xl sm:rounded-2xl transition-all flex flex-col items-center justify-start group overflow-hidden",
                        !isCurrentMonth && "opacity-30",
                        isSelected ? "bg-accent text-white shadow-lg shadow-accent/20" : "hover:bg-stone-50 dark:hover:bg-stone-800",
                        isToday(day) && !isSelected && "bg-accent/10 dark:bg-accent/20 text-accent font-bold",
                        !isSelected && dayEvents.length > 0 && "bg-stone-50/80 dark:bg-stone-800/50 ring-1 ring-stone-100 dark:ring-stone-800"
                      )}
                    >
                      <span className={cn(
                        "text-xs sm:text-sm z-10 mt-0.5 sm:mt-0",
                        !isSelected && dayEvents.some(e => e.type === 'public_holiday') && "text-red-600 dark:text-red-400 font-semibold",
                        !isSelected && !isToday(day) && isCurrentMonth && "text-stone-900 dark:text-stone-100"
                      )}>
                        {format(day, "d")}
                      </span>
                      
                      {/* Event Indicators - Absolutely positioned to prevent resizing */}
                      <div className="absolute bottom-1 sm:bottom-2 left-0 right-0 flex flex-wrap justify-center gap-0.5 sm:gap-1 px-1 pointer-events-none">
                        {dayEvents.some(e => (e.commentCount || 0) > 0) && (
                          <div className={cn(
                            "absolute top-[-12px] sm:top-[-16px] right-1 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-blue-500 shadow-sm",
                            isSelected && "bg-white"
                          )} />
                        )}
                        {dayEvents.slice(0, 3).map((event, i) => (
  <div 
    key={i} 
    className={cn(
      "w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shadow-sm transition-transform group-hover:scale-110",
      isSelected ? "bg-white" : 
        event.type === 'public_holiday' ? "bg-red-500" : 
        event.type === 'observance' ? "bg-purple-500" : 
        event.isShared ? "bg-brand" : "bg-stone-400 dark:bg-stone-600"
    )} 
  />
))}
                        {dayEvents.length > 3 && (
                          <div className={cn("w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full flex items-center justify-center text-[5px] sm:text-[6px] font-bold", isSelected ? "bg-white/40 text-white" : "bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400")}>
                            +
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        </div>

        {/* Sidebar / Details */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-sm border border-stone-200 dark:border-stone-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-stone-800 dark:text-white">
                  {format(selectedDate, "EEEE")}
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400">{format(selectedDate, "do MMMM")}</p>
              </div>
              <button 
                onClick={() => {
                  setEditingEvent(null);
                  setIsModalOpen(true);
                }}
                className="w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {eventsOnSelectedDate.length === 0 ? (
                <div className="text-center py-12 px-4 border-2 border-dashed border-stone-100 dark:border-stone-800 rounded-2xl">
                  <div className="w-12 h-12 bg-stone-50 dark:bg-stone-800 rounded-full flex items-center justify-center mx-auto mb-3 text-stone-300 dark:text-stone-600">
                    <CalendarIcon size={24} />
                  </div>
                  <p className="text-sm text-stone-400 dark:text-stone-500 font-medium">No plans for this day</p>
                  <button 
                    onClick={() => {
                      setEditingEvent(null);
                      setIsModalOpen(true);
                    }}
                    className="mt-3 text-xs font-bold text-accent hover:text-accent-hover uppercase tracking-wider"
                  >
                    Add Something
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {eventsOnSelectedDate.map((event) => (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn(
                        "group relative bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 hover:border-brand/30 transition-colors",
                        event.type === 'public_holiday' && "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 hover:border-red-200 dark:hover:border-red-900/50"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
{event.type === 'public_holiday' ? (
                            <div className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider rounded-md">
                              Public Holiday
                            </div>
                          ) : event.type === 'observance' ? (
                            <div className="px-2 py-0.5 bg-purple-600 text-white text-[9px] font-bold uppercase tracking-wider rounded-md">
                              Special Day
                            </div>
                          ) : event.isShared ? (
                            <div className="p-1 bg-accent/20 text-accent rounded-md" title="Shared with family">
                              <Users size={12} />
                            </div>
                          ) : (
                            <div className="p-1 bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-md" title="Private">
                              <Lock size={12} />
                            </div>
                          )}
                          {(event.commentCount || 0) > 0 && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-bold">
                              <MessageSquare size={10} />
                              <span>{event.commentCount}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {event.type !== 'public_holiday' && event.profileImage && (
                              <img 
                                src={event.profileImage} 
                                alt={event.userName} 
                                className="w-5 h-5 rounded-full object-cover border border-stone-200 dark:border-stone-700"
                                referrerPolicy="no-referrer"
                              />
                            )}
                            <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                              {event.type === 'public_holiday' ? 'Malaysia' : event.userName}
                              {event.groupIds && event.groupIds.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {event.groupIds.map(gId => {
                                    const group = user?.groups.find(g => g.id === gId);
                                    if (!group) return null;
                                    return (
                                      <span key={gId} className="px-1.5 py-0.5 bg-brand/10 text-brand rounded text-[9px]">
                                        {group.name}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 transition-all z-10">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(event);
                            }}
                            className="p-2 text-stone-400 dark:text-stone-500 hover:text-brand hover:bg-brand/10 rounded-xl transition-all"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {((event.userId === user?.id || user?.isAdmin) && !event.readOnly) && (
                            <>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEdit(event);
                                }}
                                className="p-2 text-stone-400 dark:text-stone-500 hover:text-brand hover:bg-brand/10 rounded-xl transition-all"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEvent(event.id);
                                }}
                                className="p-2 text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all hover:scale-110 active:scale-95 cursor-pointer z-20"
                                title="Delete Plan"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <h4 className={cn(
                        "font-semibold leading-tight mb-1",
                        event.type === 'public_holiday' ? "text-red-800 dark:text-red-400" : "text-stone-800 dark:text-stone-200"
                      )}>{event.title}</h4>
                      
                      {event.type === 'public_holiday' && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400 mb-2 bg-red-100/50 dark:bg-red-900/30 w-fit px-2 py-1 rounded-lg">
                          <Timer size={12} />
                          <span>{getCountdown(event.date)}</span>
                        </div>
                      )}
                      {event.startTime && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-accent mb-1">
                          <div className="p-1 bg-accent/20 rounded-md">
                            <Clock size={10} />
                          </div>
                          <span>{formatTime(event.startTime)} {event.endTime && `– ${formatTime(event.endTime)}`}</span>
                          {event.endTime && (
                            <span className="text-stone-400 dark:text-stone-500 font-medium">({calculateDuration(event.startTime, event.endTime)})</span>
                          )}
                        </div>
                      )}
                      {event.description && (
                        <p className="text-sm text-stone-500 dark:text-stone-400 line-clamp-2 mb-2">{event.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                          {isSameDay(parseISO(event.date), parseISO(event.endDate)) 
                            ? format(parseISO(event.date), "MMM d")
                            : `${format(parseISO(event.date), "MMM d")} - ${format(parseISO(event.endDate), "MMM d")}`
                          }
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Family Feed Summary */}
          <div className="bg-accent rounded-3xl p-6 text-white shadow-xl shadow-accent/20 border border-transparent dark:border-stone-800">
            <h3 className="text-sm font-bold uppercase tracking-widest opacity-60 mb-4">Upcoming Family Plans</h3>
            <div className="space-y-4">
              {upcomingEvents.map(event => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex-shrink-0 w-10 text-center">
                      <div className="text-xs font-bold opacity-60 uppercase">{format(parseISO(event.date), "MMM")}</div>
                      <div className="text-lg font-bold leading-none">{format(parseISO(event.date), "d")}</div>
                    </div>
                    <div className="flex-grow">
                      <div className="text-sm font-semibold line-clamp-1">{event.title}</div>
                      {event.startTime && (
                        <div className="text-[10px] font-bold text-white/70 flex items-center gap-1">
                          <Clock size={10} />
                          {formatTime(event.startTime)}
                        </div>
                      )}
                      <div className="text-[10px] font-medium opacity-60 uppercase tracking-wider">By {event.userName}</div>
                    </div>
                    {(event.userId === user?.id || user?.isAdmin) && (
                      <div className="flex-shrink-0 flex items-center gap-1 z-10">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(event);
                          }}
                          className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEvent(event.id);
                          }}
                          className="p-1.5 text-white/40 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-all hover:scale-110 active:scale-95 cursor-pointer z-20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    {event.userId !== user?.id && !user?.isAdmin && (
                      <div className="flex-shrink-0 flex items-center p-1.5 text-white/20">
                        <Eye size={12} />
                      </div>
                    )}
                  </div>
                ))}
              {upcomingEvents.length === 0 && (
                <p className="text-xs opacity-60 italic">No shared plans yet.</p>
              )}
            </div>
          </div>
        </div>
      </main>

        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsDeleteConfirmOpen(false)}
            className="absolute inset-0 bg-stone-900/60 dark:bg-stone-950/80 backdrop-blur-sm"
          />
          <div 
            className="relative bg-white dark:bg-stone-900 w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center z-10 border border-stone-200 dark:border-stone-800"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-stone-800 dark:text-white mb-2">Delete this plan?</h3>
            <p className="text-stone-500 dark:text-stone-400 mb-8">This will remove the entire plan from all scheduled days. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="flex-1 py-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-xl font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 dark:shadow-red-900/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      <AnimatePresence>
        {isDetailModalOpen && selectedEventForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDetail}
              className="absolute inset-0 bg-stone-900/40 dark:bg-stone-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[calc(100dvh-32px)] md:max-h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-800"
            >
              <div className="p-5 md:p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg",
                    selectedEventForDetail.type === 'public_holiday' ? "bg-red-600 shadow-red-100 dark:shadow-red-900/20" : "bg-brand shadow-brand/20"
                  )}>
                    <CalendarIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-800 dark:text-white">{selectedEventForDetail.title}</h3>
                    <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                      {selectedEventForDetail.type === 'public_holiday' ? 'Public Holiday' : `By ${selectedEventForDetail.userName}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {((selectedEventForDetail.userId === user?.id || user?.isAdmin) && !selectedEventForDetail.readOnly) && (
                    <button 
                      onClick={() => {
                        handleCloseDetail();
                        handleOpenEdit(selectedEventForDetail);
                      }}
                      className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-600 dark:text-stone-400"
                      title="Edit Plan"
                    >
                      <Edit2 size={20} />
                    </button>
                  )}
                  <button 
                    onClick={handleCloseDetail}
                    className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-400 dark:text-stone-500"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 flex flex-col md:grid md:grid-cols-2 gap-6 p-4 md:p-6 min-h-0 overflow-hidden">
                  <div className="shrink-0 md:flex-1 md:overflow-y-auto custom-scrollbar space-y-3 md:space-y-6 pr-1">
                    <div className="bg-stone-50 dark:bg-stone-800/50 p-3 md:p-4 rounded-2xl border border-stone-100 dark:border-stone-800">
                      <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2 md:mb-3">Date & Time</label>
                      <div className="space-y-2 md:space-y-3">
                        <div className="flex items-center gap-3 text-stone-700 dark:text-stone-200">
                          <CalendarIcon size={18} className="text-brand" />
                          <span className="text-sm font-medium">
                            {isSameDay(parseISO(selectedEventForDetail.date), parseISO(selectedEventForDetail.endDate)) 
                              ? format(parseISO(selectedEventForDetail.date), "EEEE, do MMMM yyyy")
                              : `${format(parseISO(selectedEventForDetail.date), "MMM d")} - ${format(parseISO(selectedEventForDetail.endDate), "MMM d, yyyy")}`
                            }
                          </span>
                        </div>
                        {selectedEventForDetail.startTime && (
                          <div className="flex items-center gap-3 text-stone-700 dark:text-stone-200">
                            <Clock size={18} className="text-brand" />
                            <span className="text-sm font-medium">
                              {formatTime(selectedEventForDetail.startTime)} {selectedEventForDetail.endTime && `– ${formatTime(selectedEventForDetail.endTime)}`}
                              {selectedEventForDetail.endTime && (
                                <span className="ml-2 text-stone-400 dark:text-stone-500 text-xs">({calculateDuration(selectedEventForDetail.startTime, selectedEventForDetail.endTime)})</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedEventForDetail.description && (
                      <div className="bg-stone-50 dark:bg-stone-800/50 p-3 md:p-4 rounded-2xl border border-stone-100 dark:border-stone-800">
                        <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2 md:mb-3">Description</label>
                        <p className="text-sm text-stone-600 dark:text-stone-300 whitespace-pre-wrap leading-relaxed line-clamp-3 md:line-clamp-none">
                          {selectedEventForDetail.description}
                        </p>
                      </div>
                    )}

                    <div className="bg-stone-50 dark:bg-stone-800/50 p-3 md:p-4 rounded-2xl border border-stone-100 dark:border-stone-800">
                      <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2 md:mb-3">Visibility</label>
                      <div className="flex flex-wrap gap-2">
                        {!selectedEventForDetail.isShared ? (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-400 rounded-lg text-xs font-bold">
                            <Lock size={12} />
                            <span>Private</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-xs font-bold">
                              <Users size={12} />
                              <span>Shared with Family</span>
                            </div>
                            {selectedEventForDetail.groupIds.map(gId => {
                              const group = user?.groups.find(g => g.id === gId);
                              if (!group) return null;
                              return (
                                <div key={gId} className="px-3 py-1.5 bg-brand/10 text-brand rounded-lg text-xs font-bold">
                                  {group.name}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden mt-4 md:mt-0">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-bold text-stone-800 dark:text-white flex items-center gap-2">
                        Comments
                        <span className="px-2 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-full text-[10px]">
                          {comments.length}
                        </span>
                      </h4>
                    </div>

                    <div className="flex-1 bg-stone-50 dark:bg-stone-800/30 rounded-2xl border border-stone-100 dark:border-stone-800 p-4 overflow-y-auto custom-scrollbar space-y-4 mb-4">
                      {isFetchingComments ? (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-stone-400">
                          <div className="w-5 h-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                          <span className="text-xs font-medium">Loading comments...</span>
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-4">
                          <div className="p-3 bg-white dark:bg-stone-800 rounded-full text-stone-200 dark:text-stone-700 mb-2">
                            <Users size={24} />
                          </div>
                          <p className="text-xs text-stone-400 dark:text-stone-500 italic">No comments yet. Be the first to say something!</p>
                        </div>
                      ) : (
                        comments.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-stone-200 dark:bg-stone-700 shrink-0">
                              {comment.profileImage ? (
                                <img src={comment.profileImage} alt={comment.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-400">
                                  <User size={14} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-baseline justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200">{comment.userName}</span>
                                  <span className="text-[10px] text-stone-400 dark:text-stone-500">{format(parseISO(comment.createdAt), "MMM d, HH:mm")}</span>
                                </div>
                                {(comment.userId === user?.id || user?.isAdmin) && (
                                  <button 
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-stone-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                    title="Delete comment"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                              <div className="bg-white dark:bg-stone-800 p-3 rounded-2xl rounded-tl-none border border-stone-100 dark:border-stone-700 shadow-sm">
                                <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{comment.text}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-1">
                      <form onSubmit={handleAddComment} className="relative">
                        <input 
                          type="text"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder="Write a comment..."
                          className="w-full pl-4 pr-12 py-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl focus:ring-2 focus:ring-brand/50 focus:border-brand outline-none transition-all text-sm text-stone-900 dark:text-white shadow-sm"
                        />
                        <button 
                          type="submit"
                          disabled={!newCommentText.trim() || isPostingComment}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-brand text-white rounded-xl flex items-center justify-center hover:bg-brand-hover disabled:opacity-50 transition-all shadow-md shadow-brand/20"
                        >
                          {isPostingComment ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus size={18} />
                          )}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Date Detail Modal */}
      <AnimatePresence>
        {isDateDetailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDateDetail}
              className="absolute inset-0 bg-stone-900/40 dark:bg-stone-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-stone-900 w-full max-w-lg max-h-[80vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-800"
            >
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-stone-800 dark:text-white">
                    {format(selectedDate, "EEEE")}
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400">{format(selectedDate, "do MMMM yyyy")}</p>
                </div>
                <button 
                  onClick={handleCloseDateDetail}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-400 dark:text-stone-500"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                    Plans for {isToday(selectedDate) ? "today" : format(selectedDate, "do MMMM")}
                  </h4>
                  <button 
                    onClick={() => {
                      setEditingEvent(null);
                      setIsModalOpen(true);
                      setIsDateDetailModalOpen(false);
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-brand hover:text-brand-hover transition-colors"
                  >
                    <Plus size={14} />
                    Add Plan
                  </button>
                </div>

                {eventsOnSelectedDate.length > 0 ? (
                  <div className="space-y-3">
                    {eventsOnSelectedDate.map((event) => (
                      <div 
                        key={event.id}
                        onClick={() => handleOpenDetail(event)}
                        className="group p-4 bg-stone-50 dark:bg-stone-800/50 hover:bg-white dark:hover:bg-stone-800 rounded-2xl border border-stone-100 dark:border-stone-800 hover:border-brand/30 transition-all cursor-pointer shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0",
              event.type === 'public_holiday' ? "bg-red-500" : "bg-brand"
            )}>
                              <CalendarIcon size={18} />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-stone-800 dark:text-white group-hover:text-brand transition-colors">
                                {event.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                {event.startTime && (
                                  <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 flex items-center gap-1">
                                    <Clock size={10} />
                                    {formatTime(event.startTime)}
                                  </span>
                                )}
                                <div className="flex items-center gap-2">
                                  {event.type !== 'public_holiday' && event.profileImage && (
                                    <img 
                                      src={event.profileImage} 
                                      alt={event.userName} 
                                      className="w-4 h-4 rounded-full object-cover border border-stone-200 dark:border-stone-700"
                                      referrerPolicy="no-referrer"
                                    />
                                  )}
                                  <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                                    {event.type === 'public_holiday' ? 'Public Holiday' : `By ${event.userName}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-stone-300 dark:text-stone-600 group-hover:text-brand transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-stone-50 dark:bg-stone-800/50 rounded-full flex items-center justify-center text-stone-200 dark:text-stone-700 mb-4">
                      <CalendarIcon size={32} />
                    </div>
                    <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">No plans scheduled for this day.</p>
                    <button 
                      onClick={() => {
                        setEditingEvent(null);
                        setIsModalOpen(true);
                        setIsDateDetailModalOpen(false);
                      }}
                      className="mt-4 text-xs font-bold text-brand hover:underline"
                    >
                      Create the first one
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Event Modal */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 dark:bg-stone-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-stone-900 w-full max-w-md max-h-[calc(100dvh-32px)] md:max-h-[85vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-stone-200 dark:border-stone-800"
            >
              <div className="p-5 md:p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-stone-800 dark:text-white">{editingEvent ? "Edit Plan" : "New Plan"}</h3>
                  {editingEvent && (
                    <button 
                      onClick={() => {
                        handleDeleteEvent(editingEvent.id);
                        setIsModalOpen(false);
                      }}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                      title="Delete this entire plan"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors text-stone-400 dark:text-stone-500"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-5 md:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                <div>
                  <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">Title</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                    placeholder="What are we doing?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">Start Date</label>
                    <input 
                      type="date" 
                      value={newEvent.startDate}
                      onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">End Date</label>
                    <input 
                      type="date" 
                      value={newEvent.endDate}
                      onChange={(e) => setNewEvent({ ...newEvent, endDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className={newEvent.hasTime ? "text-brand" : "text-stone-400 dark:text-stone-500"} />
                    <span className="text-sm font-bold text-stone-600 dark:text-stone-300">Add Specific Time</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewEvent({ ...newEvent, hasTime: !newEvent.hasTime })}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative shrink-0",
                      newEvent.hasTime ? "bg-brand" : "bg-stone-300 dark:bg-stone-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                      newEvent.hasTime ? "left-5" : "left-1"
                    )} />
                  </button>
                </div>

                {newEvent.hasTime && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 gap-4 overflow-hidden"
                  >
                    <div>
                      <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">Start Time</label>
                      <input 
                        type="time" 
                        value={newEvent.startTime}
                        onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">End Time</label>
                      <input 
                        type="time" 
                        value={newEvent.endTime}
                        onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </motion.div>
                )}

                <div>
                  <label className="block text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">Description (Optional)</label>
                  <textarea 
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800 text-stone-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all resize-none h-24"
                    placeholder="Add some details..."
                  />
                </div>

                {/* Group Selection */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-1 ml-1">Visibility & Sharing</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setNewEvent({ ...newEvent, groupIds: [] })}
                      className={cn(
                        "flex flex-col gap-2 p-3 rounded-2xl border transition-all text-left relative",
                        newEvent.groupIds.length === 0 
                          ? "bg-brand/5 dark:bg-brand/10 border-brand/20 dark:border-brand/40 ring-2 ring-brand/10" 
                          : "bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        newEvent.groupIds.length === 0 ? "bg-brand text-white" : "bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
                      )}>
                        <Lock size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-800 dark:text-stone-200">Personal</div>
                        <div className="text-[9px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-tighter">Private</div>
                      </div>
                      {newEvent.groupIds.length === 0 && (
                        <div className="absolute top-2 right-2">
                          <Check size={12} className="text-brand" />
                        </div>
                      )}
                    </button>

                    {user.groups.map(group => {
                      const isSelected = newEvent.groupIds.includes(group.id);
                      return (
                        <button 
                          key={group.id}
                          onClick={() => {
                            const updatedGroups = isSelected
                              ? newEvent.groupIds.filter(id => id !== group.id)
                              : [...newEvent.groupIds, group.id];
                            setNewEvent({ ...newEvent, groupIds: updatedGroups });
                          }}
                          className={cn(
                            "flex flex-col gap-2 p-3 rounded-2xl border transition-all text-left relative",
                            isSelected 
                              ? "bg-brand/10 border-brand/30 ring-2 ring-brand/10" 
                              : "bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-brand text-white" : "bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400"
                          )}>
                            <Users size={14} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">{group.name}</div>
                            <div className="text-[9px] text-stone-400 dark:text-stone-500 font-bold uppercase tracking-tighter">Shared</div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <Check size={12} className="text-brand" />
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {user.groups.length === 0 && (
                      <div className="p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-800 flex items-center gap-3 opacity-60">
                        <div className="p-2 bg-stone-200 dark:bg-stone-700 text-stone-500 dark:text-stone-400 rounded-xl">
                          <AlertCircle size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-stone-800 dark:text-stone-200">No Groups Joined</div>
                          <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">
                            Ask an admin to add you to a group
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
              
              <div className="p-5 md:p-6 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/50 flex gap-3 shrink-0">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-stone-600 dark:text-stone-300 font-bold text-sm hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddEvent}
                  disabled={!newEvent.title.trim() || isSaving}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check size={18} />
                  )}
                  {editingEvent ? (isSaving ? "Updating..." : "Update Plan") : (isSaving ? "Saving..." : "Save Plan")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (Mobile Only) */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <button 
          onClick={() => {
            setEditingEvent(null);
            setIsModalOpen(true);
          }}
          className="w-14 h-14 bg-accent text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-accent/20 hover:scale-110 active:scale-95 transition-all"
        >
          <Plus size={28} />
        </button>
      </div>
    </div>
  );
}
