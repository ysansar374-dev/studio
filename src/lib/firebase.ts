import { useState, useEffect } from 'react';
import type { FirebaseOptions } from 'firebase/app';

const getFirebaseConfig = (): { config: FirebaseOptions | null, appId: string | null } => {
  const env = process.env;
  
  const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  if (Object.values(config).every(value => value)) {
    return { config, appId: config.projectId! };
  }

  console.warn("Firebase environment variables not found. Using fallback configuration. This is not recommended for production.");
  const fallbackConfig = {
    apiKey: "AIzaSyC2sWHR0mEkf3sKDPb3j5qWuQhyMFG8hSY",
    authDomain: "coffee-spark-ai-barista-3f318.firebaseapp.com",
    projectId: "coffee-spark-ai-barista-3f318",
    storageBucket: "coffee-spark-ai-barista-3f318.appspot.com",
    messagingSenderId: "324973813553",
    appId: "1:324973813553:web:558cc71df1c65fa0f5da10"
  };
  return { config: fallbackConfig, appId: fallbackConfig.projectId };
};


export const useFirebaseConfig = () => {
  const [config, setConfig] = useState<{ config: FirebaseOptions | null, appId: string | null }>({ config: null, appId: null });

  useEffect(() => {
    // getFirebaseConfig reads from process.env, which is only available on the server
    // during SSR, but available on the client after hydration. By putting it in
    // useEffect, we ensure it only runs on the client.
    setConfig(getFirebaseConfig());
  }, []);

  return config;
};
