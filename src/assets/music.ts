// User-supplied Suno tracks; unchanged original MP3 files.
export const MUSIC = {
  beach: {
    file: 'assets/audio/beach-78e90c47be32.mp3',
    gain: 0.22,
  },
  cave: {
    file: 'assets/audio/cave-3b7dca88f289.mp3',
    gain: 0.22,
  },
  wind: {
    file: 'assets/audio/wind-135cdecfaf1b.mp3',
    gain: 0.22,
  },
  // Composed in code (scripts/compose-music.py): a slow minor waltz for the magic forest.
  circe: {
    file: 'assets/audio/circe-4d3516102789.mp3',
    gain: 0.26,
  },
  // No separate Sirens track yet: the sea plays the beach theme.
  sea: {
    file: 'assets/audio/beach-78e90c47be32.mp3',
    gain: 0.22,
  },
  // Composed in code (scripts/compose-music.py): a driving piece with sea swells for the strait.
  strait: {
    file: 'assets/audio/strait-84049ccca260.mp3',
    gain: 0.24,
  },
} as const;
