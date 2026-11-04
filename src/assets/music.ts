// Every island theme is composed in code by scripts/compose-music.py (no samples). Gains even
// out the tracks' loudness (measured mean levels) so no island is louder than another.
export const MUSIC = {
  // Composed in code (scripts/compose-music.py): a 6/8 sea shanty for setting out.
  beach: {
    file: 'assets/audio/beach-7c1535b327e2.mp3',
    gain: 0.31,
  },
  // Composed in code: the Cyclops's footfalls, dripping bells and a low horn.
  cave: {
    file: 'assets/audio/cave-38472ced6025.mp3',
    gain: 0.28,
  },
  // Composed in code: fast 3/4 gusts and a soaring flute for Aeolus's island.
  wind: {
    file: 'assets/audio/wind-026db27307dc.mp3',
    gain: 0.26,
  },
  // Composed in code: a slow minor waltz for the magic forest.
  circe: {
    file: 'assets/audio/circe-4d3516102789.mp3',
    gain: 0.18,
  },
  // Composed in code: a 6/8 song for a wordless choir, the Sirens' call.
  sea: {
    file: 'assets/audio/sea-cb5cba35d699.mp3',
    gain: 0.21,
  },
  // Composed in code: a driving piece with sea swells for the strait.
  strait: {
    file: 'assets/audio/strait-84049ccca260.mp3',
    gain: 0.24,
  },
  // Composed in code: the homecoming march, horns and the choir in a major key.
  palace: {
    file: 'assets/audio/palace-254f178294de.mp3',
    gain: 0.28,
  },
} as const;
