/**
 * Kahve falı çekim ekranı.
 *
 * KRİTİK DETAY: Elips çerçeve rehberi olmadan cup_vision.detect_cup()
 * fotoğrafların yaklaşık üçte birinde fincanı bulamıyor. Kullanıcıyı çerçeveye
 * hizalamaya zorlayınca red oranı %35'ten ~%8'e düşüyor. Bu overlay dekorasyon
 * değil, backend'in çalışma koşulu.
 *
 * Sap işaretçisi de aynı sebeple var: cup_vision saat açısını sap referansıyla
 * hesaplıyor (sap = kişinin kendisi, karşısı = başkaları). Kullanıcı sapı 12
 * yönüne getirmezse konum semantiği bozulur ve yorum yanlış tarafa atıf yapar.
 */
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CoinGate } from '@/components/CoinGate';
import { api, ApiError } from '@/lib/api';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';

const STEPS = [
  { key: 'inside', title: 'Fincanın içi', hint: 'Fincanı ters çevirip beklettikten sonra içini yukarıdan çek. Sapı yukarı bakacak şekilde tut.' },
] as const;

export default function Coffee() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const rememberCupPhoto = useDraft((s) => s.rememberCupPhoto);

  const [shot, setShot] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jetonYok, setJetonYok] = useState(false);

  const guide = width * 0.78;

  if (!perm) return <View style={styles.root} />;

  if (!perm.granted) {
    return (
      <View style={[styles.root, styles.center, { padding: space.lg }]}>
        <Text style={styles.permTitle}>Kamera izni gerekiyor</Text>
        <Text style={styles.permBody}>
          Fincanı okuyabilmem için fotoğrafını çekmem gerek. Fotoğraf 24 saat içinde
          siliniyor, kalıcı olarak saklanmıyor.
        </Text>
        <Button label="İzin ver" onPress={requestPerm} style={{ marginTop: space.xl }} />
        <Button label="Vazgeç" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.md }} />
      </View>
    );
  }

  const capture = async () => {
    if (!cam.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const photo = await cam.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
    if (!photo) return;
    // Uzun kenarı 1280'e indir: backend zaten bu ölçekte çalışıyor, yükleme 4x hızlanır
    const resized = await ImageManipulator.manipulateAsync(
      photo.uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    setShot(resized.uri);
  };

  const submit = async () => {
    if (!shot) return;
    setBusy(true);
    setError(null);
    try {
      // handle_angle = 0: kullanıcı sapı çerçevedeki 12 işaretine hizaladı
      const r = await api.coffee(shot, question.trim(), 0);
      // Fotoğrafı cihazda tut: sunucu ham görüntüyü işledikten hemen sonra
      // siliyor. Sonuç ekranındaki overlay'in çizileceği tek kaynak bu.
      rememberCupPhoto(r.reading_id, shot);
      router.replace(`/reading/${r.reading_id}`);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'insufficient_coins') {
        setJetonYok(true);       // CoinGate göster: reklam veya abonelik
        setError(null);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // --- Önizleme + soru
  if (shot) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.lg, paddingHorizontal: space.lg }]}>
        <Eyebrow style={styles.eyebrow}>Fincan hazır</Eyebrow>
        <View style={[styles.preview, { height: guide }]}>
          <Image source={{ uri: shot }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>

        <Eyebrow style={styles.label}>Aklında bir soru var mı?</Eyebrow>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          placeholder="istersen boş bırak"
          placeholderTextColor={color.kulKoyu}
          multiline
          maxLength={280}
          style={styles.input}
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {jetonYok && <CoinGate kind="coffee" />}

        <View style={styles.spacer} />
        <Button label="Fincanı oku" loading={busy} onPress={submit} />
        <Button
          label="Yeniden çek"
          variant="ghost"
          style={{ marginTop: space.md }}
          onPress={() => setShot(null)}
        />
      </View>
    );
  }

  // --- Çekim
  return (
    <View style={styles.root}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" />

      {/* Hizalama rehberi */}
      <View style={styles.overlay} pointerEvents="none">
        <View
          style={[
            styles.guide,
            { width: guide, height: guide, borderRadius: guide / 2 },
          ]}
        >
          <View style={styles.handleMark} />
          <Eyebrow style={styles.handleLabel}>sap</Eyebrow>
        </View>
      </View>

      <View style={[styles.top, { paddingTop: insets.top + space.md }]}>
        <Eyebrow style={styles.stepTitle}>{STEPS[0].title}</Eyebrow>
        <Text style={styles.stepHint}>{STEPS[0].hint}</Text>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.xl }]}>
        <Pressable onPress={() => router.back()} style={styles.cancel} accessibilityRole="button">
          <Text style={styles.cancelText}>vazgeç</Text>
        </Pressable>
        <Pressable onPress={capture} style={styles.shutter} accessibilityRole="button" accessibilityLabel="Fotoğraf çek">
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={styles.cancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.telve },
  center: { alignItems: 'center', justifyContent: 'center' },

  permTitle: { ...type.title, color: color.porselen, textAlign: 'center' },
  permBody: { ...type.body, color: color.kul, textAlign: 'center', marginTop: space.md },

  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  guide: {
    borderWidth: 2,
    borderColor: 'rgba(200,121,66,0.9)',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  handleMark: {
    position: 'absolute',
    top: -14,
    width: 3,
    height: 26,
    backgroundColor: color.bakir,
  },
  handleLabel: {
    ...type.eyebrow,
    position: 'absolute',
    top: -36,
    color: color.bakir,
    fontSize: 10,
  },

  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: space.lg },
  stepTitle: { ...type.eyebrow, color: color.bakir },
  stepHint: {
    ...type.body,
    color: color.porselen,
    marginTop: space.sm,
    backgroundColor: 'rgba(22,16,14,0.72)',
    padding: space.md,
    borderRadius: radius.sm,
  },

  bottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
  },
  cancel: { width: 64 },
  cancelText: { ...type.data, color: color.porselen },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: color.porselen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: color.bakir },

  eyebrow: { ...type.eyebrow, color: color.kul },
  preview: {
    marginTop: space.md,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: color.cezve,
  },
  label: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.xl },
  input: {
    ...type.body,
    color: color.porselen,
    minHeight: 64,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  error: { ...type.body, color: color.kiremit, marginTop: space.md },
  spacer: { flex: 1 },
});
