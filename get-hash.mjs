import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Point to your SQLite database file
const dbPath = path.join(__dirname, 'family_calendar.db');
console.log('Looking for database at:', dbPath);

try {
  const db = new Database(dbPath);
  
  // Check if admin user exists
  const user = db.prepare('SELECT username, password FROM users WHERE username = ?').get('admin');
  
  if (user) {
    console.log('✅ Admin user found!');
    console.log('Username:', user.username);
    console.log('Password hash:', user.password);
    console.log('\nCopy this hash for Supabase:');
    console.log('------------------------');
    console.log(user.password);
    console.log('------------------------');
  } else {
    console.log('❌ Admin user not found in SQLite');
    
    // List all users to see what's in the database
    const allUsers = db.prepare('SELECT username FROM users').all();
    console.log('\nUsers in database:', allUsers.map(u => u.username).join(', ') || 'none');
  }
  
  db.close();
} catch (error) {
  console.error('Error:', error.message);
}