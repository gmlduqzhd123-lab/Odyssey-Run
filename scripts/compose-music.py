"""Composes every island theme from scratch, with numpy: the departure beach (a 6/8 sea
shanty), the Cyclops's cave (slow footfalls and dripping bells), the island of winds (fast 3/4
gusts and a soaring flute), the palace of Ithaca (a homecoming march with horns and choir),
Circe's island (a slow, mysterious waltz in a minor key over a soft drone), the strait (a
driving, tense piece with a rolling bass and sea swells) and the Sirens' sea (a lilting 6/8
song for a wordless choir over harp and slow waves). Nothing is sampled; every sound is a
sum of sine partials shaped by an envelope, so the files are original and free to use.

  pip install numpy
  python3 scripts/compose-music.py            # writes all seven: public/assets/audio/<island>-<hash>.mp3
  python3 scripts/compose-music.py sea        # one track only
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


def voice(freq, seconds, adsr, gain=1.0, vowel=(800, 1150, 2900)):
    """A wordless "ah": harmonics weighted by three vowel formants, with a slow singer's vibrato."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    wobble = 1 + 0.006 * np.sin(2 * np.pi * 5.0 * t + 0.6 * np.sin(2 * np.pi * 0.3 * t))
    out = np.zeros(n)
    for k in range(1, 24):
        f = freq * k
        if f > 6000:
            break
        amp = sum(np.exp(-((f - fc) / (90 + fc * 0.12)) ** 2) * w for fc, w in zip(vowel, (1.0, 0.6, 0.18)))
        out += (amp + 0.02 / k) * np.sin(2 * np.pi * f * wobble * t)
    return out * env(n, *adsr, seconds) * gain


def sea(seconds=96.0):
    """6/8 at 96 bpm (dotted-quarter beats) in D dorian: harp in rolling triplets, a two-part
    wordless choir singing the Sirens' call, a low drone and slow waves on the shore."""
    beat = 60 / 96  # one dotted quarter
    eighth = beat / 3
    bar = 2 * beat
    out = np.zeros(int(SR * seconds))
    # Chords (root semitones from A4): Dm, C, Bb (major), Am, Dm, G (major, dorian colour), C, Dm.
    cycle = [(-7, 'm'), (-9, 'M'), (-11, 'M'), (-12, 'm'), (-7, 'm'), (-14, 'M'), (-9, 'M'), (-7, 'm')]
    shapes = {'m': [0, 3, 7, 12, 15, 12], 'M': [0, 4, 7, 12, 16, 12]}
    bars = int(seconds / bar)
    for b in range(bars):
        root, q = cycle[b % len(cycle)]
        start = b * bar
        place(out, start, tone(hz(root - 12), bar * 1.1, PAD, (0.8, 0.4, 0.6, 0.6), gain=0.06))
        for i, st in enumerate(shapes[q]):
            place(out, start + i * eighth, tone(hz(root + st - 12), eighth * 3, HARP, (0.004, 0.3, 0.25, 0.3), gain=0.12))
        # Waves: a long hush rising and falling over two bars.
        if b % 2 == 0:
            n = int(SR * bar * 2)
            noise = np.random.default_rng(100 + b).standard_normal(n)
            y = np.zeros(n)
            for i in range(1, n):
                y[i] = y[i - 1] + 0.012 * (noise[i] - y[i - 1])
            place(out, start, y * env(n, bar, 0.1, 0.9, bar * 0.9, bar * 2) * 1.2)
    # The Sirens' call: a falling-then-rising phrase in D dorian, sung in thirds, every other cycle.
    phrase = [(5, 3), (3, 1), (1, 2), (0, 3), (-2, 3), (0, 2), (1, 1), (3, 3), (5, 6)]
    t = 2 * bar
    while t + 24 * eighth < seconds:
        for note, length in phrase:
            d = length * eighth
            place(out, t, voice(hz(note - 2), d * 1.15, (0.12, 0.2, 0.8, 0.3), gain=0.08))
            place(out, t, voice(hz(note - 5), d * 1.15, (0.14, 0.2, 0.8, 0.3), gain=0.05, vowel=(700, 1100, 2700)))
            t += d
        t += 6 * bar
    return out


HORN = [(1, 1.0), (2, 0.55), (3, 0.3), (4, 0.15), (5, 0.07)]
BELL = [(1, 1.0), (2.76, 0.4), (5.4, 0.18), (8.9, 0.06)]


def noise_hit(seconds, seed, cutoff=0.25, gain=1.0):
    """A short filtered noise burst: a drum skin or a splash."""
    n = int(SR * seconds)
    x = np.random.default_rng(seed).standard_normal(n)
    y = np.zeros(n)
    for i in range(1, n):
        y[i] = y[i - 1] + cutoff * (x[i] - y[i - 1])
    return y * np.exp(-np.linspace(0, 9, n)) * gain


