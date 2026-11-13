import type { Category } from "@/lib/db/schema";

export type CategoryChoice = Pick<Category, "id" | "name" | "hides">;

/** The category a new merchandise starts in: the first that isn't the hides', else the first. */
export function defaultCategory(categories: CategoryChoice[]) {
  return (categories.find((c) => !c.hides) ?? categories[0])?.id;
}

/** The shop's categories to choose a merchandise's from, read by `readProductIdentity`. */
export function CategorySelect({
  id,
  categories,
  value,
  onChange,
}: {
  id: string;
  categories: CategoryChoice[];
  value: number | undefined;
  onChange: (id: number) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>Catégorie</label>
      <select id={id} name="categoryId" value={value} required onChange={(e) => onChange(Number(e.target.value))}>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
