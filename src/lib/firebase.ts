import { useState, useEffect } from 'react';
import type { FirebaseOptions } from 'firebase/app';

// This function now directly uses environment variables that Next.js will replace at build time.
// This is compatible with deployment platforms like Netlify.
const getFirebaseConfig = (): { config: FirebaseOptions | null, appId: string | null } => {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  // Check if all required environment variables are present.
  if (Object.values(config).every(value => value)) {
    return { config: config as FirebaseOptions, appId: config.projectId! };
  }

  // In a production/deployment environment, we should not use fallbacks.
  // If env variables are missing, it's a configuration error.
  console.error("Firebase environment variables are not set. Please check your Netlify deployment configuration.");
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
