import { useEffect, useState } from "react";
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { db } from "@/lib/clarity/api";
import { colors, fonts } from "@/constants/theme";
import { X } from "@/components/icons";

type Product = { id: string; name: string; brand?: string; imageUrl?: string | null; url?: string | null; price?: string | null; currency?: string | null; source?: string };
type Props = { sessionId: string; metadata: any; canManage: boolean; open: boolean; onClose: () => void; onChanged: (products: Product[], pinnedId: string | null) => void };

function normalize(row: any): Product {
  return { id: String(row.id || row.catalog_product_id || "manual-" + Date.now()), name: String(row.name || row.product_name || "").trim(), brand: row.brand ? String(row.brand) : undefined, imageUrl: row.image_url || row.hero_image_url || null, url: row.product_url || null, price: row.price == null ? null : String(row.price), currency: row.currency || null, source: row.source || "Unmask catalog" };
}

export function ProductShowcase({ sessionId, metadata, canManage, open, onClose, onChanged }: Props) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<Product[]>([]); const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false); const [manualName, setManualName] = useState(""); const [manualBrand, setManualBrand] = useState(""); const [manualImage, setManualImage] = useState(""); const [manualUrl, setManualUrl] = useState("");
  const [localProducts, setLocalProducts] = useState<Product[]>([]);
  const current = Array.isArray(metadata?.products) ? metadata.products.map(normalize).filter((p: Product) => p.name) : [];
  const pinnedId = typeof metadata?.pinned_product_id === "string" ? metadata.pinned_product_id : null;
  useEffect(() => { setLocalProducts(current); }, [metadata?.products]);
  useEffect(() => {
    if (!open || !query.trim()) { setResults([]); return; }
    let dead = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const q = query.trim();
        const [catalog, products] = await Promise.all([
          db().from("unmask_catalog").select("id,catalog_product_id,name,brand,image_url").ilike("name", "%" + q + "%").limit(12),
          db().from("products").select("id,name,brand,hero_image_url").ilike("name", "%" + q + "%").limit(12),
        ]);
        const merged = [...(catalog.data || []), ...(products.data || [])].map(normalize);
        const unique = merged.filter((item, index, arr) => arr.findIndex((x) => x.id === item.id || x.name.toLowerCase() === item.name.toLowerCase()) === index);
        if (!dead) setResults(unique.slice(0, 16));
      } finally { if (!dead) setBusy(false); }
    }, 260);
    return () => { dead = true; clearTimeout(timer); };
  }, [query, open]);
  const write = async (products: Product[], nextPinned: string | null) => {
    setBusy(true);
    try {
      const { data, error } = await db().from("unmask_realtime_sessions").select("metadata").eq("id", sessionId).single();
      if (error) throw error;
      const meta = data?.metadata && typeof data.metadata === "object" ? data.metadata as any : {};
      const next = { ...meta, products: products.slice(0, 12).map((p) => ({ id: p.id, name: p.name, brand: p.brand, image_url: p.imageUrl, product_url: p.url, price: p.price, currency: p.currency })), pinned_product_id: nextPinned };
      const saved = await db().from("unmask_realtime_sessions").update({ metadata: next }).eq("id", sessionId);
      if (saved.error) throw saved.error;
      setLocalProducts(products.slice(0, 12)); onChanged(products.slice(0, 12), nextPinned);
    } finally { setBusy(false); }
  };
  const add = async (product: Product) => {\n    let nextProduct = product;\n    if (!product.url && !product.id.startsWith("manual-")) {\n      const listing = await db().from("listings").select("product_url,price,currency,in_stock").eq("product_id", product.id).eq("opted_out", false).order("in_stock", { ascending: false }).limit(1).maybeSingle();\n      if (listing.data) nextProduct = { ...product, url: listing.data.product_url || null, price: listing.data.price == null ? product.price : String(listing.data.price), currency: listing.data.currency || product.currency };\n    }\n    const next = [...localProducts.filter((p) => p.id !== nextProduct.id), nextProduct]; await write(next, nextProduct.id); setQuery("");\n  };
  const pin = async (product: Product) => write(localProducts, product.id);
  const remove = async (product: Product) => { const next = localProducts.filter((p) => p.id !== product.id); await write(next, pinnedId === product.id ? null : pinnedId); };
  const addManual = async () => {
    if (!manualName.trim()) return;
    const product: Product = { id: "manual-" + Date.now(), name: manualName.trim(), brand: manualBrand.trim() || undefined, imageUrl: manualImage.trim() || null, url: manualUrl.trim() || null, source: "Added by creator" };
    await add(product); setManualName(""); setManualBrand(""); setManualImage(""); setManualUrl(""); setManual(false);
  };
  if (!open) return null;
  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "82%", padding: 18, paddingBottom: 28, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: "#fff", gap: 12, zIndex: 50 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 19 }}>Product showcase</Text><Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 11 }}>Add, pin or remove products while the Live is running.</Text></View><Pressable onPress={onClose}><X size={21} color={colors.ink} /></Pressable></View>
      {canManage ? <><TextInput value={query} onChangeText={setQuery} placeholder="Search Unmask products…" placeholderTextColor={colors.inkSoft} style={{ minHeight: 45, borderRadius: 14, backgroundColor: "#F7F4F2", paddingHorizontal: 14, color: colors.ink, fontFamily: fonts.regular }} />{busy ? <Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 11 }}>Searching…</Text> : null}
        {results.length ? <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: 7 }}>{results.map((p) => <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 9, padding: 9, borderRadius: 13, backgroundColor: "#F7F4F2" }}><View style={{ width: 45, height: 45, borderRadius: 9, backgroundColor: "#EDE5E0", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 16 }}>{p.name.slice(0,1).toUpperCase()}</Text>}</View><View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 12 }}>{p.name}</Text><Text numberOfLines={1} style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 10 }}>{p.brand || "Product"}{p.price ? " · " + (p.currency || "") + p.price : ""}</Text></View><Pressable onPress={() => void add(p)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: colors.brandDeep }}><Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 10 }}>Add & pin</Text></Pressable></View>)}</ScrollView> : null}
        <Pressable onPress={() => setManual((v) => !v)} style={{ paddingVertical: 10 }}><Text style={{ color: colors.brandDeep, fontFamily: fonts.semibold, fontSize: 12 }}>＋ Add a product manually</Text></Pressable>
        {manual ? <View style={{ gap: 7, padding: 12, borderRadius: 14, backgroundColor: "#F3EBE2" }}><TextInput value={manualName} onChangeText={setManualName} placeholder="Product name" placeholderTextColor={colors.inkSoft} style={{ backgroundColor: "#fff", borderRadius: 11, padding: 11, color: colors.ink, fontFamily: fonts.regular }} /><TextInput value={manualBrand} onChangeText={setManualBrand} placeholder="Brand (optional)" placeholderTextColor={colors.inkSoft} style={{ backgroundColor: "#fff", borderRadius: 11, padding: 11, color: colors.ink, fontFamily: fonts.regular }} /><TextInput value={manualImage} onChangeText={setManualImage} placeholder="Product image URL (optional)" placeholderTextColor={colors.inkSoft} style={{ backgroundColor: "#fff", borderRadius: 11, padding: 11, color: colors.ink, fontFamily: fonts.regular }} /><TextInput value={manualUrl} onChangeText={setManualUrl} placeholder="Seller link (optional)" placeholderTextColor={colors.inkSoft} style={{ backgroundColor: "#fff", borderRadius: 11, padding: 11, color: colors.ink, fontFamily: fonts.regular }} autoCapitalize="none" /><Pressable onPress={() => void addManual()} style={{ padding: 11, borderRadius: 11, backgroundColor: colors.brandDeep, alignItems: "center" }}><Text style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 11 }}>Add product</Text></Pressable></View> : null}
      </> : null}
      <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ gap: 7 }}>{localProducts.map((p) => { const pinned = pinnedId === p.id; return <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 9, padding: 10, borderRadius: 13, backgroundColor: pinned ? "#2A0E16" : "#F7F4F2" }}><View style={{ width: 42, height: 42, borderRadius: 9, backgroundColor: "#EDE5E0", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ color: colors.brandDeep, fontFamily: fonts.bold, fontSize: 15 }}>{p.name.slice(0,1).toUpperCase()}</Text>}</View><View style={{ flex: 1 }}><Text style={{ color: pinned ? "#fff" : colors.ink, fontFamily: fonts.semibold, fontSize: 12 }}>{p.name}</Text><Text style={{ color: pinned ? "#E9D8E0" : colors.inkSoft, fontFamily: fonts.regular, fontSize: 10 }}>{p.brand || "Product"}{pinned ? " · PINNED" : ""}</Text></View>{canManage ? <><Pressable onPress={() => void pin(p)} style={{ paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: pinned ? "#F2D25B" : "#fff" }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }}>{pinned ? "Pinned" : "Pin"}</Text></Pressable><Pressable onPress={() => void remove(p)} style={{ paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: "#fff" }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }}>Remove</Text></Pressable>{p.url ? <Pressable onPress={() => void Linking.openURL(p.url!)} style={{ paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: "#F2D25B" }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }}>Get it</Text></Pressable> : null}</> : <Pressable onPress={p.url ? () => void Linking.openURL(p.url!) : onClose} style={{ paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, backgroundColor: "#fff" }}><Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 9 }}>Hide</Text></Pressable>}</View>; })}{!localProducts.length ? <Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12 }}>No products have been added yet.</Text> : null}</ScrollView>
      {!canManage ? <Text style={{ color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 11 }}>You control this tray only on your screen. Hiding it does not remove the creator’s product.</Text> : null}
    </View>
  );
}