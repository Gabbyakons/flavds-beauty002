import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { bucket, hasStorage } from "../../../lib/firebase";
import { UPLOAD_DIR } from "../../../lib/store";

const TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const fail = (msg, status = 500) => NextResponse.json({ error: msg }, { status });

export async function POST(req) {
  if (!isAdmin()) return fail("Not allowed", 401);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") return fail("No image received", 400);
  const ext = TYPES[file.type];
  if (!ext) return fail("Use a JPG, PNG or WebP image", 400);
  if (file.size > 4 * 1024 * 1024) return fail("Image is larger than 4 MB", 400);
  const name = crypto.randomBytes(10).toString("hex") + ext;

  // 1. Firebase Storage
  if (hasStorage) {
    try {
      const filePath = `products/${name}`;
      const dl = crypto.randomUUID();
      await bucket().file(filePath).save(Buffer.from(await file.arrayBuffer()), {
        resumable: false,
        contentType: file.type,
        metadata: {
          cacheControl: "public, max-age=31536000",
          metadata: { firebaseStorageDownloadToken: dl },
        },
      });
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket().name}/o/${encodeURIComponent(filePath)}?alt=media&token=${dl}`;
      return NextResponse.json({ url });
    } catch (err) {
      return fail("Firebase Storage error: " + (err?.message || "unknown"));
    }
  }

  // 2. Vercel Blob
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) {
    try {
      const blob = await put(`products/${name}`, file, { access: "public", contentType: file.type });
      return NextResponse.json({ url: blob.url });
    } catch (err) {
      return fail("Image storage error: " + (err?.message || "unknown"));
    }
  }

  if (process.env.VERCEL) {
    return fail("Image storage is not connected. Add FIREBASE_STORAGE_BUCKET (or a public Vercel Blob store), then Redeploy.");
  }

  // 3. Your own computer
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: `/api/uploads/${name}` });
}
