import { useState, useEffect } from 'react';
import type { FirebaseOptions } from 'firebase/app';

// This function now directly uses environment variables that Next.js will replace at build time.
// This is compatible with deployment platforms like Netlify.
const getFirebaseConfig = (): { config: FirebaseOptions | null, appId: string | null } => {
  // IMPORTANT: Replace the placeholder values below with your actual Firebase project configuration.
  // You can find these details in your Firebase project settings.
  const config = {
    apiKey: "REPLACE_WITH_YOUR_API_KEY",
    authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
    projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
    storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
    messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
    appId: "REPLACE_WITH_YOUR_APP_ID",
  };

  // Check if all required environment variables are present.
  if (Object.values(config).every(value => value && !value.startsWith("REPLACE_WITH"))) {
    return { config: config as FirebaseOptions, appId: config.projectId! };
  }

  // If the config values are still placeholders, return null to indicate an error.
  console.error("Firebase configuration is not set. Please replace the placeholder values in src/lib/firebase.ts.");
  return { config: null, appId: null };
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
