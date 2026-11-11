import type { AnnouncementPin } from "@/lib/db/schema";

/** What can hold a parchment on the board, in the order the form shows them. */
export const PINS: { value: AnnouncementPin; label: string }[] = [
  { value: "couteau", label: "Couteau" },
  { value: "hache", label: "Hache nordique" },
  { value: "viande", label: "Morceau de viande" },
];

export const TITLE_MAX = 120;
export const BODY_MAX = 4000;

