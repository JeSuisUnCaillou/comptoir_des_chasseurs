import { APP_LOGO } from "@/lib/logo";

// The app's mark is the favicon itself (public/icon.svg, served at /icon.svg);
// inside a shop, the logo its gérant uploaded, when there is one.
export function BrandMark({ src = APP_LOGO }: { src?: string }) {
  return <img className="brand-mark" src={src} alt="" aria-hidden="true" />;
}
