import { useRef, useState } from "react";
import { Linking, Modal, ScrollView, Share, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CommunityPage, Field } from "@/components/community-v2/ui";
import {
  Button,
  Busy,
  Card,
  Chips,
  Copy,
  Heading,
  Notice,
  Photo,
  Pill,
  s,
} from "@/components/unmask/reference/ui";
import * as api from "@/lib/investigations/api";
import * as living from "@/lib/living/api";
import * as community from "@/lib/community-v2/api";
import { useAppStore } from "@/lib/store";
import { FollowButton } from "@/components/living/FollowButton";
function key() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const n = Math.floor(Math.random() * 16);
    return (c === "x" ? n : (n & 3) | 8).toString(16);
  });
}
export default function Investigation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = useRouter();
  const qc = useQueryClient();
  const uid = useAppStore((s) => s.profile?.id);
  const [panel, setPanel] = useState(false);
  const [kind, setKind] = useState<"sparks" | "thunder">("sparks");
  const [amount, setAmount] = useState("10");
  const [publicAck, setPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<api.Receipt | null>(null);
  const attempt = useRef({ payload: "", key: "" });
  const q = useQuery({
    queryKey: ["investigation", id],
    queryFn: () => api.get(id),
  });
  const summary = useQuery({
    queryKey: ["investigation-support", id],
    queryFn: () => api.summary(id),
  });
  const updates = useQuery({
    queryKey: ["investigation-updates", id],
    queryFn: () => api.updates(id),
  });
  const wallet = useQuery({
    queryKey: ["spark-wallet", uid],
    queryFn: api.wallet,
    enabled: !!uid,
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
  const support = async () => {
    if (!uid) {
      r.push("/(auth)/sign-in");
      return;
    }
    if (!api.validAmount(kind, amount)) return;
    const payload = JSON.stringify([id, kind, amount, publicAck]);
    if (attempt.current.payload !== payload)
      attempt.current = { payload, key: key() };
    setBusy(true);
    setError("");
    try {
      const out = await api.contribute(
        id,
        kind,
        Number(amount),
        publicAck,
        attempt.current.key,
      );
      setReceipt(out);
      setPanel(false);
      await qc.invalidateQueries({ queryKey: ["investigation-support", id] });
      await wallet.refetch();
    } catch (x) {
      setError(
        x instanceof Error
          ? x.message
          : "Could not confirm your contribution. Retry with the same details.",
      );
    } finally {
      setBusy(false);
    }
  };
  const money = (k: string, n: number) =>
    `₦${(n * (k === "thunder" ? 1000 : 10)).toLocaleString()}`;
  if (receipt)
    return (
      <CommunityPage title="You helped move the question forward.">
        <Heading>
          {receipt.amount}{" "}
          {receipt.kind === "thunder" ? "Thunder Sparks" : "Sparks"} added
        </Heading>
        <Copy>{money(receipt.kind, receipt.amount)} equivalent</Copy>
        <Card>
          <Heading>{item?.title}</Heading>
          <Copy>Receipt: {receipt.id}</Copy>
          <Copy>Spark balance: {receipt.sparks}</Copy>
          <Copy>Thunder Spark balance: {receipt.thunder}</Copy>
          <Copy>
            Acknowledgment: {receipt.public_ack ? "Public" : "Anonymous"}
          </Copy>
        </Card>
        <Card>
          <Heading>Updated support</Heading>
          <Copy>
            {receipt.summary.sparks} Sparks · {receipt.summary.thunder} Thunder
            Sparks · {receipt.summary.supporters} supporters
          </Copy>
        </Card>
        <Copy>Financial support does not determine the findings.</Copy>
        <Button
          label="View investigation"
          onPress={() => {
            setReceipt(null);
            attempt.current = { payload: "", key: "" };
          }}
        />
        <Button
          quiet
          label="Share question"
          onPress={() =>
            void Share.share({
              message: item?.title || "An Unmask investigation",
            })
          }
        />
      </CommunityPage>
    );
  return (
    <CommunityPage title={item?.title || "Investigation"}>
      <Busy
        loading={q.isLoading}
        error={q.error}
        retry={() => void q.refetch()}
      />
      {item ? (
        <>
          {product ? (
            <Card>
              <Photo uri={product.image_url} size={130} />
              <Heading>{product.name}</Heading>
            </Card>
          ) : null}
          <Pill>{item.status}</Pill>
          {item.concern ? <Copy>{item.concern}</Copy> : null}
          {creator ? (
            <Card>
              <Photo uri={creator.avatar_url} size={70} />
              <Heading>Unmasked by {creator.display_name}</Heading>
              <Button
                quiet
                label="View creator"
                onPress={() =>
                  r.push(`/creators?id=${creator.user_id}` as Href)
                }
              />
              <FollowButton type="person" id={creator.user_id} />
            </Card>
          ) : (
            <Copy muted>Creator not assigned yet.</Copy>
          )}
          {item.status === "published" ? (
            <>
              {item.video_url ? (
                <Button
                  label="Watch published investigation"
                  onPress={() => void Linking.openURL(item.video_url!)}
                />
              ) : (
                <Notice>No video has been attached yet.</Notice>
              )}
              <Card>
                <Heading>Key findings</Heading>
                <Copy>
                  {item.findings || "Findings have not been added yet."}
                </Copy>
              </Card>
              <Card>
                <Heading>Manufacturer response</Heading>
                <Copy>
                  {item.company_response || "No response published yet."}
                </Copy>
              </Card>
              <Card>
                <Heading>What remains unclear</Heading>
                <Copy>
                  {item.uncertainty ||
                    "No additional uncertainty note published."}
                </Copy>
              </Card>
              <Card>
                <Heading>Sources</Heading>
                <Copy>
                  {item.sources || "Sources have not been attached yet."}
                </Copy>
              </Card>
            </>
          ) : (
            <Card>
              <Heading>Investigation progress</Heading>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {["requested", "selected", "investigating", "published"].map(
                  (status) => (
                    <Pill key={status}>
                      {status === item.status ? `● ${status}` : status}
                    </Pill>
                  ),
                )}
              </View>
              <Copy small>Progress is updated by Unmask’s editorial team.</Copy>
            </Card>
          )}
          <Card>
            <Heading>Community support</Heading>
            <Busy
              loading={summary.isLoading}
              error={summary.error}
              retry={() => void summary.refetch()}
            />
            {summary.data ? (
              <Copy>
                {summary.data.sparks} Sparks · {summary.data.thunder} Thunder
                Sparks · {summary.data.supporters} supporters
              </Copy>
            ) : null}
            <Button
              label="Add support"
              onPress={() => {
                setError("");
                setPanel(true);
              }}
            />
            <Copy small>
              Support helps prioritize and produce investigations. It does not
              guarantee selection or a particular conclusion.
            </Copy>
          </Card>
          {summary.data?.backers.length ? (
            <Card>
              <Heading>Public supporters</Heading>
              <Copy small>
                Ordered by publicly acknowledged support. Anonymous
                contributions are excluded from this list.
              </Copy>
              {summary.data.backers.map((c) => (
                <Button
                  quiet
                  key={c.user_id}
                  label={`${c.name} · ${c.weight} Spark equivalents`}
                  onPress={() => r.push(`/member/${c.user_id}` as Href)}
                />
              ))}
            </Card>
          ) : null}
          <Heading>Updates</Heading>
          <Busy
            loading={updates.isLoading}
            error={updates.error}
            retry={() => void updates.refetch()}
          />
          {updates.data?.map((u) => (
            <Card key={u.id}>
              <Copy small>{new Date(u.created_at).toLocaleDateString()}</Copy>
              <Copy>{u.body}</Copy>
            </Card>
          ))}
          {updates.data?.length === 0 ? (
            <Copy muted>No editorial updates yet.</Copy>
          ) : null}
          {item.question_id ? (
            <Button
              quiet
              label="Join the original discussion"
              onPress={() => r.push(`/question/${item.question_id}` as Href)}
            />
          ) : null}
          {item.experience_id ? (
            <Button
              quiet
              label="Read the original experience"
              onPress={() =>
                r.push(`/contribute?experience=${item.experience_id}` as Href)
              }
            />
          ) : null}
          {item.product_id ? (
            <Button
              label="Share your experience"
              onPress={() =>
                r.push(`/contribute?product=${item.product_id}` as Href)
              }
            />
          ) : null}
        </>
      ) : null}
      <Modal
        visible={panel}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setPanel(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0006",
            justifyContent: "flex-end",
          }}
        >
          <ScrollView
            contentContainerStyle={[
              s.content,
              {
                backgroundColor: "white",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
              },
            ]}
          >
            <Heading>Help bring this question into focus</Heading>
            <Chips
              options={["sparks", "thunder"]}
              value={kind}
              onChange={(k) => {
                if (busy) return;
                setKind(k === "thunder" ? "thunder" : "sparks");
                setAmount(k === "thunder" ? "1" : "10");
              }}
            />
            <Chips
              options={kind === "sparks" ? ["10", "25", "50"] : ["1", "2", "5"]}
              value={amount}
              onChange={(v) => {
                if (!busy) setAmount(v);
              }}
            />
            <Field
              label="Amount"
              value={amount}
              onChange={(v) => {
                if (!busy) setAmount(v);
              }}
            />
            <Copy>
              {api.validAmount(kind, amount)
                ? money(kind, Number(amount))
                : "Enter a whole number: minimum 10 Sparks or 1 Thunder Spark."}
            </Copy>
            <Copy small>
              1 Spark = ₦10 · 1 Thunder Spark = ₦1,000 = 100 Sparks
            </Copy>
            <Busy
              loading={wallet.isLoading}
              error={wallet.error}
              retry={() => void wallet.refetch()}
            />
            <Copy>
              Your balance: {wallet.data?.sparks || 0} Sparks ·{" "}
              {wallet.data?.thunder || 0} Thunder Sparks
            </Copy>
            <Button
              quiet
              disabled={busy}
              label={
                publicAck
                  ? "Public acknowledgment: On"
                  : "Public acknowledgment: Off"
              }
              onPress={() => setPublic(!publicAck)}
            />
            <Copy small>
              Recharge payments are not connected yet. Only an existing credited
              balance can be used.
            </Copy>
            <Button
              quiet
              disabled={busy}
              label="View wallet & recharge"
              onPress={() => {
                setPanel(false);
                r.push("/wallet");
              }}
            />
            {error ? <Notice>{error}</Notice> : null}
            <Button
              label={
                busy
                  ? "Recording contribution…"
                  : `Add ${amount} ${kind === "sparks" ? "Sparks" : "Thunder Sparks"}`
              }
              disabled={
                busy ||
                !api.validAmount(kind, amount) ||
                (!!uid && (wallet.isLoading || wallet.isError))
              }
              onPress={() => void support()}
            />
            <Button
              quiet
              label="Close"
              disabled={busy}
              onPress={() => setPanel(false)}
            />
          </ScrollView>
        </View>
      </Modal>
    </CommunityPage>
  );
}
