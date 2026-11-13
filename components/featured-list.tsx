"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, X } from "lucide-react";
import { saveFeatured, saveFeaturedOrder } from "@/app/[boutique]/marchandises/actions";

type Item = { id: number; name: string };

/** Where the dragged item goes: after every other item whose middle is above the pointer. */
function dropIndex(list: HTMLElement, order: Item[], dragged: number, y: number) {
  return order.filter((p, i) => {
    if (p.id === dragged) return false;
    const box = list.children[i]?.getBoundingClientRect();
    return box != null && box.top + box.height / 2 < y;
  }).length;
}

function moved(order: Item[], id: number, to: number) {
  const item = order.find((p) => p.id === id)!;
  const rest = order.filter((p) => p.id !== id);
  return [...rest.slice(0, to), item, ...rest.slice(to)];
}

const sameOrder = (a: Item[], b: Item[]) => a.map((p) => p.id).join() === b.map((p) => p.id).join();

/**
 * The featured products in Gérer les marchandises, in their order on the
 * Tarifs. A product moves by dragging its handle (mouse or finger), or with the
 * arrow keys once its handle has the focus; the new order is saved when it is
 * dropped. Each has its cross to take it back.
 */
export function FeaturedList({ products }: { products: Item[] }) {
  const [order, setOrder] = useState(products);
  const [dragging, setDragging] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const list = useRef<HTMLUListElement>(null);

  // A new list from the server (a product added or taken back) wins.
  const [received, setReceived] = useState(products);
  if (!sameOrder(received, products)) {
    setReceived(products);
    setOrder(products);
  }

  // Moving an element in the page loses its focus: the keyboard gives it back.
  useEffect(() => {
    if (focus == null) return;
    list.current?.querySelector<HTMLElement>(`[data-handle="${focus}"]`)?.focus();
    setFocus(null);
  }, [focus]);

  function save(next: Item[]) {
    setOrder(next);
    if (sameOrder(next, products)) return;
    startTransition(async () => {
      // Refused (the list changed meanwhile): back to the list as the server has it now.
      if (!(await saveFeaturedOrder(next.map((p) => p.id)))) {
        setOrder(products);
        router.refresh();
      }
    });
  }

  function start(e: PointerEvent<HTMLButtonElement>, id: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(id);
  }

  function move(e: PointerEvent<HTMLButtonElement>) {
    if (dragging == null || !list.current) return;
    const next = moved(order, dragging, dropIndex(list.current, order, dragging, e.clientY));
    if (!sameOrder(next, order)) setOrder(next);
  }

  function drop() {
    if (dragging == null) return;
    setDragging(null);
    save(order);
  }

  function key(e: KeyboardEvent<HTMLButtonElement>, id: number, index: number) {
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = index + step;
    if (to < 0 || to >= order.length) return;
    save(moved(order, id, to));
    setFocus(id);
  }

  return (
    <ul ref={list} className="featured-list" aria-label="Produits phares actuels">
      {order.map((p, i) => (
        <li key={p.id} className={dragging === p.id ? "dragging" : undefined}>
          <button
            type="button"
            className="icon-btn drag-handle"
            data-handle={p.id}
            title="Glisser pour changer l'ordre (ou flèches du clavier)"
            aria-label={`Déplacer ${p.name}`}
            onPointerDown={(e) => start(e, p.id)}
            onPointerMove={move}
            onPointerUp={drop}
            onPointerCancel={drop}
            onKeyDown={(e) => key(e, p.id, i)}
          >
            <GripVertical size={16} />
          </button>
          <span className="featured-name">{p.name}</span>
          <form action={saveFeatured}>
            <input type="hidden" name="productId" value={p.id} />
            <button className="icon-btn" type="submit" title={`Retirer ${p.name}`} aria-label={`Retirer ${p.name}`}>
              <X size={16} />
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
