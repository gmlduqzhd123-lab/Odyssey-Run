import './style.css';
import {App} from './ui/app';
const app = new App();
if (import.meta.hot) import.meta.hot.dispose(() => app.destroy());
