import type { Product, ProductCategory } from "@/lib/db/schema";
import { PRIVILEGED_PREFIX } from "@/lib/forms";

/** A privileged group, as the price fields show it. */
export type GroupChoice = { id: number; name: string };

function NumberField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: number | null;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={`${id}-${name}`}>{label}</label>
      <input
        id={`${id}-${name}`}
        name={name}
        type="number"
        min={0}
        step={1}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * A merchandise's price fields, read by `readProductPrices`: buying, selling,
 * the shop's privileged groups, bulk, and the leather batch for hides. `id`
 * prefixes the inputs' ids.
 */
export function ProductPriceFields({
  id,
  category,
  product,
  groups,
}: {
  id: string;
  category: ProductCategory;
  product?: Product & { privileged: { groupId: number; price: number }[] };
  groups: GroupChoice[];
}) {
  return (
    <>
      <h3>Achat (on paie)</h3>
      <div className="form-grid">
        <NumberField id={id} name="buyPrice" label="Prix en septims" defaultValue={product?.buyPrice} placeholder="Laisser vide si on n'en achète pas" />
        <NumberField id={id} name="buyQty" label="Pour (unités)" defaultValue={product?.buyQty ?? 1} />
        {groups.map((g) => (
          <NumberField
            key={g.id}
            id={id}
            name={`${PRIVILEGED_PREFIX}${g.id}`}
            label={`Prix pour : ${g.name}`}
            defaultValue={product?.privileged.find((p) => p.groupId === g.id)?.price}
            placeholder="Laisser vide si c'est le même prix"
          />
        ))}
      </div>

      <h3>Vente (on encaisse)</h3>
      <div className="form-grid">
        <NumberField id={id} name="sellPrice" label="Prix en septims" defaultValue={product?.sellPrice} placeholder="Laisser vide si on n'en vend pas" />
        <NumberField id={id} name="sellQty" label="Pour (unités)" defaultValue={product?.sellQty ?? 1} />
      </div>

      <h3>Vente en gros (facultatif)</h3>
      <div className="form-grid">
        <NumberField id={id} name="bulkMin" label="À partir de (unités)" defaultValue={product?.bulkMin} />
        <NumberField id={id} name="bulkPrice" label="Prix en septims" defaultValue={product?.bulkPrice} />
        <NumberField id={id} name="bulkQty" label="Pour (unités)" defaultValue={product?.bulkQty ?? 1} />
      </div>

      {category === "peau" && (
        <>
          <h3>Transformation en cuir</h3>
          <div className="form-grid">
            <NumberField id={id} name="hidesPerBatch" label="Peaux par lot" defaultValue={product?.hidesPerBatch} />
            <NumberField id={id} name="leatherPerBatch" label="Cuirs obtenus" defaultValue={product?.leatherPerBatch} />
          </div>
        </>
      )}
    </>
  );
}
