/** Language from the social identity plan — show first, depth second. */

export const SOCIAL_IDENTITY = {
  eyebrow: "SHOW YOURSELF",
  communityTitle: "People unmasking together",
  communityLead:
    "Photo and story first. Attach what you use and what happened when you are ready.",
  myUnmaskTitle: "My Unmask",
  myUnmaskLead:
    "Your beauty identity: what you use, your routine, and your product timelines.",
  habitLine: "This is me. This is what I use. This is what happened.",
} as const;

export const IDENTITY_PROMPTS = [
  {
    title: "Share a moment",
    line: "Photo or video with what you are using now.",
    href: "/contribute",
  },
  {
    title: "Show your shelf",
    line: "What is in your routine right now?",
    href: "/products",
  },
  {
    title: "Start a timeline",
    line: "One product. Document the journey.",
    href: "/products/add",
  },
] as const;
