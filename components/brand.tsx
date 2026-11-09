// The app's mark is the favicon itself (app/icon.svg, served at /icon.svg).
export function BrandMark() {
  return (
    <img className="brand-mark" src="/icon.svg" alt="" aria-hidden="true" />
  );
}
