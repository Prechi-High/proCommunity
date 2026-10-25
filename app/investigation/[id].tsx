import { ProgressTrail } from "@/components/unmask-ui/ProgressTrail";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import {
  ActionButton,
  AppShell,
  Avatar,
  MediaFrame,
  SparkMeter,
  SparkSheet,
  StatusMessage,
} from "@/components/unmask-ui";
import { COPY } from "@/constants/brand";
import { colors, fonts } from "@/constants/theme";
import * as community from "@/lib/community-v2/api";
import * as api from "@/lib/investigations/api";
import * as living from "@/lib/living/api";
import {
  combinedSupport,
  publicUnmaskLabel,
  publicUnmaskStage,
  sparkNaira,
} from "@/lib/unmask/status";
import { SAMPLE_UNMASK_DETAIL, sampleById } from "@/lib/unmask/samples";
import { useAppStore } from "@/lib/store";

export default function UnmaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const sample = sampleById(id);
  const [support, setSupport] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const q = useQuery({
    queryKey: ["investigation", id],
    queryFn: () => api.get(id),
    enabled: !!id && !sample,
    refetchInterval: 15000,
  });
  const summary = useQuery({
    queryKey: ["investigation-support", id],
    queryFn: () => api.summary(id),
    enabled: !!id && !sample,
    refetchInterval: 15000,
  });
  const progressUpdates = useQuery({
    queryKey: ["investigation-updates", id],
    queryFn: () => api.updates(id),
    enabled: !!id && !sample,
    refetchInterval: 15000,
  });
  const creators = useQuery({
    queryKey: ["creators"],
    queryFn: community.creators,
  });
  const products = useQuery({
    queryKey: ["catalog"],
    queryFn: () => living.catalog(),
  });
  const item = q.data;
  const product = products.data?.find((p) => p.id === item?.product_id);
  const creator = creators.data?.find((c) => c.user_id === item?.creator_id);
  const stage = publicUnmaskStage(item?.status);
  const weight = combinedSupport(summary.data?.sparks, summary.data?.thunder);

  if (sample) {
    const extra = SAMPLE_UNMASK_DETAIL[sample.id];
    const published = sample.status === "Ultra Unmasked";
    return (
      <AppShell back title={sample.title}>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            color: colors.inkSoft,
          }}
        >
          Design sample · Sparks are not charged on this preview.
        </Text>
        <MediaFrame
          uri={sample.photo || sample.productImage}
          label={sample.productName || sample.title}
          play={published}
          overlay
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: colors.gold,
            }}
          />
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 13,
              color: colors.brand,
            }}
          >
            {sample.status}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 17,
            lineHeight: 26,
            color: colors.ink,
          }}
        >
          {sample.body}
        </Text>
        {sample.productName ? (
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 15,
              color: colors.brandDeep,
            }}
          >
            {sample.productName}
          </Text>
        ) : null}
        <View
          style={{
            backgroundColor: colors.goldSoft,
            borderRadius: 20,
            padding: 18,
            gap: 10,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.serifBold,
              fontSize: 28,
              lineHeight: 32,
              color: colors.ink,
              letterSpacing: -0.5,
            }}
          >
            {sample.sparks ?? 0}
          </Text>
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: colors.honeyInk,
            }}
          >
            Sparks pushing this · {sparkNaira(sample.sparks ?? 0)} ·{" "}
            {extra?.supporters ?? 0} people in
          </Text>
          {!published ? <SparkMeter weight={sample.sparks ?? 0} /> : null}
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              lineHeight: 18,
              color: colors.honeyInk,
            }}
          >
            {COPY.sparkTeach}
          </Text>
        </View>
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 13,
              letterSpacing: 0.5,
              color: colors.inkSoft,
            }}
          >
            PROGRESS
          </Text>
          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 18,
              color: colors.ink,
            }}
          >
            {sample.status}
          </Text>
          {sample.creatorName ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Avatar
                name={sample.creatorName}
                uri={sample.creatorAvatar}
                size={44}
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  color: colors.brandDeep,
                }}
              >
                {sample.creatorName} {COPY.unmaskerHasThis}
              </Text>
            </View>
          ) : (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                color: colors.inkSoft,
              }}
            >
              {COPY.waitingUnmasker}
            </Text>
          )}
          <ActionButton
            disabled
            tone="ghost"
            label="Choose a creator · Coming soon"
            explanation="For now, the team finds a creator for your question."
          />
        </View>
        {published && extra?.findings ? (
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontFamily: fonts.serifBold,
                fontSize: 26,
                lineHeight: 30,
                color: colors.ink,
              }}
            >
              {COPY.answer}
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                lineHeight: 24,
                color: colors.ink,
              }}
            >
              {extra.findings}
            </Text>
            {extra.uncertainty ? (
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.inkSoft,
                }}
              >
                {extra.uncertainty}
              </Text>
            ) : null}
          </View>
        ) : (
          <StatusMessage kind="info" title={COPY.noAnswer} />
        )}
      </AppShell>
    );
  }

  if (q.isError) {
    return (
      <AppShell back title="Unmask">
        <StatusMessage kind="error" title="This Unmask isn’t available." />
      </AppShell>
    );
  }

  return (
    <AppShell back title={item?.title || "Unmask"}>
      {product ? (
        <MediaFrame
          uri={product.image_url}
          label={product.name}
          ratio={16 / 10}
          overlay
        />
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: colors.gold,
          }}
        />
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            color: colors.brand,
          }}
        >
          {publicUnmaskLabel(stage)}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: fonts.regular,
          fontSize: 17,
          lineHeight: 26,
          color: colors.ink,
        }}
      >
        {item?.concern}
      </Text>
      {product ? (
        <Text
          onPress={() => router.push(`/product/${product.id}` as Href)}
          style={{
            fontFamily: fonts.semibold,
            fontSize: 15,
            color: colors.brandDeep,
          }}
        >
          {product.name} →
        </Text>
      ) : null}

      <View
        style={{
          backgroundColor: colors.goldSoft,
          borderRadius: 20,
          padding: 18,
          gap: 10,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.serifBold,
            fontSize: 28,
            lineHeight: 32,
            color: colors.ink,
            letterSpacing: -0.5,
          }}
        >
          {summary.isLoading
            ? "…"
            : summary.isError
              ? "—"
              : weight.toLocaleString()}
        </Text>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 14,
            color: colors.honeyInk,
          }}
        >
          {summary.isLoading
            ? "Loading community support…"
            : summary.isError
              ? "Support totals unavailable. Try refreshing."
              : `${sparkNaira(weight)} equivalent · ${summary.data?.supporters ?? 0} people supporting`}
        </Text>
        {stage === "open" && summary.isSuccess ? (
          <SparkMeter weight={weight} goal={item?.spark_goal} />
        ) : null}
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 13,
            lineHeight: 18,
            color: colors.honeyInk,
          }}
        >
          {summary.data?.thunder
            ? `Includes ${summary.data.thunder} Thunder Spark${summary.data.thunder === 1 ? "" : "s"} (100 Sparks each).`
            : COPY.sparkTeach}
        </Text>
        {stage === "open" ? (
          <ActionButton
            tone="gold"
            label={stage === "open" ? COPY.addSparks : "Keep this moving"}
            onPress={() => setSupport(true)}
          />
        ) : (
          <StatusMessage
            kind="info"
            title="Support is closed for this Ultra Unmask."
            detail="Follow the progress and read findings when they are published."
          />
        )}
      </View>

      <View style={{ gap: 12 }}>
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            letterSpacing: 0.5,
            color: colors.inkSoft,
          }}
        >
          PROGRESS
        </Text>
        <ProgressTrail stage={stage} />
        {creator ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar
              name={creator.display_name}
              uri={creator.avatar_url}
              size={44}
            />
            <Text
              onPress={() => router.push(`/member/${creator.user_id}` as Href)}
              style={{
                flex: 1,
                fontFamily: fonts.regular,
                fontSize: 16,
                color: colors.brandDeep,
              }}
            >
              {creator.display_name} {COPY.unmaskerHasThis} →
            </Text>
          </View>
        ) : stage === "open" ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                color: colors.inkSoft,
              }}
            >
              {COPY.waitingUnmasker}
            </Text>
            <ActionButton
              disabled
              tone="ghost"
              label="Choose a creator · Coming soon"
              explanation="For now, the team finds a creator for your question."
            />
          </View>
        ) : null}
      </View>

      {progressUpdates.data?.length ? (
        <View style={{ gap: 16 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.semibold,
              fontSize: 18,
              color: colors.ink,
            }}
          >
            Story updates
          </Text>
          {progressUpdates.data.map((update) => (
            <View
              key={update.id}
              style={{
                paddingLeft: 16,
                borderLeftWidth: 2,
                borderColor: colors.line,
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 12,
                  color: colors.inkSoft,
                }}
              >
                {new Date(update.created_at).toLocaleDateString("en-NG")}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.regular,
                  fontSize: 16,
                  lineHeight: 24,
                  color: colors.ink,
                }}
              >
                {update.body}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {item?.status === "published" && (item.findings || item.video_url) ? (
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontFamily: fonts.serifBold,
              fontSize: 26,
              lineHeight: 30,
              color: colors.ink,
            }}
          >
            {COPY.answer}
          </Text>
          {item.video_url ? (
            <ActionButton
              label={COPY.watchUnmask}
              onPress={() => void Linking.openURL(item.video_url!)}
            />
          ) : null}
          {item.findings ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                lineHeight: 24,
                color: colors.ink,
              }}
            >
              {item.findings}
            </Text>
          ) : null}
          {item.uncertainty ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 16,
                lineHeight: 24,
                color: colors.inkSoft,
              }}
            >
              {item.uncertainty}
            </Text>
          ) : null}
          <ActionButton
            tone="ghost"
            label={sourcesOpen ? "Hide sources" : "See how we got here"}
            onPress={() => setSourcesOpen((v) => !v)}
          />
          {sourcesOpen && item.sources ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 14,
                lineHeight: 20,
                color: colors.inkSoft,
              }}
            >
              {item.sources}
            </Text>
          ) : null}
        </View>
      ) : (
        <StatusMessage kind="info" title={COPY.noAnswer} />
      )}

      {item?.company_response && item.status === "published" ? (
        <View style={{ gap: 8 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.semibold,
              fontSize: 18,
              color: colors.ink,
            }}
          >
            What the company said
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 16,
              lineHeight: 24,
              color: colors.inkSoft,
            }}
          >
            {item.company_response}
          </Text>
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: 13,
              color: colors.inkSoft,
            }}
          >
            Attributed company response · separate from independent findings
          </Text>
        </View>
      ) : null}
      {item?.commercial_disclosure ? (
        <StatusMessage
          kind="info"
          title="Funding and relationships"
          detail={item.commercial_disclosure}
        />
      ) : null}
      {item?.question_id ? (
        <ActionButton
          tone="ghost"
          label="Read the original community question"
          onPress={() => router.push(`/question/${item.question_id}` as Href)}
        />
      ) : null}
      {item?.experience_id ? (
        <ActionButton
          tone="ghost"
          label="Read the original story"
          onPress={() => router.push(`/story/${item.experience_id}` as Href)}
        />
      ) : null}
      {!uid ? (
        <Text
          style={{
            fontFamily: fonts.regular,
            fontSize: 14,
            color: colors.inkSoft,
          }}
        >
          Sign in to add Sparks. Reading stays free.
        </Text>
      ) : null}
      {id ? (
        <SparkSheet
          open={support}
          onClose={() => setSupport(false)}
          investigationId={id}
        />
      ) : null}
    </AppShell>
  );
}
