import {writeFile} from 'node:fs/promises';
import {STAGES} from '../src/levels/courses';
import {VARIANTS, getCourse} from '../src/levels/variants';
import {BOSS_COURSES} from '../src/levels/bosses';
const courses = STAGES.flatMap(stage => [
  ...VARIANTS.map(v => ({key: stage + '/' + v, course: getCourse(stage, v)})),
  {key: stage + '/boss', course: BOSS_COURSES[stage]},
]).map(({key, course}) => ({
  key,
  counts: {
    structures: course.obstacles.filter(o => o.role === 'structure').length,
    hazards: course.obstacles.filter(o => o.role === 'hazard').length,
    monsters: course.enemies.length,
    platforms: course.platforms.length,
  },
  objects: course.obstacles,
  monsters: course.enemies.map(e => ({...e, role: 'monster'})),
  platforms: course.platforms.map(p => ({...p, role: 'structure'})),
}));
await writeFile(
  'docs/contact-roles-manifest.json',
  JSON.stringify(
    {
      policy: {
        structures:
          'No HP loss, shield consumption, invincibility or hurt effects; retain existing ceiling/landing physics',
        hazards: 'Opaque visible contact only; shield or one HP, 1.2s invincibility; advance warning at 700px',
        monsters: 'Existing opaque contact and active-state rules',
        falls: 'One HP despite shield/invincibility; existing safe recovery and score IDs',
      },
      courses,
    },
    null,
    2,
  ) + '\n',
);
console.log('Contact roles recorded for', courses.length, 'courses');
