"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, naira } from "../../lib/shop";

const EMPTY = { name: "", price: "", category: CATEGORIES[1], image: "", inStock: true };

// Shrinks phone photos before upload so they load fast on the site
async function compress(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.82));
  } catch {
    return file;
  }
}

export default function Dashboard({ initial }) {
  const router = useRouter();
  const fileRef = useRef(null);
  const [items, setItems] = useState(initial);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [q, setQ] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function reload() {
    setItems(await (await fetch("/api/products", { cache: "no-store" })).json());
  }

  function reset() {
    setForm(EMPTY);
    setEditing(null);
    setFile(null);
    setPreview("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function pickFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function edit(p) {
    setEditing(p.id);
    setForm({ name: p.name, price: p.price, category: p.category, image: p.image, inStock: p.inStock !== false });
    setFile(null);
    setPreview("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      let image = form.image;
      if (file) {
        const fd = new FormData();
        fd.append("file", await compress(file), "photo.jpg");
        const up = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(data.error || `Image upload failed (error ${up.status})`);
        image = data.url;
      }
      const r = await fetch(editing ? `/api/products/${editing}` : "/api/products", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image, price: Number(form.price) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Could not save (error ${r.status})`);
      setMsg({ type: "ok", text: editing ? "Product updated." : "Product added." });
      reset();
      await reload();
    } catch (err) {
      setMsg({ type: "err", text: err.message });
    }
    setBusy(false);
  }

  async function remove(p) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await fetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (editing === p.id) reset();
    await reload();
  }

  async function toggleStock(p) {
    await fetch(`/api/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, inStock: !(p.inStock !== false) }),
    });
    await reload();
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const shown = items.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const currentImg = preview || form.image;

  return (
    <div className="admin wrap">
      <div className="admin-top">
        <div>
          <p className="brand">Flav’Ds <span>Admin</span></p>
          <p className="muted">{items.length} products</p>
        </div>
        <div className="actions">
          <a className="btn btn-line small" href="/" target="_blank" rel="noopener noreferrer">View site</a>
          <button className="btn btn-line small" onClick={logout}>Log out</button>
        </div>
      </div>

      <form className="panel form" onSubmit={submit}>
        <h2>{editing ? "Edit product" : "Add a product"}</h2>
        <div className="form-grid">
          <div className="fields">
            <label>Product name
              <input value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
            </label>
            <label>Price (₦)
              <input type="number" min="0" inputMode="numeric" value={form.price} onChange={(e) => set("price", e.target.value)} required />
            </label>
            <label>Category
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.inStock} onChange={(e) => set("inStock", e.target.checked)} />
              In stock
            </label>
          </div>
          <div className="imgpick">
            <div className="imgbox">
              {currentImg ? <img src={currentImg} alt="Product preview" /> : <span className="muted">No image yet</span>}
            </div>
            <label className="btn btn-line small filebtn">
              {currentImg ? "Change image" : "Choose image"}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} hidden />
            </label>
            {form.image && !file && (
              <button type="button" className="linkbtn" onClick={() => set("image", "")}>Remove image</button>
            )}
          </div>
        </div>
        {msg.text && <p className={msg.type === "ok" ? "ok" : "err"} role="status">{msg.text}</p>}
        <div className="actions">
          <button className="btn btn-gold" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add product"}</button>
          {editing && <button type="button" className="btn btn-line" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="list-head">
        <h2>All products</h2>
        <input type="search" placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="alist">
        {shown.map((p) => (
          <li key={p.id} className="arow">
            <div className="athumb">{p.image ? <img src={p.image} alt="" /> : <span>{p.name[0]}</span>}</div>
            <div className="ainfo">
              <strong>{p.name}</strong>
              <span className="muted">{p.category} · {naira(p.price)}</span>
            </div>
            <button className={p.inStock !== false ? "pill on" : "pill"} onClick={() => toggleStock(p)}>
              {p.inStock !== false ? "In stock" : "Out of stock"}
            </button>
            <button className="btn btn-line small" onClick={() => edit(p)}>Edit</button>
            <button className="btn btn-danger small" onClick={() => remove(p)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
