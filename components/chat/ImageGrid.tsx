import React, { memo } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { useLocale } from '@/contexts/locale'
import { fonts } from '@/constants/theme'
import { gridLayout, singleImageHeight, type GridSource } from '@/lib/chat/images'

const GAP = 2
const RADIUS = 10

type Props = {
  sources: GridSource[]
  /** Tap on a tile: open the viewer at that index. */
  onOpen: (index: number) => void
}

/**
 * Bubble image grid (same shapes as the website): 1 single, 2 side by side, 3 as two tiles
 * plus a full-width third, 4+ as 2x2 with "+N" on the 4th tile. Thumbs use stable cache keys.
 */
export const ImageGrid = memo(function ImageGrid({ sources, onOpen }: Props) {
  const { t } = useLocale()
  const { width: windowWidth } = useWindowDimensions()
  const W = Math.min(260, Math.round(windowWidth * 0.68))
  const tile = (W - GAP) / 2
  const { shown, extra, spanLast } = gridLayout(sources.length)
  const label = sources.length > 1 ? t.chat.photos : t.chat.photo

  if (!shown) return null

  const renderTile = (i: number, w: number, h: number) => {
    const s = sources[i]
    const more = i === 3 && extra > 0
    return (
      <Pressable
        key={s.key}
        onPress={() => onOpen(i)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`${label} ${i + 1}/${sources.length}`}
        style={({ pressed }) => [styles.tile, { width: w, height: h }, pressed && styles.pressed]}
      >
        <Image
          source={s.thumb}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={s.key}
        />
        {more ? (
          <View style={styles.more}>
            <Text style={styles.moreText}>+{extra}</Text>
          </View>
        ) : null}
      </Pressable>
    )
  }

  if (shown === 1) {
    const s = sources[0]
    return <View style={{ width: W }}>{renderTile(0, W, singleImageHeight(W, s.width, s.height))}</View>
  }

  if (shown === 2) {
    return (
      <View style={[styles.row, { width: W }]}>
        {renderTile(0, tile, tile)}
        {renderTile(1, tile, tile)}
      </View>
    )
  }

  return (
    <View style={[styles.col, { width: W }]}>
      <View style={styles.row}>
        {renderTile(0, tile, tile)}
        {renderTile(1, tile, tile)}
      </View>
      {spanLast ? (
        renderTile(2, W, tile)
      ) : (
        <View style={styles.row}>
          {renderTile(2, tile, tile)}
          {renderTile(3, tile, tile)}
        </View>
      )}
    </View>
  )
})

const styles = StyleSheet.create({
  col: { gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  tile: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  pressed: { opacity: 0.85 },
  more: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,20,45,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: '#FFFFFF',
    writingDirection: 'ltr',
  },
})
