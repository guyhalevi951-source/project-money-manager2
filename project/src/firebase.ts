import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDv987XaHD1WC50XTY0efLfg7lC0sJ-iw0",
  authDomain: "my-finance-app-b52ef.firebaseapp.com",
  projectId: "my-finance-app-b52ef",
  storageBucket: "my-finance-app-b52ef.firebasestorage.app",
  messagingSenderId: "734189621402",
  appId: "1:734189621402:web:a7187058dfd2c80b530f23"
};

function initFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

const app = initFirebaseApp();

export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email.trim(), password);

export const signUpWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email.trim(), password);

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

export const signOutUser = () => signOut(auth);

/** True when all required VITE_FIREBASE_* env vars are present. */
export const isFirebaseConfigured = (): boolean =>
  Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
  );
