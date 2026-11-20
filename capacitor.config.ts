import type { CapacitorConfig } from '@capacitor/cli';

// Notevia ships the same web build inside the native shell, so the app works offline
// and reviewers see a real bundled app (not a remote-URL wrapper).
const config: CapacitorConfig = {
  appId: 'app.notevia.mobile',
  appName: 'Notevia',
  webDir: 'dist',
  backgroundColor: '#F8F6FC',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never', backgroundColor: '#F8F6FC' },
  plugins: {
    SplashScreen: { launchShowDuration: 600, backgroundColor: '#F8F6FC', showSpinner: false },
    Keyboard: { resize: 'body' },
  },
};
export default config;
