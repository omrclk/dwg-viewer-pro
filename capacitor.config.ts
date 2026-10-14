import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dwgviewer.pro',
  appName: 'DWG Viewer Pro',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#000000',
    captureInput: true,
    adjustMarginsForEdgeToEdge: 'disable',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
