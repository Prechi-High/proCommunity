import { useEffect, useRef, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { hapticSupportConfirmed, hapticError } from '@/lib/haptics';
import * as api from '@/lib/investigations/api';
import { sparkNaira } from '@/lib/unmask/status';
import { useAppStore } from '@/lib/store';
import { ActionButton } from './ActionButton';
import { ActionSheet } from './ActionSheet';
import { FilterChips } from './FilterChips';
import { SparkBurst } from './SparkBurst';
import { StatusMessage } from './StatusMessage';
function opKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16); });
}
export function SparkSheet({ open, onClose, investigationId }: { open: boolean; onClose: () => void; investigationId: string }) {
  const router = useRouter(), qc = useQueryClient();
  const uid = useAppStore(s => s.profile?.id);
  const [kind, setKind] = useState<'sparks' | 'thunder'>('sparks');
  const [amount, setAmount] = useState('10');
  const [publicAck, setPublicAck] = useState(false);
  const [pending, setPending] = useState(false), [unknown, setUnknown] = useState(false);
  const [receipt, setReceipt] = useState<api.Receipt | null>(null), [error, setError] = useState('');
  const key = useRef(opKey());
  // A timed-out operation retains its exact payload and key until resolved.
  const operation = useRef<{ kind: 'sparks' | 'thunder'; amount: number; publicAck: boolean; id: string; key: string } | null>(null);
  useEffect(() => { setReceipt(null); setUnknown(false); setError(''); operation.current = null; key.current = opKey(); }, [investigationId, uid]);
  const wallet = useQuery({ queryKey: ['spark-wallet', uid], queryFn: api.wallet, enabled: !!uid && open });
  const valid = api.validAmount(kind, amount);
  const balance = kind === 'sparks' ? wallet.data?.sparks ?? 0 : wallet.data?.thunder ?? 0;
  const insufficient = !!uid && !wallet.isLoading && !wallet.isError && valid && Number(amount) > balance;
  const confirm = async () => {
    if (!uid) { onClose(); router.push('/(auth)/sign-in' as Href); return; }
    if (pending || (!unknown && !valid)) return;
    setPending(true); setError('');
    const op = operation.current ?? { kind, amount: Number(amount), publicAck, id: investigationId, key: key.current };
    operation.current = op;
    try {
      const out = await api.contribute(op.id, op.kind, op.amount, op.publicAck, op.key);
      setReceipt(out); setUnknown(false); hapticSupportConfirmed(op.key);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['investigation-support', op.id] }),
        qc.invalidateQueries({ queryKey: ['spark-wallet', uid] }),
        qc.invalidateQueries({ queryKey: ['spark-history', uid] }),
        qc.invalidateQueries({ queryKey: ['unmasks'] }),
        qc.invalidateQueries({ queryKey: ['home-feed'] }),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not record support.';
      if (/timeout|network|fetch/i.test(msg)) setUnknown(true);
      else { setUnknown(false); hapticError(); setError(msg); operation.current = null; key.current = opKey(); }
    } finally { setPending(false); }
  };
  const locked = pending || unknown || !!receipt;
  return <ActionSheet open={open} title={COPY.sparkSheetTitle} onClose={onClose}>
    <Text style={s.body}>Use your wallet balance to support this investigation. Support helps fund the work; it does not buy a conclusion or guarantee a response from the company.</Text>
    {!locked ? <FilterChips options={['Sparks', 'Thunder Sparks']} value={kind === 'sparks' ? 'Sparks' : 'Thunder Sparks'} onChange={v => { setKind(v === 'Sparks' ? 'sparks' : 'thunder'); setAmount(v === 'Sparks' ? '10' : '1'); setError(''); }} /> : null}
    <Text style={s.label}>How many {kind === 'sparks' ? 'Sparks' : 'Thunder Sparks'}?</Text>
    <TextInput accessibilityLabel="Contribution amount" keyboardType="number-pad" editable={!locked} value={amount} onChangeText={setAmount} maxLength={7} style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16, fontFamily: fonts.semibold, fontSize: 24, color: colors.ink }} />
    <Text style={s.body}>{valid ? `${sparkNaira(Number(amount) * (kind === 'thunder' ? 100 : 1))} equivalent · deducted once from your wallet` : `Enter a whole number from ${kind === 'sparks' ? 10 : 1} to 1,000,000.`}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ flex: 1, gap: 4 }}><Text style={s.label}>Show my name among supporters</Text><Text style={s.small}>Optional. Your support counts either way.</Text></View><Switch accessibilityLabel="Public supporter acknowledgment" value={publicAck} onValueChange={setPublicAck} disabled={locked} trackColor={{ true: colors.brand }} /></View>
    {uid ? <Text style={s.small}>{wallet.isLoading ? 'Loading wallet…' : wallet.isError ? 'Wallet unavailable. Try again.' : `Your balance: ${wallet.data?.sparks ?? 0} Sparks · ${wallet.data?.thunder ?? 0} Thunder Sparks`}</Text> : null}
    {receipt ? <><SparkBurst show thunder={receipt.kind === 'thunder'} /><StatusMessage kind="success" title={`${receipt.amount} ${receipt.kind === 'sparks' ? 'Sparks' : 'Thunder Sparks'} recorded`} detail={`Combined support is now ${receipt.summary.sparks + receipt.summary.thunder * 100} Spark equivalents.`}/><ActionButton label="Done" onPress={onClose}/><ActionButton tone="ghost" label="Add more support" onPress={() => { setReceipt(null); operation.current = null; key.current = opKey(); void wallet.refetch(); }}/></> : <>
      {unknown ? <StatusMessage kind="pending" title="Checking whether support was recorded" detail="Use ‘Check contribution’ to safely retry the same reference. You will not be charged twice for this operation."/> : error ? <StatusMessage kind="error" title="Support wasn’t recorded" detail={error}/> : null}
      {insufficient && !unknown ? <><StatusMessage kind="info" title="Not enough wallet balance" detail="Checkout is not connected yet. No payment has been taken."/><ActionButton tone="secondary" label="View Spark packs" onPress={() => { onClose(); router.push('/wallet/recharge' as Href); }}/></> : null}
      <ActionButton label={unknown ? 'Check contribution' : uid ? `Confirm ${valid ? amount : ''} ${kind === 'sparks' ? 'Sparks' : 'Thunder Sparks'}` : 'Sign in to support'} pending={pending} disabled={!unknown && (!!uid && (wallet.isLoading || wallet.isError || insufficient) || !valid)} onPress={() => void confirm()}/>
    </>}
  </ActionSheet>;
}
const s = { body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.inkSoft }, label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }, small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.inkSoft } };
