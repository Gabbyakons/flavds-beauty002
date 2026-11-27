import { NextResponse } from "next/server";
import { isAdmin } from "../../../lib/auth";
import { addProduct, clean, getProducts } from "../../../lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getProducts());
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const data = clean(await req.json().catch(() => null));
  if (!data) return NextResponse.json({ error: "Check the product details" }, { status: 400 });
  try {
    return NextResponse.json(await addProduct(data), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Could not save" }, { status: 500 });
  }
}
