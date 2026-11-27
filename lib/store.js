import fs from "fs/promises";
import path from "path";
import { Redis } from "@upstash/redis";
import { del } from "@vercel/blob";
import seed from "../data/products.json";
import { CATEGORIES } from "./shop";
import { bucket, db, hasFirebase } from "./firebase";

// Where products are kept (first one that is set up wins):
//   1. Firebase Firestore   (FIREBASE_SERVICE_ACCOUNT)
//   2. Upstash Redis        (KV_REST_API_URL / KV_REST_API_TOKEN)
//   3. products.json file   (your own computer)
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = !hasFirebase && url && token ? new Redis({ url, token }) : null;
const KEY = "flavds:products";

const FILE = path.join(process.cwd(), "data", "products.json");
export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

const col = () => db().collection("products");

export async function getProducts() {
  if (hasFirebase) {
    const snap = await col().get();
    let list = snap.docs.map((d) => d.data()).sort((a, b) => a.id - b.id);
    if (!list.length) {
      // First run only: load the 36 starter products
      const flag = db().collection("meta").doc("seeded");
      if (!(await flag.get()).exists) {
        const batch = db().batch();
        seed.forEach((p) => batch.set(col().doc(String(p.id)), p));
        batch.set(flag, { at: Date.now() });
        await batch.commit();
        list = seed;
      }
    }
    return list;
  }
  if (redis) {
    let list = await redis.get(KEY);
    if (!Array.isArray(list)) {
      list = seed;
      await redis.set(KEY, list);
    }
    return list;
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function save(list) {
  if (redis) return void (await redis.set(KEY, list));
  if (process.env.VERCEL) {
    throw new Error("Database is not connected. Add FIREBASE_SERVICE_ACCOUNT in Vercel, then Redeploy.");
  }
  await fs.writeFile(FILE, JSON.stringify(list, null, 2));
}

// Returns a clean product object or null if the input is invalid
export function clean(input) {
  const name = String(input?.name ?? "").trim().slice(0, 120);
  const price = Number(input?.price);
  const category = String(input?.category ?? "");
  const image = String(input?.image ?? "");
  if (!name || !Number.isFinite(price) || price < 0) return null;
  if (!CATEGORIES.includes(category)) return null;
  if (image && !image.startsWith("/api/uploads/") && !/^https:\/\//.test(image)) return null;
  return { name, price: Math.round(price), category, image, inStock: input?.inStock !== false };
}

export async function removeUpload(img) {
  if (typeof img !== "string") return;
  try {
    if (img.startsWith("https://firebasestorage.googleapis.com/")) {
      const p = decodeURIComponent(img.split("/o/")[1].split("?")[0]);
      await bucket().file(p).delete();
    } else if (img.includes(".blob.vercel-storage.com")) {
      await del(img);
    } else if (img.startsWith("/api/uploads/")) {
      await fs.unlink(path.join(UPLOAD_DIR, path.basename(img)));
    }
  } catch {
    /* old image already gone: ignore */
  }
}

export async function addProduct(data) {
  const list = await getProducts();
  const item = { id: Math.max(0, ...list.map((p) => p.id)) + 1, ...data };
  if (hasFirebase) {
    await col().doc(String(item.id)).set(item);
  } else {
    list.push(item);
    await save(list);
  }
  return item;
}

export async function updateProduct(id, data) {
  const list = await getProducts();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return null;
  if (list[i].image && list[i].image !== data.image) await removeUpload(list[i].image);
  const item = { id, ...data };
  if (hasFirebase) {
    await col().doc(String(id)).set(item);
  } else {
    list[i] = item;
    await save(list);
  }
  return item;
}

export async function deleteProduct(id) {
  const list = await getProducts();
  const item = list.find((p) => p.id === id);
  if (!item) return false;
  await removeUpload(item.image);
  if (hasFirebase) {
    await col().doc(String(id)).delete();
  } else {
    await save(list.filter((p) => p.id !== id));
  }
  return true;
}
