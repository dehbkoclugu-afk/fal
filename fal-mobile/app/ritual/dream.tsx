/**
 * Rüya ritüeli.
 *
 * İki ürün kararı bu ekranı diğer ritüellerden ayırıyor:
 *
 * 1. DOĞUM VERİSİ ZORUNLU DEĞİL. Kahve, tarot ve doğum haritası haritaya
 *    dayanıyor; rüya kullanıcının kendi anlatısına dayanıyor ve haritasız da
 *    anlamlı. Bu onu onboarding'i yarıda bırakmış kullanıcının girebildiği
 *    tek kapı yapıyor — kapatmak gereksiz bir kayıp olurdu.
 *
 * 2. RÜYANIN GECESİ SORULUYOR. Kullanıcı rüyayı sabah anlatıyor ama rüya dün
 *    gece görüldü ve o gecenin Ay'ı farklı olabilir (Ay ~2.5 günde burç
 *    değiştiriyor). Yorumun tek hesaplanmış çıpası bu; yanlış geceye
 *    bağlamak, "uydurmuyoruz" iddiasını sessizce boşa çıkarır.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/Button';
import { CoinGate } from '@/components/CoinGate';
import { Screen } from '@/components/Screen';
import { api, ApiError } from '@/lib/api';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

/** Sunucudaki alt sınırla aynı; burada tutmak boşuna istek atmayı önlüyor. */
const EN_AZ = 20;

/** Gün ofsetinden YYYY-AA-GG üretir — sunucu ISO tarih bekliyor. */
function isoGun(oncekiGun: number): string {
  const d = new Date();
  d.setDate(d.getDate() - oncekiGun);
  return d.toISOString().slice(0, 10);
}

const NE_ZAMAN = [
  { key: 1, label: 'ruya.dunGece' },
  { key: 2, label: 'ruya.oncekiGece' },
] as const;

export default function Dream() {
  const router = useRouter();
  const [metin, setMetin] = useState('');
  const [gunOnce, setGunOnce] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const fiyat = me?.prices?.dream ?? 2;
  const abone = !!me?.entitlement;
  const yetersiz = !abone && (me?.coins ?? 0) < fiyat;

  const kisa = metin.trim().length < EN_AZ;
  const haritaYok = me ? !me.has_birth_data : false;

  const tarih = useMemo(() => isoGun(gunOnce), [gunOnce]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.dream(metin.trim(), tarih);
      router.replace(`/reading/${r.reading_id}`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>{t('ruya.eyebrow')}</Eyebrow>
      <Text style={styles.title}>{t('ruya.baslik')}</Text>
      <Text style={styles.lead}>{t('ruya.aciklama')}</Text>

      <TextInput
        value={metin}
        onChangeText={setMetin}
        placeholder={t('ruya.placeholder')}
        placeholderTextColor={color.kulKoyu}
        multiline
        textAlignVertical="top"
        maxLength={4000}
        style={styles.alan}
      />

      <Eyebrow style={styles.label}>{t('ruya.neZaman')}</Eyebrow>
      <View style={styles.chips}>
        {NE_ZAMAN.map((n) => {
          const on = gunOnce === n.key;
          return (
            <Pressable
              key={n.key}
              onPress={() => {
                Haptics.selectionAsync();
                setGunOnce(n.key);
              }}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && { color: color.bakir }]}>
                {t(n.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Haritası olmayan kullanıcı geri çevrilmiyor; sadece ne kazanacağını
          görüyor. Kapıyı kapatmak, bu ritüelin var oluş sebebini iptal eder. */}
      {haritaYok ? <Text style={styles.not}>{t('ruya.haritasizNot')}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />
      <Button
        label={abone ? t('ruya.yorumla') : t('ruya.yorumlaJeton', { n: fiyat })}
        loading={busy}
        disabled={kisa || yetersiz}
        onPress={submit}
      />
      {kisa && metin.length > 0 ? (
        <Text style={styles.not}>{t('ruya.cokKisa')}</Text>
      ) : null}
      {yetersiz ? <CoinGate kind="dream" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.lg },
  title: { ...type.title, color: color.porselen, marginTop: space.sm },
  lead: { ...type.body, color: color.kul, marginTop: space.md },
  alan: {
    ...type.body,
    color: color.porselen,
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 160,
    marginTop: space.lg,
  },
  label: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: color.cizgi,
    borderRadius: radius.full,
  },
  chipOn: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  chipText: { ...type.data, color: color.kul, fontSize: 12 },
  not: { ...type.data, color: color.kulKoyu, fontSize: 11, marginTop: space.md, lineHeight: 16 },
  error: { ...type.data, color: color.kiremit, marginTop: space.lg, fontSize: 12 },
  spacer: { height: space.xl },
});
