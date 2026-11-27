import { NextResponse } from "next/server";
import { isAdmin } from "../../../../lib/auth";
import { clean, deleteProduct, updateProduct } from "../../../../lib/store";

export async function PUT(req, { params }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const data = clean(await req.json().catch(() => null));
  if (!data) return NextResponse.json({ error: "Check the product details" }, { status: 400 });
  try {
    const item = await updateProduct(Number(params.id), data);
    return item ? NextResponse.json(item) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Could not save" }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  if (!isAdmin()) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  try {
    const ok = await deleteProduct(Number(params.id));
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
  } catch (err) {
    return NextResponse.json({ error: err?.message || "Could not delete" }, { status: 500 });
  }
}
