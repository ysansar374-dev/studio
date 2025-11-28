import { useState, useEffect } from 'react';
import type { FirebaseOptions } from 'firebase/app';

// This function now directly uses environment variables that Next.js will replace at build time.
// This is compatible with deployment platforms like Netlify.
const getFirebaseConfig = (): { config: FirebaseOptions | null, appId: string | null } => {
  // IMPORTANT: Replace the placeholder values below with your actual Firebase project configuration.
  // You can find these details in your Firebase project settings.
  const config = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
  };

  // Check if all required environment variables are present and not placeholders.
  const placeholderKeys = Object.entries(config)
    .filter(([key, value]) => !value || value.startsWith("REPLACE_WITH") || value.startsWith("YOUR_"))
    .map(([key]) => key);

  if (placeholderKeys.length > 0) {
    console.error(`Firebase configuration is incomplete. Please replace the placeholder values in src/lib/firebase.ts for the following keys: ${placeholderKeys.join(', ')}`);
    return { config: null, appId: null };
  }

  return { config: config as FirebaseOptions, appId: config.projectId! };
};


export const useFirebaseConfig = () => {
  const [config, setConfig] = useState<{ config: FirebaseOptions | null, appId: string | null, checked: boolean }>({ config: null, appId: null, checked: false });

  useEffect(() => {
    // getFirebaseConfig needs to run on the client side after hydration
    // to access the process.env variables injected by Next.js.
    const resolvedConfig = getFirebaseConfig();
    setConfig({ ...resolvedConfig, checked: true });
  }, []);

  return config;
};
