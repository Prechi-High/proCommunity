function flag(name: string, fallback: boolean): boolean {
  const v = (Deno.env.get(name) ?? "").toLowerCase();
  if (!v) return fallback;
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export const domainFlags = {
  dynamicDomainResolution: () => flag("DYNAMIC_DOMAIN_RESOLUTION", true),
  inferredDomainCreation: () => flag("INFERRED_DOMAIN_CREATION", true),
  inferredDomainTemplates: () => flag("INFERRED_DOMAIN_TEMPLATES", true),
  inferredDomainNotice: () => flag("INFERRED_DOMAIN_NOTICE", true),
  inferredDomainVoting: () => flag("INFERRED_DOMAIN_VOTING", true),
};
