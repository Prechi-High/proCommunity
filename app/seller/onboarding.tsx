import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Form = {
  businessName: string;
  contactEmail: string;
  phone: string;
  storeName: string;
  slug: string;
  tagline: string;
  description: string;
};

const initial: Form = {
  businessName: '',
  contactEmail: '',
  phone: '',
  storeName: '',
  slug: '',
  tagline: '',
  description: '',
};

export default function SellerOnboardingScreen() {
  const [form, setForm] = useState<Form>(initial);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const progress = useMemo(() => Math.min(step / 3, 1), [step]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (!supabase) {
      setMessage('Unmask authentication is not configured.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.push('/sign-up');
        return;
      }

      const response = await fetch('/api/stores/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.message || payload.error || 'We could not create your store.');
        return;
      }

      setStep(3);
      setMessage(`Your store workspace is reserved at ${payload.domain}. Complete payment to activate it.`);
    } catch {
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Seller Store Setup</Text>
        <Text style={styles.body}>Seller onboarding is currently web-first because store management and payment checkout live in the Commerce web layer.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <Text style={styles.eyebrow}>UNMASK COMMERCE</Text>
        <Text style={styles.title}>Build your store on Unmask.</Text>
        <Text style={styles.body}>Your store is separate from Unmask's product-intelligence database, but connected to the same Unmask identity.</Text>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>

        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Your business</Text>
            <TextInput placeholder="Business name" value={form.businessName} onChangeText={(v) => update('businessName', v)} style={styles.input} />
            <TextInput placeholder="Contact email" keyboardType="email-address" value={form.contactEmail} onChangeText={(v) => update('contactEmail', v)} style={styles.input} />
            <TextInput placeholder="Phone number" value={form.phone} onChangeText={(v) => update('phone', v)} style={styles.input} />
            <Pressable style={styles.button} onPress={() => setStep(2)}>
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </View>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. Create your store identity</Text>
            <TextInput placeholder="Store name" value={form.storeName} onChangeText={(v) => update('storeName', v)} style={styles.input} />
            <TextInput placeholder="Store handle e.g. glowhouse" autoCapitalize="none" value={form.slug} onChangeText={(v) => update('slug', v)} style={styles.input} />
            <TextInput placeholder="Short tagline" value={form.tagline} onChangeText={(v) => update('tagline', v)} style={styles.input} />
            <TextInput placeholder="Tell customers what your store is about" value={form.description} onChangeText={(v) => update('description', v)} style={[styles.input, styles.multiline]} multiline />
            <View style={styles.row}>
              <Pressable style={styles.secondaryButton} onPress={() => setStep(1)}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={submit} disabled={loading}>
                {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>Reserve store</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Activate your store</Text>
            <Text style={styles.body}>{message}</Text>
            <View style={styles.activation}>
              <Text style={styles.activationTitle}>Store activation</Text>
              <Text style={styles.body}>Payment activates the founding store plan. Your payment provider will later confirm the transaction to Commerce, after which the store becomes live.</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
              <Text style={styles.secondaryText}>Return to Unmask</Text>
            </Pressable>
          </View>
        )}

        {!!message && step !== 3 && <Text style={styles.error}>{message}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#f7f7f5', padding: 32 },
  shell: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingVertical: 56 },
  eyebrow: { fontSize: 12, letterSpacing: 2, fontWeight: '700', opacity: 0.55, marginBottom: 14 },
  title: { fontSize: 42, lineHeight: 48, fontWeight: '700', letterSpacing: -1.2, marginBottom: 12 },
  body: { fontSize: 16, lineHeight: 25, opacity: 0.7, marginBottom: 22 },
  progressTrack: { height: 5, borderRadius: 999, backgroundColor: '#e4e4df', overflow: 'hidden', marginVertical: 28 },
  progressBar: { height: '100%', backgroundColor: '#111' },
  card: { backgroundColor: '#fff', borderRadius: 28, padding: 28, shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  cardTitle: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  input: { minHeight: 52, borderWidth: 1, borderColor: '#deded8', borderRadius: 15, paddingHorizontal: 16, marginBottom: 12, fontSize: 16, backgroundColor: '#fcfcfb' },
  multiline: { minHeight: 110, paddingTop: 14, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  button: { minHeight: 52, paddingHorizontal: 22, borderRadius: 15, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', flex: 1 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { minHeight: 52, paddingHorizontal: 22, borderRadius: 15, borderWidth: 1, borderColor: '#d8d8d2', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  activation: { borderRadius: 18, padding: 18, backgroundColor: '#f3f3ee', marginBottom: 18 },
  activationTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  error: { marginTop: 16, color: '#a33', fontSize: 14 },
  center: { flex: 1, padding: 32, justifyContent: 'center', alignItems: 'center' },
});
