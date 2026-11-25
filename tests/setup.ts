// Runs before every test file: the contact outlines and quiz text the app loads before a run.
import {CONTACT_MASKS} from '../src/assets/contact-masks';
import {useContactMasks} from '../src/systems/contact';
useContactMasks(CONTACT_MASKS);
import {QUIZ} from '../src/levels/quiz-text';
import {useQuizText} from '../src/levels/quiz';
useQuizText(QUIZ);
