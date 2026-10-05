import React, { useState } from 'react';
import { View, Image } from 'react-native';
import { assetUrl } from '../api';
import { Dumbbell } from 'lucide-react-native';
import { colors, makeStyles } from './tokens';

/**
 * Photo of an exercise. `images` are the start and end positions; with
 * `both`, they're shown side by side (start → end), otherwise just the start.
 * Falls back to an icon when there's no photo (e.g. custom exercises).
 */
export default function ExerciseImage({ images = [], both = false, style }) {
  const [failed, setFailed] = useState(false);
  const list = (both ? images.slice(0, 2) : images.slice(0, 1)).filter(Boolean);

  if (!list.length || failed) {
    return (
      <View style={[styles.fallback, style]}>
        <Dumbbell size={16} color={colors.textMuted} style={{ opacity: 0.6 }} />
      </View>
    );
  }
  return (
    <View style={[{ flexDirection: 'row', gap: 6 }, style]}>
      {list.map((src) => (
        <Image key={src} source={{ uri: assetUrl(src) }} onError={() => setFailed(true)}
          style={styles.img} resizeMode="cover" />
      ))}
    </View>
  );
}

const styles = makeStyles(() => ({
  fallback: { alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: colors.subtle },
  img:      { flex: 1, height: '100%', borderRadius: 8, backgroundColor: colors.subtle },
}));
