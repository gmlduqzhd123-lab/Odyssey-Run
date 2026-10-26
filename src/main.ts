import './style.css';
import {App} from './ui/app';
const app=new App();
if(import.meta.hot)import.meta.hot.dispose(()=>app.destroy());

// 홈 화면 설치·오프라인 열기 (배포판에서만)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}
