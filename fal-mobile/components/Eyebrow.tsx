/**
 * Eyebrow — büyük harf bölüm etiketi.
 *
 * Neden ayrı bileşen: Türkçe'de büyük harfe çevirme varsayılan davranışla
 * yanlış sonuç veriyor.
 *
 *   'Hilal'.toUpperCase()   → 'HILAL'   (doğrusu 'HİLAL')
 *   'ilişki'.toUpperCase()  → 'ILIŞKI'  (doğrusu 'İLİŞKİ')
 *
 * Aynı sorun CSS `text-transform: uppercase` ve React Native'in
 * `textTransform` özelliğinde de var. Noktalı/noktasız I ayrı harfler;
 * yanlışı Türk kullanıcı anında görüyor ve ürün özensiz duruyor.
 *
 * Bu yüzden büyütme tek yerden, `tr` yerel ayarıyla yapılıyor.
 */
import React from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';

/** Türkçe kurallarına göre büyük harfe çevirir. */
export function trUpper(s: string): string {
  return s.toLocaleUpperCase('tr-TR');
}

type Props = TextProps & {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
};

export function Eyebrow({ children, style, ...rest }: Props) {
  return (
    <Text style={style} {...rest}>
      {React.Children.map(children, (c) =>
        typeof c === 'string' ? trUpper(c) : typeof c === 'number' ? c : c,
      )}
    </Text>
  );
}
