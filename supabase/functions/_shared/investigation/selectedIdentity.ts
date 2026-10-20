/** Do not narrow a selected product to a model/variant invented during web synthesis. */
export function selectedIdentityDetail(selectedName: string, candidate: string): string {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const detail = normalize(candidate);
  return detail && (` ${normalize(selectedName)} `).includes(` ${detail} `) ? candidate : "";
}
