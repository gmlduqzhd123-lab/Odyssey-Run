// Builds the school setup guide (public/school-setup*.html) in every game language from one
// template. Run after changing the text: npx tsx scripts/school-setup.ts (a unit test fails while
// the pages on disk differ from this source).
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const GAME = 'https://gmlduqzhd123-lab.github.io/Odyssey-Run/';
const POLICY = `[{"url": "${GAME}", "default_launch_container": "window", "create_desktop_shortcut": true}]`;
type Text = {
  lang: string;
  name: string;
  title: string;
  back: string;
  h1: string;
  intro: string;
  shareH: string;
  qrAlt: string;
  shareP: string;
  shareText: string;
  shareLabel: string;
  shareNote: string;
  cbH: string;
  cbP: string;
  cbSteps: string[];
  cbNote: string;
  winH: string;
  winP: string;
  winLabel: string;
  winNote: string;
  eachH: string;
  each: string[];
  eachNote: string;
  wifiH: string;
  wifi: string[];
  wifiNote: string;
};
export const PAGES: Record<string, Text> = {
  ko: {
    lang: 'ko',
    name: '한국어',
    title: '오디세이 런 · 학교 기기에 설치하기',
    back: '← 게임으로 돌아가기',
    h1: '학교 기기에 한꺼번에 설치하기',
    intro:
      '오디세이 런은 설치 파일 없이 웹 주소 하나로 열려요. 계정·서버가 없고, 기록은 각 기기의 브라우저에만 저장돼요. 아래 방법 중 학교 환경에 맞는 것을 고르세요.',
    shareH: '1. 학생에게 주소 나눠 주기',
    qrAlt: '오디세이 런 주소 QR 코드',
    shareP:
      '교실 화면에 이 QR을 띄우거나, 아래 문구를 그대로 복사해 패들렛·구글 클래스룸·밴드·하이클래스에 올려 주세요.',
    shareText: '🏝️ 오디세이 런: 이타카로!\n오디세우스와 네 개의 섬을 달려요. 로그인 없이 바로 시작!',
    shareLabel: '공유 문구',
    shareNote: '게임 안 홈 화면의 QR 버튼으로도 큰 QR을 띄울 수 있어요.',
    cbH: '2. 크롬북: 관리 콘솔에서 강제 설치',
    cbP: '학교 크롬북을 Google 관리 콘솔로 관리한다면, 담당 선생님이 한 번 설정해 모든 크롬북 선반(작업 표시줄)에 앱을 넣을 수 있어요.',
    cbSteps: [
      '<b>admin.google.com</b> → <b>기기</b> → <b>Chrome</b> → <b>앱 및 확장 프로그램</b> → <b>사용자 및 브라우저</b>',
      '왼쪽에서 학생 <b>조직 단위</b>를 고르세요.',
      '오른쪽 아래 <b>＋</b> → <b>URL로 추가</b>(웹 앱 추가)를 누르고 주소를 넣으세요.',
      '설치 정책을 <b>강제 설치</b> 또는 <b>강제 설치 + ChromeOS 작업 표시줄에 고정</b>으로 고르고 저장하세요.',
    ],
    cbNote:
      '메뉴 이름은 관리 콘솔 버전에 따라 조금 다를 수 있어요. 적용까지 몇 분에서 하루가 걸릴 수 있고, 학생이 크롬북에 다시 로그인하면 빨리 반영돼요.',
    winH: '3. 윈도우 노트북 (크롬·엣지)',
    winP: '그룹 정책이나 인튠(Intune)으로 관리한다면 <code>WebAppInstallForceList</code> 정책에 아래 값을 넣으면 크롬·엣지에 앱이 자동으로 설치돼요.',
    winLabel: 'WebAppInstallForceList 정책 값',
    winNote:
      '웨일 브라우저를 쓰는 학교는 웨일 관리 도구의 웹 앱 배포 기능을 확인해 주세요. 관리 도구가 없다면 4번처럼 기기마다 설치해도 돼요.',
    eachH: '4. 기기마다 직접 설치 (1분)',
    each: [
      '<b>크롬·엣지·웨일 (PC·크롬북·안드로이드)</b>: 게임 주소를 열고 주소창 오른쪽의 설치 아이콘, 또는 메뉴 → <b>앱 설치</b>(홈 화면에 추가)를 누르세요.',
      '<b>아이패드·아이폰</b>: 사파리로 열고 <b>공유</b> → <b>홈 화면에 추가</b>. 학교 MDM을 쓴다면 같은 주소로 <b>웹 클립</b>을 배포할 수 있어요.',
    ],
    eachNote: '설치하면 화면이 꽉 차고, 브라우저가 오래 쓰지 않은 사이트의 기록을 지우는 일도 줄어요.',
    wifiH: '5. 와이파이가 약한 교실이라면',
    wifi: [
      '수업 전에 각 기기에서 <b>설정 → 섬 다운로드·업데이트</b>를 한 번 눌러 두면, 인터넷이 끊겨도 네 개의 섬을 모두 달릴 수 있어요.',
      '한 기기를 여러 학생이 함께 쓴다면 <b>항해사 → 번호로 한 번에 만들기</b>로 1번~30번 항해사를 만들어 두세요. 학생은 자기 번호를 골라 시작해요.',
    ],
    wifiNote: '기록은 기기 밖으로 나가지 않아요. 기기를 초기화하기 전에는 설정 → 반 전체 내보내기로 백업해 주세요.',
  },
  en: {
    lang: 'en',
    name: 'English',
    title: 'Odyssey Run · Install on school devices',
    back: '← Back to the game',
    h1: 'Install on all school devices',
    intro:
      'Odyssey Run opens from one web address, with nothing to download. There are no accounts or servers; records stay in each device’s browser. Pick the way that fits your school.',
    shareH: '1. Share the address with students',
    qrAlt: 'QR code for the Odyssey Run address',
    shareP:
      'Show this QR on the classroom screen, or copy the text below to Padlet, Google Classroom or your class app.',
    shareText: '🏝️ Odyssey Run: Road to Ithaca!\nRun four islands with Odysseus. No sign-in, just start!',
    shareLabel: 'Text to share',
    shareNote: 'The QR button on the game’s home screen also shows a large QR.',
    cbH: '2. Chromebooks: force-install from the Admin console',
    cbP: 'If your Chromebooks are managed in the Google Admin console, one setting puts the app on every Chromebook shelf.',
    cbSteps: [
      '<b>admin.google.com</b> → <b>Devices</b> → <b>Chrome</b> → <b>Apps &amp; extensions</b> → <b>Users &amp; browsers</b>',
      'Choose the students’ <b>organizational unit</b> on the left.',
      'Press <b>+</b> at the bottom right → <b>Add by URL</b> (web app) and enter the address.',
      'Set the installation policy to <b>Force install</b> or <b>Force install + pin to ChromeOS taskbar</b> and save.',
    ],
    cbNote:
      'Menu names can differ slightly between console versions. It may take minutes to a day to apply; signing in again on the Chromebook speeds it up.',
    winH: '3. Windows laptops (Chrome, Edge)',
    winP: 'With Group Policy or Intune, put the value below in the <code>WebAppInstallForceList</code> policy and Chrome or Edge installs the app automatically.',
    winLabel: 'WebAppInstallForceList policy value',
    winNote: 'Without a management tool, install on each device as in step 4.',
    eachH: '4. Install on each device (1 minute)',
    each: [
      '<b>Chrome, Edge, Whale (PC, Chromebook, Android)</b>: open the game and press the install icon at the right of the address bar, or menu → <b>Install app</b> (Add to Home screen).',
      '<b>iPad, iPhone</b>: open in Safari, then <b>Share</b> → <b>Add to Home Screen</b>. With an MDM you can deploy a <b>web clip</b> with the same address.',
    ],
    eachNote:
      'Installed, the game fills the screen, and the browser is less likely to clear records of a site not used for a while.',
    wifiH: '5. Classrooms with weak Wi-Fi',
    wifi: [
      'Before class, press <b>Settings → Island downloads &amp; updates</b> once on each device; all four islands then run without internet.',
      'When students share a device, use <b>Sailors → Create numbered sailors at once</b> to make No. 1 to No. 30. Each student picks their own number.',
    ],
    wifiNote: 'Records never leave the device. Before resetting a device, back up with Settings → Export whole class.',
  },
  vi: {
    lang: 'vi',
    name: 'Tiếng Việt',
    title: 'Odyssey Run · Cài cho thiết bị của trường',
    back: '← Quay lại trò chơi',
    h1: 'Cài cho mọi thiết bị của trường',
    intro:
      'Odyssey Run mở bằng một địa chỉ web, không cần tải tệp cài đặt. Không có tài khoản hay máy chủ; kết quả chỉ lưu trong trình duyệt của từng thiết bị. Hãy chọn cách phù hợp với trường.',
    shareH: '1. Chia sẻ địa chỉ cho học sinh',
    qrAlt: 'Mã QR địa chỉ Odyssey Run',
    shareP:
      'Chiếu mã QR này lên màn hình lớp, hoặc sao chép đoạn chữ dưới đây vào Padlet, Google Classroom hay ứng dụng của lớp.',
    shareText: '🏝️ Odyssey Run: Về Ithaca!\nChạy qua bốn hòn đảo cùng Odysseus. Không cần đăng nhập, bắt đầu ngay!',
    shareLabel: 'Đoạn chữ để chia sẻ',
    shareNote: 'Nút QR trên màn hình chính của trò chơi cũng hiện mã QR lớn.',
    cbH: '2. Chromebook: cài bắt buộc từ Bảng điều khiển quản trị',
    cbP: 'Nếu Chromebook của trường được quản lý bằng Google Admin, chỉ một lần cài đặt là ứng dụng có mặt trên mọi Chromebook.',
    cbSteps: [
      '<b>admin.google.com</b> → <b>Thiết bị</b> → <b>Chrome</b> → <b>Ứng dụng và tiện ích</b> → <b>Người dùng và trình duyệt</b>',
      'Chọn <b>đơn vị tổ chức</b> của học sinh ở bên trái.',
      'Nhấn <b>+</b> ở góc dưới bên phải → <b>Thêm bằng URL</b> (ứng dụng web) và nhập địa chỉ.',
      'Chọn chính sách cài đặt <b>Bắt buộc cài đặt</b> hoặc <b>Bắt buộc cài đặt + ghim vào thanh tác vụ ChromeOS</b> rồi lưu.',
    ],
    cbNote:
      'Tên menu có thể hơi khác tùy phiên bản. Việc áp dụng có thể mất từ vài phút đến một ngày; đăng nhập lại Chromebook sẽ nhanh hơn.',
    winH: '3. Máy tính Windows (Chrome, Edge)',
    winP: 'Nếu dùng Group Policy hoặc Intune, hãy đặt giá trị dưới đây vào chính sách <code>WebAppInstallForceList</code>, Chrome hoặc Edge sẽ tự cài ứng dụng.',
    winLabel: 'Giá trị chính sách WebAppInstallForceList',
    winNote: 'Nếu không có công cụ quản lý, hãy cài trên từng thiết bị như bước 4.',
    eachH: '4. Cài trên từng thiết bị (1 phút)',
    each: [
      '<b>Chrome, Edge, Whale (PC, Chromebook, Android)</b>: mở trò chơi, nhấn biểu tượng cài đặt bên phải thanh địa chỉ, hoặc menu → <b>Cài đặt ứng dụng</b> (Thêm vào màn hình chính).',
      '<b>iPad, iPhone</b>: mở bằng Safari, chọn <b>Chia sẻ</b> → <b>Thêm vào MH chính</b>. Nếu trường dùng MDM, có thể phát <b>web clip</b> với cùng địa chỉ.',
    ],
    eachNote: 'Khi đã cài, trò chơi lấp đầy màn hình và trình duyệt ít xóa kết quả của trang lâu không dùng hơn.',
    wifiH: '5. Lớp học có Wi-Fi yếu',
    wifi: [
      'Trước giờ học, nhấn <b>Cài đặt → Tải về &amp; cập nhật đảo</b> một lần trên mỗi thiết bị; cả bốn đảo sẽ chạy được khi không có mạng.',
      'Khi nhiều học sinh dùng chung thiết bị, hãy dùng <b>Thủy thủ → Tạo thủy thủ theo số cùng lúc</b> để tạo Số 1 đến Số 30. Mỗi học sinh chọn số của mình.',
    ],
    wifiNote: 'Kết quả không rời khỏi thiết bị. Trước khi đặt lại thiết bị, hãy sao lưu bằng Cài đặt → Xuất cả lớp.',
  },
  zh: {
    lang: 'zh-Hans',
    name: '中文',
    title: 'Odyssey Run · 在学校设备上安装',
    back: '← 返回游戏',
    h1: '在学校所有设备上安装',
    intro:
      'Odyssey Run 只需一个网址即可打开，无需下载安装包。没有账号和服务器，记录只保存在每台设备的浏览器里。请选择适合学校的方式。',
    shareH: '1. 把网址分享给学生',
    qrAlt: 'Odyssey Run 网址二维码',
    shareP: '在教室屏幕上显示这个二维码，或把下面的文字复制到 Padlet、Google Classroom 或班级应用里。',
    shareText: '🏝️ Odyssey Run：回到伊萨卡！\n和奥德修斯一起跑过四座岛屿。无需登录，马上开始！',
    shareLabel: '分享文字',
    shareNote: '游戏主页上的二维码按钮也能显示大二维码。',
    cbH: '2. Chromebook：在管理控制台强制安装',
    cbP: '如果学校的 Chromebook 由 Google 管理控制台管理，只需设置一次，所有 Chromebook 的任务栏上都会出现这个应用。',
    cbSteps: [
      '<b>admin.google.com</b> → <b>设备</b> → <b>Chrome</b> → <b>应用和扩展程序</b> → <b>用户和浏览器</b>',
      '在左侧选择学生的<b>组织部门</b>。',
      '点右下角的 <b>+</b> → <b>通过网址添加</b>（网页应用），输入网址。',
      '把安装政策设为<b>强制安装</b>或<b>强制安装并固定到 ChromeOS 任务栏</b>，然后保存。',
    ],
    cbNote: '菜单名称可能因控制台版本略有不同。生效可能需要几分钟到一天；学生重新登录 Chromebook 会更快生效。',
    winH: '3. Windows 笔记本（Chrome、Edge）',
    winP: '如果使用组策略或 Intune，把下面的值填入 <code>WebAppInstallForceList</code> 政策，Chrome 或 Edge 会自动安装应用。',
    winLabel: 'WebAppInstallForceList 政策值',
    winNote: '没有管理工具时，可以按第 4 步在每台设备上安装。',
    eachH: '4. 在每台设备上安装（1 分钟）',
    each: [
      '<b>Chrome、Edge、Whale（电脑、Chromebook、安卓）</b>：打开游戏，点地址栏右侧的安装图标，或菜单 → <b>安装应用</b>（添加到主屏幕）。',
      '<b>iPad、iPhone</b>：用 Safari 打开，点<b>分享</b> → <b>添加到主屏幕</b>。如果学校使用 MDM，可以用同一网址分发<b>网页快捷方式</b>。',
    ],
    eachNote: '安装后游戏会铺满屏幕，浏览器也更少清除长时间未使用网站的记录。',
    wifiH: '5. Wi-Fi 信号弱的教室',
    wifi: [
      '上课前在每台设备上点一次<b>设置 → 岛屿下载与更新</b>，断网时也能跑完四座岛。',
      '多名学生共用一台设备时，用<b>航海家 → 一次创建编号航海家</b>创建 1号到 30号。学生选自己的编号开始。',
    ],
    wifiNote: '记录不会离开设备。重置设备前，请用 设置 → 导出全班 进行备份。',
  },
  ru: {
    lang: 'ru',
    name: 'Русский',
    title: 'Odyssey Run · Установка на школьные устройства',
    back: '← Вернуться к игре',
    h1: 'Установить на все школьные устройства',
    intro:
      'Odyssey Run открывается по одному веб-адресу, ничего скачивать не нужно. Нет аккаунтов и серверов: результаты хранятся только в браузере каждого устройства. Выберите подходящий для школы способ.',
    shareH: '1. Поделитесь адресом с учениками',
    qrAlt: 'QR-код адреса Odyssey Run',
    shareP:
      'Покажите этот QR-код на экране класса или скопируйте текст ниже в Padlet, Google Classroom или приложение класса.',
    shareText: '🏝️ Odyssey Run: Путь на Итаку!\nПробеги четыре острова вместе с Одиссеем. Без входа — просто начни!',
    shareLabel: 'Текст для отправки',
    shareNote: 'Кнопка QR на главном экране игры тоже показывает большой QR-код.',
    cbH: '2. Chromebook: принудительная установка из консоли администратора',
    cbP: 'Если школьные Chromebook управляются через консоль администратора Google, одна настройка добавит приложение на панель каждого Chromebook.',
    cbSteps: [
      '<b>admin.google.com</b> → <b>Устройства</b> → <b>Chrome</b> → <b>Приложения и расширения</b> → <b>Пользователи и браузеры</b>',
      'Слева выберите <b>организационное подразделение</b> учеников.',
      'Нажмите <b>+</b> внизу справа → <b>Добавить по URL</b> (веб-приложение) и введите адрес.',
      'Выберите правило <b>Принудительная установка</b> или <b>Принудительная установка и закрепление на панели ChromeOS</b> и сохраните.',
    ],
    cbNote:
      'Названия меню могут немного отличаться в разных версиях консоли. Применение занимает от нескольких минут до суток; повторный вход в Chromebook ускоряет его.',
    winH: '3. Ноутбуки с Windows (Chrome, Edge)',
    winP: 'При управлении через групповую политику или Intune укажите значение ниже в политике <code>WebAppInstallForceList</code>, и Chrome или Edge установит приложение сам.',
    winLabel: 'Значение политики WebAppInstallForceList',
    winNote: 'Без средств управления установите игру на каждом устройстве, как в шаге 4.',
    eachH: '4. Установка на каждом устройстве (1 минута)',
    each: [
      '<b>Chrome, Edge, Whale (ПК, Chromebook, Android)</b>: откройте игру и нажмите значок установки справа в адресной строке или меню → <b>Установить приложение</b> (Добавить на главный экран).',
      '<b>iPad, iPhone</b>: откройте в Safari, затем <b>Поделиться</b> → <b>На экран «Домой»</b>. С MDM можно разослать <b>веб-клип</b> с тем же адресом.',
    ],
    eachNote:
      'Установленная игра занимает весь экран, а браузер реже стирает результаты сайта, которым давно не пользовались.',
    wifiH: '5. Если в классе слабый Wi-Fi',
    wifi: [
      'Перед уроком один раз нажмите на каждом устройстве <b>Настройки → Загрузка и обновление островов</b>: все четыре острова будут работать без интернета.',
      'Если устройство общее, создайте мореходов № 1 — № 30 через <b>Мореходы → Создать нумерованных мореходов сразу</b>. Каждый ученик выбирает свой номер.',
    ],
    wifiNote:
      'Результаты не покидают устройство. Перед сбросом устройства сделайте копию: Настройки → Сохранить весь класс.',
  },
};
export const pageFile = (id: string) => (id === 'ko' ? 'school-setup.html' : `school-setup.${id}.html`);
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function render(id: string) {
  const t = PAGES[id],
    langs = Object.entries(PAGES)
      .map(([k, p]) =>
        k === id ? `<b lang="${p.lang}">${p.name}</b>` : `<a href="./${pageFile(k)}" lang="${p.lang}">${p.name}</a>`,
      )
      .join(' · ');
  return `<!doctype html>
<!-- Generated by scripts/school-setup.ts; edit that file, then run: npx tsx scripts/school-setup.ts -->
<html lang="${t.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<title>${t.title}</title>
<link rel="icon" href="./icons/icon-192.png" type="image/png">
<style>
  :root { color-scheme: light; --ink: #1d2b2a; --sea: #274e58; --paper: #f6f0de; --line: #d7c9aa; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink); font: 16px/1.65 system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
  main { max-width: 820px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 1.7rem; line-height: 1.3; margin: 0.2em 0 0.3em; color: var(--sea); }
  h2 { font-size: 1.2rem; margin: 1.8em 0 0.4em; color: var(--sea); }
  section { background: #fffaf0; border: 1px solid var(--line); border-radius: 14px; padding: 4px 18px 14px; margin-top: 14px; }
  ol, ul { padding-left: 1.3em; }
  li + li { margin-top: 0.3em; }
  code, .copy { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.95em; background: #efe6cf; border-radius: 6px; padding: 1px 5px; word-break: break-all; }
  .copy { display: block; width: 100%; padding: 10px 12px; border: 1px solid var(--line); background: #fff; color: var(--ink); resize: vertical; font-family: inherit; line-height: 1.6; }
  .share { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; }
  .share img { width: 180px; height: 180px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 8px; image-rendering: pixelated; }
  .share div { flex: 1 1 280px; }
  .muted { color: #46514f; font-size: 0.93rem; }
  .langs { font-size: 0.93rem; margin: 8px 0 0; }
  a { color: #8a3f22; }
  .back { display: inline-block; margin-top: 8px; font-weight: 700; }
  @media (prefers-contrast: more) { .muted { color: var(--ink); } section { border-color: var(--ink); } }
</style>
</head>
<body>
<main>
  <a class="back" href="./">${t.back}</a>
  <p class="langs">${langs}</p>
  <h1>${t.h1}</h1>
  <p>${t.intro}</p>

  <section>
    <h2>${t.shareH}</h2>
    <div class="share">
      <img src="./qr.svg" alt="${t.qrAlt}" width="180" height="180">
      <div>
        <p>${t.shareP}</p>
        <textarea class="copy" rows="4" readonly aria-label="${t.shareLabel}">${esc(t.shareText)}
${GAME}</textarea>
        <p class="muted">${t.shareNote}</p>
      </div>
    </div>
  </section>

  <section>
    <h2>${t.cbH}</h2>
    <p>${t.cbP}</p>
    <ol>
${t.cbSteps.map((s, i) => `      <li>${s}${i === 2 ? `<br><code>${GAME}</code>` : ''}</li>`).join('\n')}
    </ol>
    <p class="muted">${t.cbNote}</p>
  </section>

  <section>
    <h2>${t.winH}</h2>
    <p>${t.winP}</p>
    <textarea class="copy" rows="3" readonly aria-label="${t.winLabel}">${esc(POLICY)}</textarea>
    <p class="muted">${t.winNote}</p>
  </section>

  <section>
    <h2>${t.eachH}</h2>
    <ul>
${t.each.map(s => `      <li>${s}</li>`).join('\n')}
    </ul>
    <p class="muted">${t.eachNote}</p>
  </section>

  <section>
    <h2>${t.wifiH}</h2>
${t.wifi.map(s => `    <p>${s}</p>`).join('\n')}
    <p class="muted">${t.wifiNote}</p>
  </section>
</main>
</body>
</html>
`;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
  for (const id of Object.keys(PAGES)) {
    await writeFile(`public/${pageFile(id)}`, render(id));
    console.log(`public/${pageFile(id)}`);
  }
