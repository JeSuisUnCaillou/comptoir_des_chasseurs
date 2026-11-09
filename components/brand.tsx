import { Gavel } from "lucide-react";

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true">
      <Gavel size={size} />
    </span>
  );
}