def beach(seconds=96.0):
    """6/8 at 112 bpm in D major: a bright sea shanty for setting out. Plucked chords on the
    beat, a whistle melody, a bouncing bass and a light drum."""
    beat = 60 / 112
    eighth = beat / 3
    bar = 2 * beat
    out = np.zeros(int(SR * seconds))
    cycle = [(-7, 'M'), (-2, 'M'), (-7, 'M'), (-12, 'M'), (-7, 'M'), (-2, 'M'), (-12, 'M'), (-7, 'M')]
    shapes = {'M': [0, 4, 7], 'm': [0, 3, 7]}
    bars = int(seconds / bar)
    for b in range(bars):
        root, q = cycle[b % len(cycle)]
        start = b * bar
        for k in (0, 3):
            place(out, start + k * eighth, tone(hz(root - 24), eighth * 2.2, BASS, (0.004, 0.08, 0.4, 0.1), gain=0.15))
            place(out, start + (k + 2) * eighth, tone(hz(root - 17), eighth * 1.2, BASS, (0.004, 0.06, 0.3, 0.1), gain=0.08))
        for k in (1, 2, 4, 5):
            for st in shapes[q]:
                place(out, start + k * eighth, tone(hz(root + st - 12), eighth * 0.9, HARP, (0.003, 0.12, 0.2, 0.1), gain=0.045))
        place(out, start, noise_hit(0.12, b, 0.3, 0.35))
        place(out, start + beat, noise_hit(0.08, b + 500, 0.6, 0.18))
    # The whistle tune: a rising call answered by a falling one, every other cycle of eight bars.
    tune = [(2, 2), (4, 1), (5, 2), (7, 1), (9, 3), (7, 3), (5, 2), (4, 1), (2, 3), (0, 3),
            (2, 2), (4, 1), (5, 2), (4, 1), (2, 3), (-3, 3), (2, 6)]
    t = 2 * bar
    while t + 40 * eighth < seconds:
        for note, length in tune:
            place(out, t, tone(hz(note), length * eighth * 1.05, FLUTE, (0.02, 0.1, 0.75, 0.12), vibrato=0.005, gain=0.1))
            t += length * eighth
        t += 4 * bar
    return out


def cave(seconds=96.0):
    """4/4 at 76 bpm in E minor: the Cyclops's cave. A low drone, slow heavy drum steps like a
    giant's footfalls, dripping bells in the dark and a low horn line."""
    beat = 60 / 76
    bar = 4 * beat
    out = np.zeros(int(SR * seconds))
    roots = [-5, -5, -7, -9, -5, -5, -4, -9]  # E, E, D, C, E, E, F, C (from A4, low)
    bars = int(seconds / bar)
    rng = np.random.default_rng(7)
    for b in range(bars):
        root = roots[b % len(roots)]
        start = b * bar
        place(out, start, tone(hz(root - 24), bar * 1.05, PAD, (0.8, 0.5, 0.7, 0.6), gain=0.12))
        place(out, start, tone(hz(root - 12), bar * 1.05, PAD, (1.2, 0.5, 0.5, 0.6), gain=0.05))
        # Footfalls on beats 1 and 3: a deep thump.
        for k in (0, 2):
            place(out, start + k * beat, tone(hz(root - 36) * 2, 0.5, [(1, 1.0), (2, 0.3)], (0.002, 0.25, 0.0, 0.2), gain=0.35))
            place(out, start + k * beat, noise_hit(0.3, b * 4 + k, 0.05, 0.6))
        # Drips: two or three high bell notes at uneven places in the bar.
        for _ in range(rng.integers(2, 4)):
            at = start + rng.uniform(0, bar)
            note = root + 24 + int(rng.choice([0, 3, 7, 10, 12]))
            place(out, at, tone(hz(note), 1.2, BELL, (0.002, 0.4, 0.0, 0.6), gain=0.035))
    # A low horn line in the second half of each cycle.
    line = [(-5, 3), (-2, 1), (0, 2), (-2, 2), (-5, 4), (-7, 2), (-9, 2), (-5, 4)]
    t = 4 * bar
    while t + 20 * beat < seconds:
        for note, length in line:
            place(out, t, tone(hz(note - 12), length * beat, HORN, (0.25, 0.3, 0.7, 0.4), gain=0.07))
            t += length * beat
        t += 4 * bar
    return out


