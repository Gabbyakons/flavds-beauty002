import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// FIREBASE_SERVICE_ACCOUNT = the whole service-account JSON file (or that JSON encoded as base64)
export const hasFirebase = Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
// FIREBASE_STORAGE_BUCKET = e.g. my-project.firebasestorage.app (needs the Blaze plan)
export const hasStorage = hasFirebase && Boolean(process.env.FIREBASE_STORAGE_BUCKET);

function app() {
  if (getApps().length) return getApps()[0];
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
  if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8");
  return initializeApp({
    credential: cert(JSON.parse(raw)),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  });
}

export const db = () => getFirestore(app());
export const bucket = () => getStorage(app()).bucket();
