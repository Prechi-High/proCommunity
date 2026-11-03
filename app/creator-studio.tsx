import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useAppStore } from "@/lib/store";
import { db } from "@/lib/clarity/api";
import { supabase } from "@/lib/supabase";
import { AppShell, ActionButton, StatusMessage } from "@/components/unmask-ui";
import { CreatorMark } from "@/components/unmask-ui/CreatorMark";
import { colors, fonts } from "@/constants/theme";

const input = { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, backgroundColor: "#FAF8F6", borderWidth: 1, borderColor: colors.line, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 14 };

export default function CreatorStudio() {
  const r = useRouter();
  const uid = useAppStore(s => s.profile?.id);
  const [creator, setCreator] = useState<any>(null);
  const [mode, setMode] = useState<"ultra" | "room">("ultra");
  const [ultras, setUltras] = useState<any[]>([]);
  const [selectedUltra, setSelectedUltra] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [productName, setProductName] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [ending, setEnding] = useState(false);
  const [availability, setAvailability] = useState<Array<{ day: string; enabled: boolean; start: string; end: string }>>([
    { day: "Mon", enabled: false, start: "08:00", end: "22:00" },
    { day: "Tue", enabled: false, start: "08:00", end: "22:00" },
    { day: "Wed", enabled: false, start: "08:00", end: "22:00" },
    { day: "Thu", enabled: false, start: "08:00", end: "22:00" },
    { day: "Fri", enabled: false, start: "08:00", end: "22:00" },
    { day: "Sat", enabled: false, start: "08:00", end: "22:00" },
    { day: "Sun", enabled: false, start: "08:00", end: "22:00" },
  ]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilitySaved, setAvailabilitySaved] = useState(false);

  useEffect(() => {
    if (!uid) return;
    db().from("unmask_investigations")
      .select("id,title,concern,status,user_id,product_id,attached_journey_id,attached_experience_id,created_at,unmask_catalog(name,brand,image_url)")
      .eq("creator_id", uid)
      .in("status", ["selected", "investigating", "published"])
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setUltras(data || []));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    db().from("unmask_creators").select("*").eq("user_id", uid).maybeSingle().then(({ data }) => {
      setCreator(data);
      if (Array.isArray(data?.availability) && data.availability.length) {
        setAvailability(current => current.map(day => {
          const saved = data.availability.find((item: any) => item?.day === day.day);
          return saved ? { ...day, enabled: saved.enabled !== false, start: saved.start || day.start, end: saved.end || day.end } : day;
        }));
      }
    });
    db().from("unmask_realtime_sessions")
      .select("id,mode,title,description,status,metadata,started_at")
      .eq("host_creator_id", uid)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setActiveSession(data || null));
  }, [uid]);


  function patchAvailability(day: string, patch: Partial<{ enabled: boolean; start: string; end: string }>) {
    setAvailability(current => current.map(item => item.day === day ? { ...item, ...patch } : item));
    setAvailabilitySaved(false);
  }

  async function saveAvailability() {
    if (!uid || savingAvailability) return;
    setSavingAvailability(true);
    setError("");
    setAvailabilitySaved(false);
    try {
      const normalized = availability.map(item => {
        const validTime = (value: string) => /^([01]\\d|2[0-3]):[0-5]\\d$/.test(value);
        if (item.enabled && (!validTime(item.start) || !validTime(item.end))) throw new Error("Enter valid 24-hour times for " + item.day + ".");
        if (item.enabled && item.start >= item.end) throw new Error(item.day + ": end time must be later than start time.");
        return item;
      });
      const { error: saveError } = await db().from("unmask_creators").update({ availability: normalized }).eq("user_id", uid);
      if (saveError) throw saveError;
      setAvailabilitySaved(true);
      setCreator((current: any) => current ? { ...current, availability: normalized } : current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save availability.");
    } finally {
      setSavingAvailability(false);
    }
  }

  async function endActiveSession() {
    if (!activeSession || ending || !supabase) return;
    setEnding(true); setError("");
    try {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.access_token) throw new Error("Sign in required.");
      const response = await fetch("/api/realtime/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.session.access_token}` },
        body: JSON.stringify({ action: "end", sessionId: activeSession.id }),
      });
      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(raw.trim() || `Could not end the session (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(payload.error || `Could not end the session (HTTP ${response.status}).`);
      setActiveSession(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not end the session.");
    } finally {
      setEnding(false);
    }
  }

  async function start() {
    if (!uid || !creator || busy || !title.trim() || (mode === "ultra" && !selectedUltra)) return;
    setBusy(true); setError("");
    try {
      if (!supabase) throw new Error("Connection unavailable.");
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.access_token) throw new Error("Sign in required.");
      const response = await fetch("/api/realtime/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.session.access_token}`,
        },
        body: JSON.stringify({
          mode,
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const raw = await response.text();
      let payload: any = {};
      try { payload = raw ? JSON.parse(raw) : {}; } catch {
        throw new Error(raw.trim() || `Could not start the session (HTTP ${response.status}).`);
      }
      if (!response.ok) throw new Error(payload.error || `Could not start the session (HTTP ${response.status}).`);
      if (!payload?.id) throw new Error("The session was created without an id.");
      if (mode === "ultra") {
        const chosen = selectedUltra;
        const product = Array.isArray(chosen?.unmask_catalog) ? chosen.unmask_catalog[0] : chosen?.unmask_catalog;
        const { error: metadataError } = await db().from("unmask_realtime_sessions").update({ metadata: { topic: description.trim(), products: product?.name ? [{ name: product.name, brand: product.brand, image_url: product.image_url }] : [], ultra_unmask: { investigation_id: chosen.id, title: chosen.title, concern: chosen.concern, product_name: product?.name || "", product_brand: product?.brand || "", product_image_url: product?.image_url || null, requester_id: chosen.user_id } } }).eq("id", payload.id);
        if (metadataError) throw metadataError;
      }
      r.replace({ pathname: mode === "ultra" ? "/live/session" : "/room/session", params: { id: payload.id, host: "1" } } as Href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the session.");
    } finally { setBusy(false); }
  }

  if (!creator) return <AppShell back title="Creator Studio"><StatusMessage title="Creator access is not active." detail="Your account needs to be published as an Unmask Creator before you can start a Live or Room." /></AppShell>;

  return (
    <AppShell back title="Creator Studio" subtitle="Start something people can join right now.">
      <View style={{ padding: 20, borderRadius: 24, backgroundColor: "#F3EBE2", gap: 12 }}>
        <CreatorMark mark={creator.creator_mark || uid} size={58} label />
        <Text style={{ fontFamily: fonts.serifBold, fontSize: 27, color: colors.ink }}>{creator.display_name}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft }}>@{creator.handle} · {creator.status}</Text>
      </View>


      <View style={{ padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}>Your creator availability</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>Set the hours when you can take a Live shift or respond to an Unmask investigation. This is your availability, not an automatically assigned shift.</Text>
        </View>
        {availability.map((day) => (
          <View key={day.day} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Pressable onPress={() => patchAvailability(day.day, { enabled: !day.enabled })} accessibilityRole="checkbox" accessibilityState={{ checked: day.enabled }} style={{ width: 48, paddingVertical: 9, borderRadius: 11, alignItems: "center", backgroundColor: day.enabled ? "#2A0E16" : "#F2EFED" }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: day.enabled ? "#F2D25B" : colors.inkSoft }}>{day.day}</Text>
            </Pressable>
            <TextInput value={day.start} editable={day.enabled} onChangeText={value => patchAvailability(day.day, { start: value })} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} style={[input, { flex: 1, paddingVertical: 10, textAlign: "center", opacity: day.enabled ? 1 : 0.45 }]} />
            <Text style={{ fontFamily: fonts.medium, color: colors.inkSoft }}>to</Text>
            <TextInput value={day.end} editable={day.enabled} onChangeText={value => patchAvailability(day.day, { end: value })} placeholder="22:00" keyboardType="numbers-and-punctuation" maxLength={5} style={[input, { flex: 1, paddingVertical: 10, textAlign: "center", opacity: day.enabled ? 1 : 0.45 }]} />
          </View>
        ))}
        <ActionButton label={savingAvailability ? "Saving…" : "Save availability"} pending={savingAvailability} onPress={() => void saveAvailability()} />
        {availabilitySaved ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: "#287A4B" }}>Availability saved.</Text> : null}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <ActionButton label="Ultra Unmask" tone={mode === "ultra" ? "primary" : "secondary"} onPress={() => setMode("ultra")} />
        <ActionButton label="Ultra Unmask Audio Room" tone={mode === "room" ? "primary" : "secondary"} onPress={() => setMode("room")} />
      </View>

      {mode === "ultra" ? (
        <View style={{ padding: 18, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", gap: 11 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.ink }}>Choose an Ultra Unmask</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>Select an Ultra Unmask already assigned to you. This case becomes the investigation shown throughout the session.</Text>
          </View>
          {ultras.length ? ultras.map((item) => {
            const product = Array.isArray(item.unmask_catalog) ? item.unmask_catalog[0] : item.unmask_catalog;
            const selected = selectedUltra?.id === item.id;
            return <Pressable key={item.id} onPress={() => { setSelectedUltra(item); setTitle(item.title || "Ultra Unmask"); setDescription(item.concern || ""); }} style={{ padding: 13, borderRadius: 16, borderWidth: 1, borderColor: selected ? colors.brandDeep : colors.line, backgroundColor: selected ? "#F3EBE2" : "#FAF8F6", gap: 5 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{item.title}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: selected ? colors.brandDeep : colors.inkSoft }}>{selected ? "SELECTED" : String(item.status).toUpperCase()}</Text>
              </View>
              {product?.name ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.brandDeep }}>{product.brand ? product.brand + " · " : ""}{product.name}</Text> : null}
              <Text numberOfLines={2} style={{ fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.inkSoft }}>{item.concern || "No question context added."}</Text>
            </Pressable>;
          }) : <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft }}>No accepted Ultra Unmasks are assigned to you yet.</Text>}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>TITLE</Text>
        <TextInput value={title} onChangeText={setTitle} style={input} placeholder={mode === "ultra" ? "Ultra Unmask: bring clarity to this experience" : "Let's talk about this product"} />
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkSoft }}>WHAT ARE WE DOING?</Text>
        <TextInput value={description} onChangeText={setDescription} style={[input, { minHeight: 100 }]} multiline placeholder={mode === "ultra" ? "Explain the clarity question being investigated." : "Give listeners enough context to decide whether to join."} />
      </View>

      {error ? <StatusMessage kind="error" title={error} /> : null}
      <ActionButton label={mode === "ultra" ? "Start Ultra Unmask" : "Start Ultra Unmask Audio Room"} pending={busy} pendingLabel="Starting…" disabled={!title.trim() || busy || !!activeSession || (mode === "ultra" && !selectedUltra)} onPress={() => void start()} />
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, color: colors.inkSoft }}>
        {mode === "room" ? "Public audio-first Ultra Unmask sessions. The host controls who gets speaking access." : "A public Ultra Unmask investigation. The selected case stays pinned while you bring the right people on stage."}
      </Text>

      {activeSession ? (
        <View style={{ padding: 18, borderRadius: 22, backgroundColor: activeSession.mode === "room" ? "#F3EBE2" : "#2A0E16", gap: 10 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1, color: activeSession.mode === "room" ? colors.brandDeep : "#F2D25B" }}>
            {activeSession.mode === "room" ? "ULTRA UNMASK AUDIO IS LIVE" : "ULTRA UNMASK IS LIVE"}
          </Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: activeSession.mode === "room" ? colors.ink : "#fff" }}>{activeSession.title}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: activeSession.mode === "room" ? colors.inkSoft : "#E9D8E0" }}>
            You are already the host. You don't need to start another session.
          </Text>
          <View style={{ flexDirection: "row", gap: 9 }}>
            <ActionButton tone={activeSession.mode === "room" ? "primary" : "gold"} label="Open controls" onPress={() => r.replace({ pathname: activeSession.mode === "room" ? "/room/session" : "/live/session", params: { id: activeSession.id, host: "1" } } as Href)} />
            <ActionButton tone="secondary" label={ending ? "Ending…" : "End now"} pending={ending} onPress={() => void endActiveSession()} />
          </View>
        </View>
      ) : null}
    </AppShell>
  );
}