def wind(seconds=96.0):
    """3/4 at 132 bpm in G major: Aeolus's island of winds. Fast rising arpeggios like gusts, an
    airy flute tune soaring above, a soft pulse and rushing air."""
    beat = 60 / 132
    bar = 3 * beat
    out = np.zeros(int(SR * seconds))
    cycle = [(-2, 'M'), (-9, 'm'), (-14, 'M'), (-12, 'M'), (-2, 'M'), (-7, 'm'), (-12, 'M'), (-2, 'M')]
    shapes = {'M': [0, 4, 7, 12, 16, 19], 'm': [0, 3, 7, 12, 15, 19]}
    bars = int(seconds / bar)
    for b in range(bars):
        root, q = cycle[b % len(cycle)]
        start = b * bar
        place(out, start, tone(hz(root - 24), bar * 0.9, BASS, (0.01, 0.2, 0.4, 0.2), gain=0.12))
        for i, st in enumerate(shapes[q]):
            place(out, start + i * beat / 2, tone(hz(root + st - 12), beat * 0.8, HARP, (0.003, 0.15, 0.2, 0.2), gain=0.08))
        if b % 2 == 1:
            n = int(SR * bar * 2)
            x = np.random.default_rng(300 + b).standard_normal(n)
            y = np.zeros(n)
            for i in range(1, n):
                y[i] = y[i - 1] + 0.06 * (x[i] - y[i - 1])
            place(out, start, (y - np.convolve(y, np.ones(40) / 40, 'same')) * env(n, bar, 0.1, 0.9, bar, bar * 2) * 1.6)
    tune = [(-2, 3), (2, 2), (5, 1), (7, 3), (10, 2), (9, 1), (7, 3), (5, 3), (2, 2), (5, 1), (7, 6)]
    t = 2 * bar
    while t + 30 * beat < seconds:
        for note, length in tune:
            place(out, t, tone(hz(note + 12), length * beat, FLUTE, (0.04, 0.1, 0.75, 0.2), vibrato=0.006, gain=0.08))
            t += length * beat
        t += 4 * bar
    return out


def palace(seconds=96.0):
    """4/4 at 100 bpm in C major: the homecoming. A stately march with horns, a steady drum, warm
    chords and, in the second half of each cycle, the wordless choir from the Sirens' sea now
    singing in a major key."""
    beat = 60 / 100
    bar = 4 * beat
    out = np.zeros(int(SR * seconds))
    cycle = [(-9, 'M'), (-4, 'M'), (-7, 'm'), (-2, 'M'), (-9, 'M'), (-12, 'm'), (-2, 'M'), (-9, 'M')]
    shapes = {'M': [0, 4, 7, 12], 'm': [0, 3, 7, 12]}
    bars = int(seconds / bar)
    for b in range(bars):
        root, q = cycle[b % len(cycle)]
        start = b * bar
        for k in range(4):
            place(out, start + k * beat, tone(hz(root - 24 + (7 if k % 2 else 0)), beat * 0.9, BASS, (0.005, 0.1, 0.5, 0.15), gain=0.13))
        for st in shapes[q]:
            place(out, start, tone(hz(root + st - 12), bar * 1.02, PAD, (0.3, 0.4, 0.6, 0.4), gain=0.04))
        place(out, start, noise_hit(0.25, 700 + b, 0.12, 0.5))
        place(out, start + 2 * beat, noise_hit(0.25, 900 + b, 0.12, 0.4))
        place(out, start + 3.5 * beat, noise_hit(0.1, 1100 + b, 0.5, 0.15))
    fanfare = [(3, 2), (7, 1), (10, 1), (12, 4), (10, 2), (7, 2), (8, 3), (7, 1), (5, 4),
               (3, 2), (7, 2), (12, 2), (14, 2), (15, 6), (12, 2)]
    t = 2 * bar
    while t + 40 * beat < seconds:
        for note, length in fanfare:
            place(out, t, tone(hz(note - 12), length * beat * 0.95, HORN, (0.05, 0.2, 0.75, 0.2), vibrato=0.003, gain=0.08))
            t += length * beat
        for note, length in fanfare[:8]:
            place(out, t, voice(hz(note), length * beat * 1.1, (0.15, 0.2, 0.8, 0.3), gain=0.07))
            place(out, t, voice(hz(note - 4), length * beat * 1.1, (0.15, 0.2, 0.8, 0.3), gain=0.045, vowel=(700, 1100, 2700)))
            t += length * beat
        t += 2 * bar
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
    which = sys.argv[1:] or ['beach', 'cave', 'wind', 'circe', 'sea', 'strait', 'palace']
    if 'circe' in which:
        write('circe', master(circe(), 96))
    if 'strait' in which:
        write('strait', master(strait(), 96))
    if 'sea' in which:
        write('sea', master(sea(), 96))
    for name, make in (('beach', beach), ('cave', cave), ('wind', wind), ('palace', palace)):
        if name in which:
            write(name, master(make(), 96))
