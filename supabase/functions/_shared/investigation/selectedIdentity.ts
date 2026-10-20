/** Do not narrow a selected product to a model/variant invented during web synthesis. */
export function selectedIdentityDetail(selectedName: string, candidate: string): string {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const detail = normalize(candidate);
  return detail && (` ${normalize(selectedName)} `).includes(` ${detail} `) ? candidate : "";
}

/** Remove duplicate listing brand phrases and quotation artifacts before discovery. */
export function cleanSelectedProductName(value: string): string {
  let name = value.replace(/[\\"]/g, "").replace(/\s+/g, " ").trim();
  for (let pass = 0; pass < 3; pass++) {
    const next = name.replace(/\b((?:[\p{L}\p{N}&'-]+\s+){1,5}[\p{L}\p{N}&'-]+)\s+\1\b/giu, "$1");
    if (next === name) break;
    name = next;
  }
  return name;
}
