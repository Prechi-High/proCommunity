import { useRouter, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { ArrowLeft, ArrowSquareOut, CaretRight, WhatsappLogo } from '@/components/icons';
import { Pill, ProductImage } from '@/components/kit';
import { colors, fonts } from '@/constants/theme';
import { timeAgo } from '@/lib/community';
import { STATUS_TONE, type ResearchCard, type ResearchSection } from '@/lib/research';

export const STATUS_TEXT: Record<ResearchCard['status'], string> = {
  created: 'Preparing',
  identifying: 'Identifying',
  researching: 'Researching',
  partial: 'Partial',
  complete: 'Ready',
  failed: 'Failed',
  archived: 'Archived',
};

export function TopBar({ title, fallback, right }: { title: string; fallback: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as Href))}
        accessibilityLabel="Back"
        style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lac, alignItems: 'center', justifyContent: 'center' }}
      >
        <ArrowLeft size={18} color={colors.bone} weight="bold" />
      </Pressable>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.bone }}>
        {title}
      </Text>
      <View style={{ minWidth: 38, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function CardRow({ card, onPress }: { card: ResearchCard; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lac, borderRadius: 18, padding: 12, opacity: pressed ? 0.8 : 1 })}
    >
      <ProductImage uri={card.image_url} size={56} radius={14} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19, color: colors.bone }}>
          {card.title ?? 'Identifying product…'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Pill label={STATUS_TEXT[card.status]} tone={STATUS_TONE[card.status]} />
          {card.source_channel === 'whatsapp' ? <WhatsappLogo size={14} color={colors.sage} weight="fill" /> : null}
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
            {card.public_reference} · {timeAgo(card.updated_at)}
          </Text>
        </View>
      </View>
      <CaretRight size={16} color={colors.bone3} weight="bold" />
    </Pressable>
  );
}

