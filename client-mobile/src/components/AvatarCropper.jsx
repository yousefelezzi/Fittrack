import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Modal, PanResponder, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Text } from './AppText';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors, makeStyles } from './tokens';

const VIEW = Math.min(Dimensions.get('window').width - 48, 320); // on-screen crop area
const OUTPUT = 512;  // saved avatar size, px
const MAX_ZOOM = 4;
const RING = 600;    // dimmed border drawn around the circle

/**
 * Crop a picked photo to the circle the avatar is shown in: drag to position,
 * pinch or use −/+ to zoom. `onSave(uri)` gets a square JPEG (the circle is
 * applied when it's displayed). `image` is the picker asset ({ uri, width, height }).
 */
export default function AvatarCropper({ image, onCancel, onSave, saving }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const state = useRef({ zoom: 1, offset: { x: 0, y: 0 } });
  state.current = { zoom, offset };

  // Zoom 1 = the photo just covers the crop area.
  const base = image ? Math.max(VIEW / image.width, VIEW / image.height) : 1;
  const sizeAt = (z) => ({ w: image.width * base * z, h: image.height * base * z });
  const clamp = (o, z) => {
    const { w, h } = sizeAt(z);
    return { x: Math.max(-(w - VIEW) / 2, Math.min((w - VIEW) / 2, o.x)), y: Math.max(-(h - VIEW) / 2, Math.min((h - VIEW) / 2, o.y)) };
  };
  useEffect(() => { setZoom(1); setOffset({ x: 0, y: 0 }); setError(''); }, [image?.uri]);

  const setZoomTo = (z) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    setZoom(next);
    setOffset((o) => clamp(o, next));
  };

  // Where the crop area's centre is on screen, for zooming around the fingers.
  const viewRef = useRef(null);
  const center = useRef({ x: 0, y: 0 });
  const measure = () => viewRef.current?.measureInWindow((x, y, w, h) => { center.current = { x: x + w / 2, y: y + h / 2 }; });

  // Each move is worked out from where the gesture (or its current finger
  // count) started, so it doesn't drift; adding or lifting a finger starts afresh.
  const gesture = useRef({});
  const begin = (touches) => {
    const { zoom: z, offset: o } = state.current;
    if (touches.length >= 2) {
      const [a, b] = touches;
      gesture.current = {
        count: 2, zoom: z, offset: o,
        d: Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)),
        mid: { x: (a.pageX + b.pageX) / 2 - center.current.x, y: (a.pageY + b.pageY) / 2 - center.current.y },
      };
    } else if (touches.length === 1) {
      gesture.current = { count: 1, offset: o, x: touches[0].pageX, y: touches[0].pageY };
    }
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => { measure(); begin(e.nativeEvent.touches); },
    onPanResponderMove: (e) => {
      const touches = e.nativeEvent.touches;
      const count = Math.min(touches.length, 2);
      if (!count) return;
      if (count !== gesture.current.count) { begin(touches); return; }
      const g = gesture.current;
      if (count === 2) {
        // Pinch: zoom by how far apart the fingers are, keeping the spot between them under them.
        const [a, b] = touches;
        const d = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
        const z = Math.min(MAX_ZOOM, Math.max(1, g.zoom * (d / g.d)));
        const mid = { x: (a.pageX + b.pageX) / 2 - center.current.x, y: (a.pageY + b.pageY) / 2 - center.current.y };
        const k = z / g.zoom;
        setZoom(z);
        setOffset(clamp({ x: mid.x - (g.mid.x - g.offset.x) * k, y: mid.y - (g.mid.y - g.offset.y) * k }, z));
        return;
      }
      setOffset(clamp({ x: g.offset.x + touches[0].pageX - g.x, y: g.offset.y + touches[0].pageY - g.y }, state.current.zoom));
    },
  }), [image?.uri]);

  if (!image) return null;
  const { w, h } = sizeAt(zoom);
  const left = VIEW / 2 - w / 2 + offset.x;
  const top = VIEW / 2 - h / 2 + offset.y;

  const save = async () => {
    setError('');
    try {
      const scale = base * zoom;
      // The crop area in the photo's own pixels.
      const size = Math.min(image.width, image.height, Math.round(VIEW / scale));
      const rect = {
        originX: Math.max(0, Math.min(image.width - size, Math.round(-left / scale))),
        originY: Math.max(0, Math.min(image.height - size, Math.round(-top / scale))),
        width: size,
        height: size,
      };
      const rendered = await ImageManipulator.manipulate(image.uri).crop(rect).resize({ width: OUTPUT, height: OUTPUT }).renderAsync();
      const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
      onSave(result.uri);
    } catch {
      setError('Could not crop that photo. Try another one.');
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Profile picture</Text>
          <View ref={viewRef} onLayout={measure} style={styles.view} {...pan.panHandlers}>
            <Image source={{ uri: image.uri }} style={{ position: 'absolute', left, top, width: w, height: h }} />
            {/* Dim everything outside the circle: that's what the avatar shows. */}
            <View pointerEvents="none" style={styles.ring} />
          </View>
          <View style={styles.zoomRow}>
            <TouchableOpacity onPress={() => setZoomTo(zoom - 0.25)} style={styles.zoomBtn}><Text style={styles.zoomText}>−</Text></TouchableOpacity>
            <Text style={styles.hint}>Drag to move · pinch or tap − / + to zoom</Text>
            <TouchableOpacity onPress={() => setZoomTo(zoom + 0.25)} style={styles.zoomBtn}><Text style={styles.zoomText}>+</Text></TouchableOpacity>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.buttons}>
            <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.btnSecondary]}><Text style={[styles.btnText, { color: colors.textPrimary }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving} style={[styles.btn, styles.btnPrimary, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = makeStyles(() => ({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box:      { backgroundColor: colors.surface, borderRadius: 20, padding: 16, alignItems: 'center', width: VIEW + 32 },
  title:    { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12, alignSelf: 'flex-start' },
  view:     { width: VIEW, height: VIEW, overflow: 'hidden', borderRadius: 12, backgroundColor: '#111827' },
  // A circle the size of the crop area with a very thick translucent border:
  // the border covers everything outside the circle.
  ring:     {
    position: 'absolute', left: -RING, top: -RING, width: VIEW + RING * 2, height: VIEW + RING * 2,
    borderRadius: (VIEW + RING * 2) / 2, borderWidth: RING, borderColor: 'rgba(0,0,0,0.55)',
  },
  zoomRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  zoomBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontSize: 20, color: colors.textPrimary },
  hint:     { flex: 1, textAlign: 'center', fontSize: 11, color: colors.textMuted },
  error:    { color: colors.danger, fontSize: 12, marginTop: 8 },
  buttons:  { flexDirection: 'row', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  btn:      { flex: 1, minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnPrimary:  { backgroundColor: colors.brand },
  btnSecondary:{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
}));
