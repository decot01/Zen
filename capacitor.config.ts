import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.decot01.zen',
  appName: 'Zen',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 400,
      backgroundColor: '#000000',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#000000',
  },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Zen',
  },
}

export default config
