import { useState } from "react";
import { Image, Text, View } from "react-native";
import {
  ActionButton,
  ActionSheet,
  FilterChips,
  Skeleton,
} from "@/components/unmask-ui";
import { fonts, colors } from "@/constants/theme";
import { skinQuestions, estimateSkin } from "@/lib/tracking/skinQuiz";
import { JournalProgress, ChoiceCards, journal } from "./JournalUI";
import { Label, Note } from "./Fields";
const pictures = [
  require("@/assets/journal/cleansing.webp"),
  require("@/assets/journal/shine.webp"),
  require("@/assets/journal/sensitivity.webp"),
  require("@/assets/journal/cleansing.webp"),
];
export function SkinTypeField({
  value,
  onChange,
  profileSkin,
}: {
  value: string;
  onChange: (v: string) => void;
  profileSkin?: string | null;
}) {
  const [open, setOpen] = useState(false),
    [step, setStep] = useState(0),
    [answers, setAnswers] = useState<string[]>([]),
    [loaded, setLoaded] = useState(-1),
    [estimate, setEstimate] = useState(false);
  const q = skinQuestions[step];
  const result = estimateSkin(answers);
  return (
    <View style={{ gap: 12 }}>
      <Label>Your skin type (optional)</Label>
      <Note>
        {profileSkin
          ? `From your profile: ${profileSkin}. You can choose different context here.`
          : "Choose what you know, or leave it unstated."}
      </Note>
      <FilterChips
        variant="chips"
        options={[
          "Not stated",
          "Dry",
          "Oily",
          "Combination",
          "Normal",
          "Sensitive",
        ]}
        value={value || "Not stated"}
        onChange={(v) => {
          onChange(v === "Not stated" ? "" : v);
          setEstimate(false);
        }}
      />
      <ActionButton
        tone="secondary"
        label="Not sure? Take a quick skin-type check"
        onPress={() => {
          setStep(0);
          setAnswers([]);
          setLoaded(-1);
          setOpen(true);
        }}
      />
      {estimate ? (
        <Note>
          This is an informal estimate from your answers. You can change it
          anytime.
        </Note>
      ) : null}
      <ActionSheet
        resetKey={step}
        open={open}
        onClose={() => setOpen(false)}
        title="Get to know your skin"
      >
        <Note>
          A short self-observation guide, not a diagnosis. Choose what is
          usually true for you. You can skip or change your answers.
        </Note>
        {step < skinQuestions.length ? (
          <>
            <JournalProgress
              step={step}
              labels={["Feel", "Shine", "Sensitivity", "Usual pattern"]}
            />
            <View
              style={{
                borderRadius: 22,
                overflow: "hidden",
                backgroundColor: journal.mint,
                aspectRatio: 1.6,
              }}
            >
              <Image
                key={q.key}
                accessibilityLabel={q.imageDescription}
                source={pictures[step]}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
                onLoad={() => setLoaded(step)}
                onError={() => setLoaded(step)}
              />
              {loaded !== step ? (
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", inset: 0 }}
                >
                  <Skeleton height={600} radius={22} />
                </View>
              ) : null}
            </View>
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 23,
                lineHeight: 30,
                color: journal.ink,
              }}
            >
              {q.title}
            </Text>
            <Note>Illustration only. Answer for your own skin.</Note>
            <Note>{q.hint}</Note>
            <ChoiceCards
              options={q.options.map(([value, label]) => ({ value, label }))}
              value={answers[step] || ""}
              onChange={(v) =>
                setAnswers((a) => {
                  const copy = [...a];
                  copy[step] = v;
                  return copy;
                })
              }
            />
            <ActionButton
              label={
                step === skinQuestions.length - 1
                  ? "See my estimate"
                  : "Next question"
              }
              disabled={!answers[step]}
              onPress={() => {
                setLoaded(-1);
                setStep((s) => s + 1);
              }}
            />
            {step > 0 ? (
              <ActionButton
                tone="ghost"
                label="Previous question"
                onPress={() => setStep((s) => s - 1)}
              />
            ) : null}
          </>
        ) : (
          <>
            <View
              style={{
                padding: 24,
                borderRadius: 24,
                backgroundColor: journal.mint,
                gap: 13,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 12,
                  color: journal.green,
                }}
              >
                YOUR ANSWERS SUGGEST
              </Text>
              <Text
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 30,
                  color: journal.ink,
                }}
              >
                {result.type ? `${result.type} skin` : "No clear pattern yet"}
              </Text>
              <Note>
                {result.type
                  ? "We compared your cleansing feel, daytime shine and usual weekly pattern. Your usual pattern helps resolve answers that differ. This is an editable estimate, not a medical assessment. Skin can change with weather, products and time."
                  : "There isn’t enough clear information to choose one type yet. You can select your best fit below, or keep it unstated."}
              </Note>
              {result.sensitive ? (
                <Note>
                  You also reported irritation with products. Sensitivity can
                  overlap with other skin types; keep that context in your
                  experience notes.
                </Note>
              ) : null}
            </View>
            {result.type ? (
              <ActionButton
                label={`Use ${result.type.toLowerCase()} as my estimate`}
                onPress={() => {
                  onChange(result.type!);
                  setEstimate(true);
                  setOpen(false);
                }}
              />
            ) : null}
            <ActionButton
              tone="secondary"
              label="Choose my skin type myself"
              onPress={() => setOpen(false)}
            />
            <ActionButton
              tone="ghost"
              label="Start the check again"
              onPress={() => {
                setStep(0);
                setAnswers([]);
                setLoaded(-1);
              }}
            />
            <Note>
              Based on general skin-type descriptions from the American Academy
              of Dermatology. The quiz itself is an Unmask self-observation
              guide and has not been clinically validated.
            </Note>
          </>
        )}
      </ActionSheet>
    </View>
  );
}
