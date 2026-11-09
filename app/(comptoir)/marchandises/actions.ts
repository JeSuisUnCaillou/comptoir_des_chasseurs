"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/session";
import { getDb, isUniqueViolation, schema } from "@/lib/db";
import { productCategory, type ProductCategory } from "@/lib/db/schema";

export type ProductFormState = { error: string } | null;

function optionalInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

function positiveInt(formData: FormData, key: string) {
  const n = optionalInt(formData, key);
  return n == null ? 1 : n;
}

export async function saveProduct(_prev: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireMember(["gerant"]);
  const id = optionalInt(formData, "id");
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  const category = String(formData.get("category")) as ProductCategory;
  const unit = String(formData.get("unit") ?? "").trim().slice(0, 30) || "pièce";

  const values = {
    name,
    category,
    unit,
    buyPrice: optionalInt(formData, "buyPrice"),
    buyQty: positiveInt(formData, "buyQty"),
    sellPrice: optionalInt(formData, "sellPrice"),
    sellQty: positiveInt(formData, "sellQty"),
    bulkMin: optionalInt(formData, "bulkMin"),
    bulkPrice: optionalInt(formData, "bulkPrice"),
    bulkQty: positiveInt(formData, "bulkQty"),
    hidesPerBatch: category === "peau" ? optionalInt(formData, "hidesPerBatch") : null,
    leatherPerBatch: category === "peau" ? optionalInt(formData, "leatherPerBatch") : null,
    archived: formData.get("archived") === "on",
  };

  if (!name) return { error: "Le nom est obligatoire." };
  if (!productCategory.enumValues.includes(category)) return { error: "Catégorie inconnue." };
  const numbers = Object.values(values).filter((v) => typeof v === "number") as number[];
  if (numbers.some((n) => Number.isNaN(n))) {
    return { error: "Les prix et quantités doivent être des nombres entiers positifs." };
  }
  if ([values.buyQty, values.sellQty, values.bulkQty].some((n) => n < 1)) {
    return { error: "Un prix se donne pour au moins 1 unité." };
  }
  if ((values.hidesPerBatch == null) !== (values.leatherPerBatch == null)) {
    return { error: "Indique les peaux ET les cuirs de la transformation, ou aucun des deux." };
  }

  const db = getDb();
  try {
    if (id != null && !Number.isNaN(id)) {
      await db.update(schema.products).set(values).where(eq(schema.products.id, id));
    } else {
      await db.insert(schema.products).values(values);
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Une marchandise porte déjà ce nom." };
    }
    throw error;
  }
  revalidatePath("/", "layout");
  redirect("/marchandises");
}

export async function saveBlacksmithPrice(formData: FormData) {
  await requireMember(["gerant"]);
  const value = Number(formData.get("value"));
  if (!Number.isInteger(value) || value < 0) return;
  await getDb()
    .insert(schema.settings)
    .values({ key: "prix_forgeron_cuir", value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  revalidatePath("/", "layout");
}
