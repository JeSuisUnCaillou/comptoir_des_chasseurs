import type { AnnouncementPin } from "@/lib/db/schema";

/** What holds a parchment on the board, drawn in a 64×64 box. */
export function PinIcon({ pin, size = 48 }: { pin: AnnouncementPin; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`pin-icon pin-${pin}`}>
      {pin === "couteau" && <Knife />}
      {pin === "hache" && <Axe />}
      {pin === "viande" && <Meat />}
    </svg>
  );
}

function Knife() {
  return (
    <g transform="rotate(35 32 32)">
      <ellipse cx="34" cy="60" rx="7" ry="2" fill="#000" opacity="0.25" />
      {/* blade, its tip stuck in the board */}
      <path d="M28 30 L36 30 L33 58 L31 58 Z" fill="#c9ced3" stroke="#5d646b" strokeWidth="1" />
      <path d="M32 31 L32.6 56" stroke="#eef1f4" strokeWidth="1" />
      {/* guard */}
      <rect x="25" y="27" width="14" height="4" rx="1.5" fill="#8b6a3a" stroke="#4a3417" strokeWidth="1" />
      {/* handle */}
      <rect x="28.5" y="6" width="7" height="22" rx="3" fill="#7a4a24" stroke="#3d2410" strokeWidth="1" />
      <path d="M29 11h6M29 16h6M29 21h6" stroke="#4a2c14" strokeWidth="1.4" />
      <circle cx="32" cy="5.5" r="3" fill="#8b6a3a" stroke="#4a3417" strokeWidth="1" />
    </g>
  );
}

function Axe() {
  return (
    <g transform="rotate(-25 32 32)">
      <ellipse cx="32" cy="60" rx="8" ry="2" fill="#000" opacity="0.25" />
      {/* haft */}
      <rect x="29.5" y="4" width="5" height="56" rx="2.5" fill="#8a5a2b" stroke="#3d2410" strokeWidth="1" />
      <path d="M30 46h4M30 50h4M30 54h4" stroke="#3d2410" strokeWidth="1.2" />
      {/* bearded head */}
      <path
        d="M30 12 L14 8 C8 16 8 30 16 38 L22 30 L30 26 Z"
        fill="#aeb4b9"
        stroke="#4f565c"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M14 10 C9.5 17 9.5 29 15.5 36" stroke="#e6e9ec" strokeWidth="1.6" fill="none" />
      <rect x="28" y="9" width="8" height="19" rx="2" fill="#6f767c" stroke="#3d4247" strokeWidth="1" />
    </g>
  );
}

function Meat() {
  return (
    <g>
      <ellipse cx="33" cy="56" rx="20" ry="4" fill="#000" opacity="0.25" />
      <path
        d="M10 30 C8 16 22 7 36 9 C50 11 58 22 54 35 C50 48 34 54 22 49 C14 46 11 39 10 30 Z"
        fill="#8e2f2a"
        stroke="#4a1512"
        strokeWidth="1.5"
      />
      <path
        d="M14 30 C13 19 24 12 35 13 C47 14 53 23 50 33 C47 43 34 48 24 45 C18 43 15 37 14 30 Z"
        fill="#b0443c"
      />
      <path
        d="M19 31 C20 22 30 18 38 21 C45 24 46 31 40 34 C33 37 30 30 25 33 C22 35 19 35 19 31 Z"
        fill="none"
        stroke="#f2c9b8"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </g>
  );
}
