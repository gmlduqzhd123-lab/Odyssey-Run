"""Composes the two island themes the game has no recorded track for, from scratch, with numpy:
Circe's island (a slow, mysterious waltz in a minor key over a soft drone) and the strait (a
driving, tense piece with a rolling bass and sea swells). Nothing is sampled; every sound is a
sum of sine partials shaped by an envelope, so the files are original and free to use.

  pip install numpy
  python3 scripts/compose-music.py            # writes public/assets/audio/{circe,strait}-<hash>.mp3
Requires ffmpeg for the MP3 encoding step.
"""
import hashlib
import pathlib
import subprocess
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 44100
A4 = 440.0


def hz(note):
    """note: semitones from A4 (0), e.g. C5 = 3, A3 = -12."""
    return A4 * 2 ** (note / 12)


def env(n, attack, decay, sustain, release, total):
    t = np.linspace(0, total, n, endpoint=False)
    out = np.ones(n) * sustain
    a = t < attack
    out[a] = t[a] / max(attack, 1e-6)
    d = (t >= attack) & (t < attack + decay)
    out[d] = 1 - (1 - sustain) * (t[d] - attack) / max(decay, 1e-6)
    r = t > total - release
    out[r] *= np.clip((total - t[r]) / max(release, 1e-6), 0, 1)
    return out


def tone(freq, seconds, partials, adsr, vibrato=0.0, gain=1.0):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    wobble = 1 + vibrato * np.sin(2 * np.pi * 5.2 * t) if vibrato else 1
    out = np.zeros(n)
    for k, amp in partials:
        out += amp * np.sin(2 * np.pi * freq * k * wobble * t)
    return out * env(n, *adsr, seconds) * gain


def place(track, start, sound):
    i = int(start * SR)
    j = min(len(track), i + len(sound))
    if j > i:
        track[i:j] += sound[: j - i]


HARP = [(1, 1.0), (2, 0.35), (3, 0.18), (4, 0.08)]
FLUTE = [(1, 1.0), (2, 0.12), (3, 0.05)]
BASS = [(1, 1.0), (2, 0.5), (3, 0.22), (5, 0.06)]
PAD = [(1, 0.8), (2, 0.25), (3, 0.12), (4, 0.06)]


def circe(seconds=96.0):
    """3/4 at 84 bpm in A minor: harp arpeggios, a slow flute line, a humming drone."""
    bpm, beat = 84, 60 / 84
    bar = 3 * beat
    out = np.zeros(int(SR * seconds))
    # Chords (root semitones from A4, minor/major arpeggio shapes), eight bars per cycle.
    cycle = [(-12, 'm'), (-7, 'M'), (-9, 'm'), (-5, 'M'), (-12, 'm'), (-14, 'M'), (-7, 'M'), (-12, 'm')]
    shapes = {'m': [0, 3, 7, 12], 'M': [0, 4, 7, 12]}
    bars = int(seconds / bar)
    for b in range(bars):
        root, q = cycle[b % len(cycle)]
        start = b * bar
        # Drone: a soft pad two octaves down, retriggered gently each bar.
        place(out, start, tone(hz(root - 12), bar * 1.05, PAD, (0.6, 0.4, 0.5, 0.5), gain=0.08))
        # Harp: six notes per bar in a rising/falling arpeggio.
        steps = shapes[q] + [shapes[q][2], shapes[q][1]]
        for i, s in enumerate(steps):
            place(out, start + i * beat / 2, tone(hz(root + s), beat * 1.2, HARP, (0.005, 0.25, 0.3, 0.3), gain=0.14))
    # Flute melody: a slow phrase once every two cycles, in the A minor pentatonic.
    phrase = [(0, 2), (3, 1), (5, 1), (7, 2), (5, 1), (3, 1), (0, 3), (-2, 2), (0, 4)]
    t = 2 * bar
    while t + 12 * beat < seconds:
        for note, length in phrase:
            place(out, t, tone(hz(note), length * beat, FLUTE, (0.08, 0.2, 0.7, 0.25), vibrato=0.004, gain=0.11))
            t += length * beat
        t += 4 * bar
    return out


def strait(seconds=96.0):
    """4/4 at 132 bpm in D minor: a rolling eighth-note bass, stabbing chords, rising swells."""
    bpm, beat = 132, 60 / 132
    bar = 4 * beat
    out = np.zeros(int(SR * seconds))
    roots = [-7, -7, -4, -2, -7, -7, -9, -2]  # D, D, F, G, D, D, C, G (semitones from A4, low)
    bars = int(seconds / bar)
    for b in range(bars):
        root = roots[b % len(roots)]
        start = b * bar
        for i in range(8):
            n = root - 24 + (0 if i % 4 != 3 else 7)
            place(out, start + i * beat / 2, tone(hz(n), beat * 0.55, BASS, (0.004, 0.08, 0.5, 0.1), gain=0.16))
        # Chord stabs on beats 2 and 4 (minor triad, a touch detuned for width).
        for i in (1, 3):
            for s, det in ((0, 0.0), (3, 0.002), (7, -0.002), (12, 0.001)):
                place(
                    out,
                    start + i * beat,
                    tone(hz(root + s) * (1 + det), beat * 0.6, PAD, (0.01, 0.15, 0.35, 0.2), gain=0.05),
                )
        # Every fourth bar a swell: filtered noise rising, like a wave breaking on the rocks.
        if b % 4 == 3:
            n = int(SR * bar)
            noise = np.random.default_rng(b).standard_normal(n)
            # One-pole low-pass for a deep hush.
            y = np.zeros(n)
            a = 0.02
            for i in range(1, n):
                y[i] = y[i - 1] + a * (noise[i] - y[i - 1])
            place(out, start, y * env(n, bar * 0.7, 0.1, 0.9, bar * 0.3, bar) * 0.9)
    # A high ostinato (two notes) over the second half of each 8-bar cycle: the lookout's alarm.
    for b in range(bars):
        if b % 8 >= 4:
            start = b * bar
            for i in range(4):
                n = 10 if i % 2 == 0 else 8
                place(out, start + i * beat, tone(hz(n), beat * 0.5, FLUTE, (0.01, 0.1, 0.5, 0.1), gain=0.06))
    return out


def master(x, seconds):
    n = int(SR * seconds)
    x = x[:n]
    # Fade in/out so the loop point is quiet, soft-clip, normalise.
    fade = int(SR * 1.5)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    x = np.tanh(x * 1.4)
    return x / max(1e-6, np.abs(x).max()) * 0.9


def write(name, data):
    raw = (data * 32767).astype('<i2').tobytes()
    tmp = ROOT / 'public' / 'assets' / 'audio' / f'{name}.tmp.mp3'
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', 'pipe:0', '-b:a', '96k', str(tmp)],
        input=raw,
        check=True,
    )
    digest = hashlib.sha256(tmp.read_bytes()).hexdigest()[:12]
    final = tmp.with_name(f'{name}-{digest}.mp3')
    for old in tmp.parent.glob(f'{name}-*.mp3'):
        old.unlink()
    tmp.rename(final)
    print(final.relative_to(ROOT), final.stat().st_size)
    return final


if __name__ == '__main__':
    which = sys.argv[1:] or ['circe', 'strait']
    if 'circe' in which:
        write('circe', master(circe(), 96))
    if 'strait' in which:
        write('strait', master(strait(), 96))
