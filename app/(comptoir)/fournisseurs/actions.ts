"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { getDb, isUniqueViolation, schema } from "@/lib/db";

// `at` changes on every success, so a form can clear itself by key.
export type SupplierFormState = { ok: boolean; message: string; at?: number } | null;

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function id(formData: FormData, key = "id") {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

/** Creates a supplier, or updates it when the form carries its id. */
export async function saveSupplier(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  await requireMember(["gerant"]);
  const supplierId = id(formData);
  const values = {
    name: text(formData, "name", 100),
    place: text(formData, "place", 100),
    notes: text(formData, "notes", 300),
  };
  if (Number.isNaN(supplierId)) return { ok: false, message: "Fournisseur inconnu." };
  if (!values.name) return { ok: false, message: "Le nom est obligatoire." };

  let savedId = supplierId;
  try {
    if (supplierId != null) {
      const updated = await getDb()
        .update(schema.suppliers)
        .set(values)
        .where(eq(schema.suppliers.id, supplierId))
        .returning({ id: schema.suppliers.id });
      if (updated.length === 0) return { ok: false, message: "Ce fournisseur n'existe plus." };
    } else {
      const [created] = await getDb()
        .insert(schema.suppliers)
        .values(values)
        .returning({ id: schema.suppliers.id });
      savedId = created.id;
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, message: "Un fournisseur porte déjà ce nom." };
    throw error;
  }
  revalidatePath("/fournisseurs", "layout");
  // A new supplier goes straight to its page, to add what it sells.
  if (supplierId == null) redirect(`/fournisseurs/${savedId}`);
  return { ok: true, message: "Fournisseur enregistré." };
}

/** Adds a merchandise to a supplier, or changes its price if already offered. */
export async function saveOffer(_prev: SupplierFormState, formData: FormData): Promise<SupplierFormState> {
  await requireMember(["gerant"]);
  const supplierId = id(formData, "supplierId");
  const productId = id(formData, "productId");
  const price = Number(formData.get("price"));
  const qty = Number(formData.get("qty") || 1);
  if (!supplierId || !productId) return { ok: false, message: "Choisis une marchandise." };
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
    return { ok: false, message: "Le prix est un nombre entier de septims, 0 ou plus." };
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000) {
    return { ok: false, message: "Un prix se donne pour au moins 1 unité." };
  }
  const db = getDb();
  const [[supplier], [product]] = await Promise.all([
    db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.id, supplierId)),
    db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, productId)),
  ]);
  if (!supplier) return { ok: false, message: "Ce fournisseur n'existe plus." };
  if (!product) return { ok: false, message: "Marchandise inconnue." };
  await db
    .insert(schema.supplierOffers)
    .values({ supplierId, productId, price, qty })
    .onConflictDoUpdate({
      target: [schema.supplierOffers.supplierId, schema.supplierOffers.productId],
      set: { price, qty },
    });
  revalidatePath("/fournisseurs", "layout");
  return { ok: true, message: "Marchandise enregistrée.", at: Date.now() };
}

export async function removeOffer(formData: FormData) {
  await requireMember(["gerant"]);
  const offerId = id(formData);
  const supplierId = id(formData, "supplierId");
  if (!offerId || !supplierId) return;
  await getDb()
    .delete(schema.supplierOffers)
    .where(and(eq(schema.supplierOffers.id, offerId), eq(schema.supplierOffers.supplierId, supplierId)));
  revalidatePath("/fournisseurs", "layout");
}

export async function deleteSupplier(formData: FormData) {
  await requireMember(["gerant"]);
  const supplierId = id(formData);
  if (supplierId) {
    // Its offers go with it (on delete cascade).
    await getDb().delete(schema.suppliers).where(eq(schema.suppliers.id, supplierId));
  }
  revalidatePath("/fournisseurs", "layout");
  redirect("/fournisseurs");
}