type J = Record<string, unknown>;
const list = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function Bullets({ items, tone = colors.bone3 }: { items: string[]; tone?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {items.filter(Boolean).map((t, i) => (
        <View key={`${i}-${t.slice(0, 12)}`} style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: tone, marginTop: 8 }} />
          <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone }}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

const body = { fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone } as const;
const muted = { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.bone3 } as const;

/** Renders one Research Card section from its stored content. Unknown sections render nothing. */
export function SectionBlock({ section }: { section: ResearchSection }) {
  const c = section.content ?? {};
  let content: ReactNode = null;
  switch (section.section_key) {
    case 'summary':
      content = (
        <View style={{ gap: 8 }}>
          {str(c.verdict) ? <Text style={{ ...body, fontFamily: fonts.semibold }}>{str(c.verdict)}</Text> : null}
          {str(c.summary) ? <Text style={body}>{str(c.summary)}</Text> : null}
        </View>
      );
      break;
    case 'confidence':
      content = (
        <View style={{ gap: 10 }}>
          {typeof c.score === 'number' ? (
            <Text style={{ fontFamily: fonts.bold, fontSize: 28, color: colors.bone }}>
              {c.score}
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.bone3 }}> /100 owner score</Text>
            </Text>
          ) : null}
          <Bullets items={list(c.drivers).map(String)} tone={colors.sage} />
          {list(c.uncertainty).length ? (
            <>
              <Text style={{ ...muted, fontFamily: fonts.semibold }}>Still uncertain</Text>
              <Bullets items={list(c.uncertainty).map(String)} tone={colors.honey} />
            </>
          ) : null}
          <Text style={muted}>{str(c.note)}</Text>
        </View>
      );
      break;
    case 'key_facts':
      content = <Bullets items={list(c.facts).map(String)} tone={colors.hi} />;
      break;
    case 'fit':
      content = (
        <View style={{ gap: 10 }}>
          {list(c.bestFor).length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ ...muted, fontFamily: fonts.semibold, color: colors.sageInk }}>Best for</Text>
              <Bullets items={list(c.bestFor).map(String)} tone={colors.sage} />
            </View>
          ) : null}
          {list(c.notFor).length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ ...muted, fontFamily: fonts.semibold, color: colors.coral }}>Not ideal for</Text>
              <Bullets items={list(c.notFor).map(String)} tone={colors.coral} />
            </View>
          ) : null}
          {str(c.howToUse) ? <Text style={body}>{str(c.howToUse)}</Text> : null}
        </View>
      );
      break;
    case 'ingredients_or_specs':
      content = (
        <View style={{ gap: 8 }}>
          {list(c.rows).slice(0, 24).map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, paddingBottom: 8, borderBottomWidth: i === list(c.rows).length - 1 ? 0 : 1, borderBottomColor: colors.line }}>
              <Text style={{ width: 120, fontFamily: fonts.medium, fontSize: 13.5, color: colors.bone2 }}>{str(r.label)}</Text>
              <Text style={{ flex: 1, ...body, fontSize: 13.5, lineHeight: 19 }}>{str(r.value)}</Text>
            </View>
          ))}
        </View>
      );
      break;
    case 'community':
      content = (
        <View style={{ gap: 10 }}>
          {str(c.consensus) ? <Text style={body}>{str(c.consensus)}</Text> : null}
          {list(c.voices).slice(0, 5).map((v, i) => (
            <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: v.stance === 'warn' ? colors.coral : v.stance === 'love' ? colors.sage : colors.line, paddingLeft: 10, gap: 2 }}>
              <Text style={body}>“{str(v.text)}”</Text>
              <Text style={muted}>{str(v.platform)}</Text>
            </View>
          ))}
        </View>
      );
      break;
    case 'pros_cons':
      content = (
        <View style={{ gap: 12 }}>
          {list(c.praise).length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ ...muted, fontFamily: fonts.semibold, color: colors.sageInk }}>Praise</Text>
              <Bullets items={list(c.praise).slice(0, 5).map((x) => str(x.text))} tone={colors.sage} />
            </View>
          ) : null}
          {list(c.complaints).length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ ...muted, fontFamily: fonts.semibold, color: colors.coral }}>Complaints</Text>
              <Bullets items={list(c.complaints).slice(0, 5).map((x) => str(x.text))} tone={colors.coral} />
            </View>
          ) : null}
        </View>
      );
      break;
    case 'pricing': {
      const r = (c.range ?? null) as J | null;
      content = r ? (
        <View style={{ gap: 4 }}>
          <Text style={body}>
            From <Text style={{ fontFamily: fonts.semibold }}>{`${str(r.currency)} ${Number(r.min).toLocaleString()}`}</Text> to{' '}
            <Text style={{ fontFamily: fonts.semibold }}>{`${str(r.currency)} ${Number(r.max).toLocaleString()}`}</Text> across {String(r.count ?? '')} listings.
          </Text>
          <Text style={muted}>Prices change often — check before paying.</Text>
        </View>
      ) : null;
      break;
    }
    case 'stores':
      content = (
        <View style={{ gap: 8 }}>
          {list(c.offers).slice(0, 6).map((o, i) => {
            const link = str(o.link);
            return (
              <Pressable key={i} disabled={!link} onPress={() => link && Linking.openURL(link)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, ...body }}>{str(o.seller)}</Text>
                <Text style={{ ...body, fontFamily: fonts.semibold }}>{str((o.price as J | null)?.display)}</Text>
                {link ? <ArrowSquareOut size={14} color={colors.bone3} /> : null}
              </Pressable>
            );
          })}
        </View>
      );
      break;
    case 'alternatives':
      content = <Bullets items={list(c.items).map((a) => `${str(a.name)} — ${str(a.reason)}`)} />;
      break;
    case 'sources':
      content = (
        <View style={{ gap: 6 }}>
          {list(c.items).slice(0, 15).map((s, i) => {
            const url = str(s.url);
            return (
              <Pressable key={i} disabled={!url} onPress={() => url && Linking.openURL(url)}>
                <Text numberOfLines={1} style={{ ...body, fontSize: 13.5, color: url ? colors.hi : colors.bone }}>
                  {str(s.title) || str(s.domain)} <Text style={muted}>· {str(s.domain)}</Text>
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
      break;
    default:
      return null;
  }
  if (!content) return null;
  return (
    <View style={{ backgroundColor: colors.lac, borderRadius: 20, padding: 16, gap: 12 }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, color: colors.bone }}>{section.title}</Text>
      {content}
    </View>
  );
}
