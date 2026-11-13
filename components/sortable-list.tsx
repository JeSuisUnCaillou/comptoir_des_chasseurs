"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent, type ReactNode } from "react";

type Item = { id: number; name: string };

const sameOrder = (a: Item[], b: Item[]) => a.map((p) => p.id).join() === b.map((p) => p.id).join();

/** The rows only move up and down. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function Row<T extends Item>({
  item,
  index,
  onKey,
  children,
}: {
  item: T;
  index: number;
  onKey: (e: KeyboardEvent<HTMLButtonElement>, id: number, index: number) => void;
  children: (item: T, handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className="icon-btn drag-handle"
      data-handle={item.id}
      title="Glisser pour changer l'ordre (ou flèches du clavier)"
      {...attributes}
      {...listeners}
      aria-label={`Déplacer ${item.name}`}
      onKeyDown={(e) => onKey(e, item.id, index)}
    >
      <GripVertical size={16} />
    </button>
  );
  return (
    <li
      ref={setNodeRef}
      className={isDragging ? "dragging" : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, position: "relative", zIndex: isDragging ? 1 : undefined }}
    >
      {children(item, handle)}
    </li>
  );
}

/**
 * A list a gérant puts in order: an item moves by dragging its handle (mouse
 * or finger), the others making room as it passes, or with the arrow keys once
 * its handle has the focus. `save` gets the new order once the item is
 * dropped; refused (false), the list goes back to the server's.
 */
export function SortableList<T extends Item>({
  items,
  label,
  className,
  save,
  children,
}: {
  items: T[];
  label: string;
  className: string;
  save: (ids: number[]) => Promise<boolean>;
  children: (item: T, handle: ReactNode) => ReactNode;
}) {
  const [order, setOrder] = useState(items);
  const [focus, setFocus] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  // A small move before a drag starts, so a tap on the handle stays a tap.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // A new list from the server (an item added, renamed or removed) wins.
  const [received, setReceived] = useState(() => JSON.stringify(items));
  if (received !== JSON.stringify(items)) {
    setReceived(JSON.stringify(items));
    setOrder(items);
  }

  // Moving an element in the page loses its focus: the keyboard gives it back.
  useEffect(() => {
    if (focus == null) return;
    list.current?.querySelector<HTMLElement>(`[data-handle="${focus}"]`)?.focus();
    setFocus(null);
  }, [focus]);

  function commit(next: T[]) {
    setOrder(next);
    if (sameOrder(next, items)) return;
    startTransition(async () => {
      if (!(await save(next.map((p) => p.id)))) {
        setOrder(items);
        router.refresh();
      }
    });
  }

  function dropped({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.findIndex((p) => p.id === active.id);
    const to = order.findIndex((p) => p.id === over.id);
    commit(arrayMove(order, from, to));
  }

  function key(e: KeyboardEvent<HTMLButtonElement>, itemId: number, index: number) {
    const step = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    const to = index + step;
    if (to < 0 || to >= order.length) return;
    commit(arrayMove(order, index, to));
    setFocus(itemId);
  }

  const name = (itemId: unknown) => order.find((p) => p.id === itemId)?.name ?? "";
  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[vertical]}
      onDragEnd={dropped}
      accessibility={{
        screenReaderInstructions: { draggable: "Glisse avec la souris ou le doigt, ou utilise les flèches haut et bas." },
        announcements: {
          onDragStart: ({ active }) => `${name(active.id)} est saisi.`,
          onDragOver: ({ active, over }) => (over ? `${name(active.id)} passe sur ${name(over.id)}.` : undefined),
          onDragEnd: ({ active }) => `${name(active.id)} est posé.`,
          onDragCancel: ({ active }) => `${name(active.id)} revient à sa place.`,
        },
      }}
    >
      <SortableContext items={order.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul ref={list} className={className} aria-label={label}>
          {order.map((item, i) => (
            <Row key={item.id} item={item} index={i} onKey={key}>
              {children}
            </Row>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
