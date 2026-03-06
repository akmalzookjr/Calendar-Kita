import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.calendar.kita',
  appName: 'Calendar Kita',
  webDir: 'dist',
  server: {
    // PASTE YOUR NGROK LINK BELOW
    url: 'https://calendar-kita.onrender.com/',
    cleartext: true
  }
};

export default config;

a