import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import 'dotenv/config';

let firebaseApp: App | null = null;
let firebaseAuth: Auth | null = null;

const apps = getApps();
if (!apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    try {
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      firebaseAuth = getAuth(firebaseApp);
      console.log('[FirebaseAdmin] Initialized successfully for project:', projectId);
    } catch (err: any) {
      console.error('[FirebaseAdmin] Failed to initialize:', err.message);
    }
  } else {
    console.warn('[FirebaseAdmin] Missing Firebase Admin credentials in environment.');
  }
} else {
  firebaseApp = apps[0];
  firebaseAuth = getAuth(firebaseApp);
}

export { firebaseApp, firebaseAuth };
