/** In-app and iPad layouts stay a phone column. The marketing page widens only on a true desktop. */
export const PHONE_FRAME = 440;
export const CINEMATIC_AT = 1100;

export function isMarketingPath(path: string): boolean {
  const bare = path.replace(/\/\([^/]+\)/g, "").replace(/\/index$/, "") || "/";
  return bare === "/" || bare === "/welcome";
}
