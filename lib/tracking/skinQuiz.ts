export type SkinEstimate = "Dry" | "Oily" | "Combination" | "Normal";
export const skinQuestions = [
  {
    key: "cleansing",
    title: "After gentle cleansing, how does your skin usually feel?",
    hint: "Think about your usual experience. You don’t need to wash your face now.",
    imageDescription:
      "A person touching their cheek after gentle cleansing, beside a mirror.",
    options: [
      ["tight", "Tight, rough or flaky"],
      ["comfortable", "Comfortable and balanced"],
      ["oily", "Oily or greasy all over"],
      ["mixed", "Dry cheeks, oilier forehead or nose"],
      ["unsure", "I’m not sure"],
    ],
  },
  {
    key: "shine",
    title: "By the afternoon, where do you usually notice shine?",
    hint: "Look at your forehead, nose and cheeks. Lighting alone can make skin look shiny.",
    imageDescription:
      "A person checking forehead shine with a mirror and blotting paper.",
    options: [
      ["all", "Across most of my face"],
      ["tzone", "Mostly my forehead and nose"],
      ["none", "Very little shine"],
      ["unsure", "I’m not sure"],
    ],
  },
  {
    key: "sensitivity",
    title:
      "Do skincare products often make your skin sting, burn or feel irritated?",
    hint: "Answer from past experience. Don’t apply a product to test this.",
    imageDescription:
      "A person gently touching a mildly irritated cheek, next to an unbranded bottle.",
    options: [
      ["often", "Often"],
      ["sometimes", "Sometimes"],
      ["rarely", "Rarely or never"],
      ["unsure", "I’m not sure"],
    ],
  },
  {
    key: "usual",
    title: "Across a usual week, which pattern fits your skin best?",
    hint: "Think about most days, rather than straight after washing or applying a product. This helps when your earlier answers differ.",
    imageDescription:
      "A person looking closely at their cheek and forehead in a mirror to consider their usual skin pattern.",
    options: [
      ["dry", "Mostly dry, tight or flaky"],
      ["oily", "Mostly oily across my face"],
      ["combination", "Oily in some areas, dry or comfortable in others"],
      ["normal", "Mostly comfortable, without much dryness or oil"],
      ["unsure", "It changes too much to tell"],
    ],
  },
] as const;
export function estimateSkin(answers: string[]): {
  type: SkinEstimate | null;
  sensitive: boolean;
} {
  const [feel, shine, sensitivity, usual] = answers;
  // A direct description of the usual pattern resolves temporary post-cleansing contradictions.
  const patterns: Record<string, SkinEstimate> = {
    dry: "Dry",
    oily: "Oily",
    combination: "Combination",
    normal: "Normal",
  };
  let type: SkinEstimate | null = patterns[usual] || null;
  if (!type) {
    if (feel === "mixed" || shine === "tzone") type = "Combination";
    else if (feel === "tight" && shine === "none") type = "Dry";
    else if (feel === "oily" && shine === "all") type = "Oily";
    else if (feel === "comfortable" && shine === "none") type = "Normal";
    // A clear observation is still useful if the other answer is unknown.
    else if (!feel || feel === "unsure") type = shine === "all" ? "Oily" : null;
    else if (!shine || shine === "unsure")
      type =
        (
          { tight: "Dry", oily: "Oily", comfortable: "Normal" } as Record<
            string,
            SkinEstimate
          >
        )[feel] || null;
  }
  return { type, sensitive: ["often", "sometimes"].includes(sensitivity) };
}
