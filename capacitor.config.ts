import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.family.calendar',
  appName: 'Family Calendar',
  webDir: 'dist',
  server: {
    // PASTE YOUR NGROK LINK BELOW
    url: 'https://family-calendar-kita.onrender.com',
    cleartext: true
  }
};

export default config;