import type { Page } from "@playwright/test";

/** Closer than this, two framed blocks read as stuck together. */
export const MIN_GAP = 4;

/**
 * The framed blocks of the page (panels, tiles, cards, buttons, fields: anything
 * with a frame, a background or a shadow) that touch or overlap a neighbour,
 * described for a failure message. Empty when every block keeps its distance.
 */
export function touchingBlocks(page: Page) {
  return page.evaluate((minGap) => {
    const clear = (color: string) => color === "transparent" || /rgba\(.*,\s*0\)$/.test(color);
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    type Side = (typeof sides)[number];
    /** Which of its sides show where the element ends: a border, or all four for a background or a field. */
    const edges = (el: Element): Set<Side> => {
      const style = getComputedStyle(el);
      if (style.visibility !== "visible" || Number(style.opacity) === 0) return new Set();
      if (el.matches("input[type=checkbox], input[type=radio], input[type=hidden], td, th, tr")) return new Set();
      const whole =
        el.matches("button, input, select, textarea") ||
        !clear(style.backgroundColor) ||
        style.backgroundImage !== "none" ||
        style.boxShadow !== "none";
      return new Set(
        sides.filter(
          (side) => whole || (parseFloat(style[`border${side}Width`]) > 0 && !clear(style[`border${side}Color`])),
        ),
      );
    };
    const describe = (el: Element) => {
      const text = (el as HTMLElement).innerText?.trim().replace(/\s+/g, " ").slice(0, 40);
      const label = text || el.getAttribute("aria-label") || (el as HTMLInputElement).value || "";
      return `${el.tagName.toLowerCase()}${[...el.classList].map((c) => `.${c}`).join("")} « ${label} »`;
    };
    const blocks = [...document.querySelectorAll("body *")]
      // The app's frame (menu, top bar) is laid out edge to edge on purpose.
      .filter((el) => !el.closest(".sidebar, .topbar"))
      .filter((el) => {
        // Floating things (menus, pins, sticky bars) sit over the page on purpose.
        for (let at: Element | null = el; at; at = at.parentElement) {
          if (["absolute", "fixed", "sticky"].includes(getComputedStyle(at).position)) return false;
        }
        return true;
      })
      .map((el) => ({ el, box: el.getBoundingClientRect(), edges: edges(el) }))
      .filter(({ box, edges }) => edges.size > 0 && box.width >= 1 && box.height >= 1);

    const found: string[] = [];
    for (const [i, a] of blocks.entries()) {
      for (const b of blocks.slice(i + 1)) {
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        // How far apart they are across each axis: negative when they overlap on it.
        const apartX = Math.max(b.box.left - a.box.right, a.box.left - b.box.right);
        const apartY = Math.max(b.box.top - a.box.bottom, a.box.top - b.box.bottom);
        // Facing each other on one axis (overlapping on the other), closer than the
        // minimum, with both facing sides drawn: a border, a background, a field.
        const [left, right] = a.box.left <= b.box.left ? [a, b] : [b, a];
        const [top, bottom] = a.box.top <= b.box.top ? [a, b] : [b, a];
        const touching =
          (apartY < 0 && apartX < minGap - 0.5 && left.edges.has("Right") && right.edges.has("Left")) ||
          (apartX < 0 && apartY < minGap - 0.5 && top.edges.has("Bottom") && bottom.edges.has("Top"));
        if (touching) {
          const gap = Math.round(Math.max(apartX, apartY));
          found.push(`${describe(a.el)} et ${describe(b.el)} : ${gap} px`);
        }
      }
    }
    return found;
  }, MIN_GAP);
}
