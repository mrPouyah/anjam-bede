const $ = id => document.getElementById(id);
const formatFa = new Intl.NumberFormat('fa-IR', { useGrouping: false });
const dateLong = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: 'long', day: 'numeric' });
const dateDay = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' });
const weekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long' });
const gregorian = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { year: 'numeric', month: 'long', day: 'numeric' });
const numericPersian = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });

const ui = {
  gregorianDate: $('gregorianDate'), greeting: $('greeting'), weekday: $('weekday'), persianDate: $('persianDate'),
  week: $('week'), taskList: $('taskList'), taskCount: $('taskCount'), emptyState: $('emptyState'),
  progressLabel: $('progressLabel'), progressPercent: $('progressPercent'), progressBar: $('progressBar'),
  dialog: $('taskDialog'), form: $('taskForm'), taskTitle: $('taskTitle'), taskDate: $('taskDate'),
  taskTime: $('taskTime'), taskNote: $('taskNote'), toast: $('toast'),
  notificationButton: $('notificationButton'), notificationStatus: $('notificationStatus'),
  notificationCard: $('notificationCard'), enableNotifications: $('enableNotifications'),
  cardNotificationStatus: $('cardNotificationStatus'), falButton: $('falButton'),
  falDialog: $('falDialog'), falTitle: $('falTitle'), falLoading: $('falLoading'),
  falContent: $('falContent'), falVerses: $('falVerses'), falReading: $('falReading'), falSource: $('falSource')
};

let selectedDate = atMidnight(new Date());
let tasks = readTasks();
let sentNotifications = readNotificationLog();
let falState = readFalState();

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HAFEZ_GHAZAL_COUNT = 495;
const FAL_READINGS = [
  'راهی که در دل داری روشن است، اما شتاب نکن. با آرامش و اعتماد قدم بردار؛ گشایش از جایی می‌رسد که انتظارش را نداری.',
  'این فال از امید پس از دشواری می‌گوید. دل را از نگرانی خالی کن و به کاری که آغاز کرده‌ای وفادار بمان.',
  'نشانهٔ دیدار، خبر خوش و برآورده‌شدن نیتی دیرینه است. نیتت پاک است؛ صبر و صداقت همراهت باشند.',
  'اکنون زمان سبک‌کردن دل از گذشته است. آنچه سهم تو باشد راهش را پیدا می‌کند؛ بر امروز و توان خودت تکیه کن.',
  'فرصتی تازه در پیش است. ظاهر اتفاق‌ها را معیار قرار نده و پیش از تصمیم مهم، ندای آرام درونت را بشنو.',
  'فال تو از پایداری سخن می‌گوید. موانع ماندگار نیستند و نتیجهٔ کوشش پیوسته به‌زودی آشکار می‌شود.',
  'محبت و گفت‌وگوی روشن گرهی قدیمی را باز می‌کند. غرور را کنار بگذار، اما ارزش خودت را فراموش نکن.',
  'نیتت خیر است و بخت با حرکت همراه می‌شود. منتظر نشانهٔ کامل نباش؛ یک قدم کوچک، مسیر را نمایان می‌کند.'
];

const FALLBACK_FALS = [
  { id: 'local-1', title: 'غزل شمارهٔ ۱', verses: ['الا یا ایها الساقی ادر کأساً و ناولها', 'که عشق آسان نمود اول ولی افتاد مشکل‌ها', 'به بوی نافه‌ای کآخر صبا زان طره بگشاید', 'ز تاب جعد مشکینش چه خون افتاد در دل‌ها'] },
  { id: 'local-2', title: 'غزل شمارهٔ ۳', verses: ['اگر آن ترک شیرازی به دست آرد دل ما را', 'به خال هندویش بخشم سمرقند و بخارا را', 'بده ساقی می باقی که در جنت نخواهی یافت', 'کنار آب رکن‌آباد و گلگشت مصلا را'] },
  { id: 'local-3', title: 'غزل شمارهٔ ۵', verses: ['دل می‌رود ز دستم صاحبدلان خدا را', 'دردا که راز پنهان خواهد شد آشکارا', 'کشتی‌شکستگانیم ای باد شرطه برخیز', 'باشد که بازبینیم دیدار آشنا را'] },
  { id: 'local-4', title: 'غزل شمارهٔ ۸', verses: ['ساقیا برخیز و درده جام را', 'خاک بر سر کن غم ایام را', 'ساغر می بر کفم نه تا ز بر', 'برکشم این دلق ازرق‌فام را'] },
  { id: 'local-5', title: 'غزل شمارهٔ ۱۰', verses: ['دوش از مسجد سوی میخانه آمد پیر ما', 'چیست یاران طریقت بعد از این تدبیر ما', 'ما مریدان روی سوی قبله چون آریم چون', 'روی سوی خانه خمار دارد پیر ما'] },
  { id: 'local-6', title: 'غزل شمارهٔ ۲۲', verses: ['چو بشنوی سخن اهل دل مگو که خطاست', 'سخن‌شناس نه‌ای جان من خطا اینجاست', 'سرم به دنیی و عقبی فرو نمی‌آید', 'تبارک‌الله از این فتنه‌ها که در سر ماست'] },
  { id: 'local-7', title: 'غزل شمارهٔ ۱۴۳', verses: ['سال‌ها دل طلب جام جم از ما می‌کرد', 'وان چه خود داشت ز بیگانه تمنا می‌کرد', 'گوهری کز صدف کون و مکان بیرون است', 'طلب از گمشدگان لب دریا می‌کرد'] },
  { id: 'local-8', title: 'غزل شمارهٔ ۱۸۴', verses: ['دوش دیدم که ملائک در میخانه زدند', 'گل آدم بسرشتند و به پیمانه زدند', 'ساکنان حرم ستر و عفاف ملکوت', 'با من راه‌نشین باده مستانه زدند'] }
];

function atMidnight(value) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function plusDays(value, amount) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return atMidnight(result);
}

function isSameDay(a, b) { return atMidnight(a).getTime() === atMidnight(b).getTime(); }

// Local calendar key avoids UTC changing the selected date around midnight in Iran.
function dateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toPersianDigits(value) {
  return String(value).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[digit]);
}

function toEnglishDigits(value) {
  return String(value).replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit));
}

function numericJalali(value) {
  const values = Object.fromEntries(
    numericPersian.formatToParts(value)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  return toPersianDigits(`${values.year}/${values.month}/${values.day}`);
}

function readTasks() {
  try { return JSON.parse(localStorage.getItem('emrooz.tasks.v1') || '[]'); }
  catch { return []; }
}

function readNotificationLog() {
  try { return JSON.parse(localStorage.getItem('emrooz.notifications.v1') || '{}'); }
  catch { return {}; }
}

function readFalState() {
  try {
    return JSON.parse(localStorage.getItem('emrooz.fal.v1')) || { lastShownAt: 0, current: null, usedIds: [], fallbackUsed: [] };
  } catch {
    return { lastShownAt: 0, current: null, usedIds: [], fallbackUsed: [] };
  }
}

function persistFalState() {
  localStorage.setItem('emrooz.fal.v1', JSON.stringify(falState));
}

function persist() {
  localStorage.setItem('emrooz.tasks.v1', JSON.stringify(tasks));
  syncNativeTasks();
}

function syncNativeTasks() {
  try {
    if (window.AndroidNotifications?.syncTasks) {
      window.AndroidNotifications.syncTasks(JSON.stringify(tasks));
    }
  } catch { /* The browser preview has no Android bridge. */ }
}

function persistNotificationLog() {
  localStorage.setItem('emrooz.notifications.v1', JSON.stringify(sentNotifications));
}

function notificationsEnabled() {
  return 'Notification' in window && Notification.permission === 'granted';
}

function renderNotificationState() {
  const supported = 'Notification' in window;
  const enabled = notificationsEnabled();
  ui.notificationButton.classList.toggle('enabled', enabled);
  ui.notificationCard.classList.toggle('enabled', enabled);
  ui.notificationStatus.textContent = enabled ? 'اعلان‌ها روشن' : supported ? 'اعلان‌ها خاموش' : 'پشتیبانی نمی‌شود';
  ui.cardNotificationStatus.textContent = enabled ? 'روشن' : 'خاموش';
  ui.enableNotifications.textContent = enabled ? 'فعال است' : supported && Notification.permission === 'denied' ? 'مسدود شده' : 'فعال‌سازی';
  ui.enableNotifications.disabled = !supported || enabled;
}

function greetingFor(hour) {
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'ظهر بخیر';
  return 'عصر بخیر';
}

function shortWeekday(value) {
  const labels = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  return labels[(value.getDay() + 1) % 7];
}

function renderWeek() {
  const saturdayOffset = (selectedDate.getDay() + 1) % 7;
  const saturday = plusDays(selectedDate, -saturdayOffset);
  ui.week.replaceChildren();

  for (let index = 0; index < 7; index += 1) {
    const date = plusDays(saturday, index);
    const button = document.createElement('button');
    button.className = `day${isSameDay(date, selectedDate) ? ' active' : ''}${isSameDay(date, new Date()) ? ' today' : ''}`;
    button.innerHTML = `<span>${shortWeekday(date)}</span><strong>${dateDay.format(date)}</strong>`;
    button.setAttribute('aria-label', `${weekday.format(date)}، ${dateLong.format(date)}`);
    button.addEventListener('click', () => { selectedDate = date; render(); });
    ui.week.append(button);
  }
}

function renderTasks() {
  const dailyTasks = tasks
    .filter(task => task.date === dateKey(selectedDate))
    .sort((a, b) => a.time.localeCompare(b.time));

  ui.taskList.replaceChildren();
  dailyTasks.forEach(task => {
    const item = document.createElement('article');
    item.className = `task${task.done ? ' done' : ''}`;
    item.innerHTML = `
      <time class="task-time">${toPersianDigits(task.time)}</time>
      <div class="task-text">
        <div class="task-title"></div>
        ${task.note ? '<div class="task-note"></div>' : ''}
      </div>
      <div class="task-actions">
        <button class="check" aria-label="تغییر وضعیت کار">${task.done ? '✓' : ''}</button>
        <button class="delete" aria-label="حذف کار">×</button>
      </div>`;
    item.querySelector('.task-title').textContent = task.title;
    if (task.note) item.querySelector('.task-note').textContent = task.note;
    item.querySelector('.check').addEventListener('click', () => toggleTask(task.id));
    item.querySelector('.delete').addEventListener('click', () => removeTask(task.id));
    ui.taskList.append(item);
  });

  const completed = dailyTasks.filter(task => task.done).length;
  const percent = dailyTasks.length ? Math.round((completed / dailyTasks.length) * 100) : 0;
  ui.emptyState.hidden = dailyTasks.length > 0;
  ui.taskCount.textContent = `${formatFa.format(dailyTasks.length)} کار`;
  ui.progressPercent.textContent = `${formatFa.format(percent)}٪`;
  ui.progressBar.style.width = `${percent}%`;
  ui.progressLabel.textContent = dailyTasks.length
    ? `${formatFa.format(completed)} از ${formatFa.format(dailyTasks.length)} انجام شده`
    : 'هنوز کاری ثبت نشده';
}

function render() {
  const now = new Date();
  ui.gregorianDate.textContent = gregorian.format(selectedDate);
  ui.greeting.textContent = greetingFor(now.getHours());
  ui.weekday.textContent = weekday.format(selectedDate);
  ui.persianDate.textContent = dateLong.format(selectedDate);
  renderWeek();
  renderTasks();
  renderNotificationState();
}

function storeAndRender() { persist(); renderTasks(); }

function toggleTask(id) {
  const task = tasks.find(item => item.id === id);
  if (task) { task.done = !task.done; storeAndRender(); }
}

function removeTask(id) {
  tasks = tasks.filter(item => item.id !== id);
  storeAndRender();
  showToast('کار حذف شد');
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  window.setTimeout(() => ui.toast.classList.remove('show'), 1800);
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function chooseUnusedGhazalId() {
  if (falState.usedIds.length >= HAFEZ_GHAZAL_COUNT) {
    const previous = falState.usedIds[falState.usedIds.length - 1];
    falState.usedIds = previous ? [previous] : [];
  }
  const used = new Set(falState.usedIds);
  const available = Array.from({ length: HAFEZ_GHAZAL_COUNT }, (_, index) => index + 1).filter(id => !used.has(id));
  return randomFrom(available);
}

function extractGanjoorPoem(data, id) {
  const poem = data.poem || data;
  const sections = poem.sections || data.sections || [];
  const verses = poem.verses || sections.flatMap(section => section.verses || []);
  const lines = verses.map(verse => verse.text || verse.originalText).filter(Boolean);
  if (lines.length < 2) throw new Error('Poem data was incomplete');
  return {
    id,
    title: poem.title || `غزل شمارهٔ ${toPersianDigits(id)}`,
    verses: lines,
    reading: FAL_READINGS[id % FAL_READINGS.length],
    source: 'متن شعر: گنجور'
  };
}

async function fetchGanjoorFal(id) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://api.ganjoor.net/api/ganjoor/page?url=${encodeURIComponent(`/hafez/ghazal/sh${id}`)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Ganjoor request failed');
    return extractGanjoorPoem(await response.json(), id);
  } finally {
    window.clearTimeout(timeout);
  }
}

function chooseFallbackFal() {
  if (falState.fallbackUsed.length >= FALLBACK_FALS.length) {
    const last = falState.fallbackUsed[falState.fallbackUsed.length - 1];
    falState.fallbackUsed = last ? [last] : [];
  }
  const used = new Set(falState.fallbackUsed);
  const chosen = randomFrom(FALLBACK_FALS.filter(fal => !used.has(fal.id)));
  falState.fallbackUsed.push(chosen.id);
  return {
    ...chosen,
    reading: FAL_READINGS[Number(chosen.id.split('-')[1]) % FAL_READINGS.length],
    source: 'نسخهٔ آفلاین منتخب از دیوان حافظ'
  };
}

function paintFal(fal) {
  ui.falTitle.textContent = fal.title;
  ui.falVerses.replaceChildren();
  fal.verses.forEach(line => {
    const verse = document.createElement('p');
    verse.textContent = line;
    ui.falVerses.append(verse);
  });
  ui.falReading.textContent = fal.reading;
  ui.falSource.textContent = fal.source;
  ui.falLoading.hidden = true;
  ui.falContent.hidden = false;
}

async function createDailyFal() {
  ui.falLoading.hidden = false;
  ui.falContent.hidden = true;
  const id = chooseUnusedGhazalId();
  let fal;
  try {
    fal = await fetchGanjoorFal(id);
    falState.usedIds.push(id);
  } catch {
    fal = chooseFallbackFal();
  }
  falState.current = fal;
  falState.lastShownAt = Date.now();
  persistFalState();
  paintFal(fal);
}

function openFal({ automatic = false } = {}) {
  if (!ui.falDialog.open) ui.falDialog.showModal();
  const expired = !falState.lastShownAt || Date.now() - falState.lastShownAt >= DAY_IN_MS || Date.now() < falState.lastShownAt;
  if (!falState.current || (automatic && expired)) createDailyFal();
  else paintFal(falState.current);
}

function initializeDailyFal() {
  const expired = !falState.lastShownAt || Date.now() - falState.lastShownAt >= DAY_IN_MS || Date.now() < falState.lastShownAt;
  if (expired) window.setTimeout(() => openFal({ automatic: true }), 450);
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    showToast('مرورگر شما اعلان را پشتیبانی نمی‌کند');
    return;
  }
  const permission = await Notification.requestPermission();
  renderNotificationState();
  if (permission === 'granted') {
    showToast('یادآوری‌ها فعال شدند');
    sendNotification('اعلان‌های امروز فعال شد', 'از اینجا به بعد، پنج دقیقه قبل و سر وقت یادت می‌اندازم.', 'welcome');
    checkNotifications();
  } else {
    showToast('اجازهٔ اعلان داده نشد');
  }
}

async function sendNotification(title, body, tag) {
  if (!notificationsEnabled()) return;
  const options = { body, tag: `emrooz-${tag}`, renotify: true, dir: 'rtl', lang: 'fa', badge: './icon.svg', icon: './icon.svg' };
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch {
    try { new Notification(title, options); } catch { /* Browser blocked the notification. */ }
  }
}

function taskMoment(task) {
  const [year, month, day] = task.date.split('-').map(Number);
  const [hour, minute] = task.time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function markNotification(key) {
  sentNotifications[key] = Date.now();
  // Keep the log small by removing entries older than eight days.
  const cutoff = Date.now() - (8 * 24 * 60 * 60 * 1000);
  Object.keys(sentNotifications).forEach(item => {
    if (sentNotifications[item] < cutoff) delete sentNotifications[item];
  });
  persistNotificationLog();
}

function dailySummary(now, period) {
  const todayTasks = tasks.filter(task => task.date === dateKey(now));
  const relevant = period === 'midday'
    ? todayTasks.filter(task => Number(task.time.slice(0, 2)) < 12)
    : todayTasks;
  const done = relevant.filter(task => task.done).length;
  const pending = relevant.length - done;
  const title = period === 'midday' ? 'خلاصهٔ نیمهٔ اول روز' : 'خلاصهٔ امروز';
  const body = relevant.length
    ? `${formatFa.format(done)} کار انجام شد و ${formatFa.format(pending)} کار باقی ماند.`
    : 'برای این بازه کاری ثبت نشده بود. فردا یک شروع تازه است.';
  return { title, body };
}

function checkNotifications() {
  if (!notificationsEnabled()) return;
  const now = new Date();

  tasks.filter(task => !task.done).forEach(task => {
    const due = taskMoment(task);
    const difference = due.getTime() - now.getTime();
    const earlyKey = `${task.id}:five`;
    const dueKey = `${task.id}:due`;

    if (difference > 4 * 60 * 1000 && difference <= 5 * 60 * 1000 && !sentNotifications[earlyKey]) {
      sendNotification('پنج دقیقه تا کار بعدی', `${task.title} — ساعت ${toPersianDigits(task.time)}`, earlyKey);
      markNotification(earlyKey);
    }
    if (difference <= 0 && difference > -60 * 1000 && !sentNotifications[dueKey]) {
      sendNotification('وقت انجام کار رسید', task.title, dueKey);
      markNotification(dueKey);
    }
  });

  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  const summaries = [
    { minute: 11 * 60 + 55, period: 'midday' },
    { minute: 23 * 60 + 55, period: 'day' }
  ];
  summaries.forEach(summary => {
    const summaryKey = `${dateKey(now)}:summary:${summary.period}`;
    if (minuteOfDay === summary.minute && !sentNotifications[summaryKey]) {
      const message = dailySummary(now, summary.period);
      sendNotification(message.title, message.body, summaryKey);
      markNotification(summaryKey);
    }
  });
}

function openTaskDialog() {
  const now = new Date();
  const minutes = Math.floor(now.getMinutes() / 5) * 5;
  ui.taskDate.value = numericJalali(selectedDate);
  ui.taskTime.value = `${String(now.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  ui.dialog.showModal();
  window.setTimeout(() => ui.taskTitle.focus(), 60);
}

$('addButton').addEventListener('click', openTaskDialog);
$('falButton').addEventListener('click', () => openFal());
$('closeFal').addEventListener('click', () => ui.falDialog.close());
$('acceptFal').addEventListener('click', () => ui.falDialog.close());
$('enableNotifications').addEventListener('click', enableNotifications);
$('notificationButton').addEventListener('click', () => {
  if (!notificationsEnabled()) enableNotifications();
  else showToast('اعلان‌ها فعال هستند');
});
$('closeDialog').addEventListener('click', () => ui.dialog.close());
$('todayButton').addEventListener('click', () => { selectedDate = atMidnight(new Date()); render(); });
$('previousDay').addEventListener('click', () => { selectedDate = plusDays(selectedDate, -1); render(); });
$('nextDay').addEventListener('click', () => { selectedDate = plusDays(selectedDate, 1); render(); });
ui.dialog.addEventListener('click', event => { if (event.target === ui.dialog) ui.dialog.close(); });
ui.falDialog.addEventListener('click', event => { if (event.target === ui.falDialog) ui.falDialog.close(); });

ui.form.addEventListener('submit', event => {
  event.preventDefault();
  const enteredDate = toEnglishDigits(ui.taskDate.value).replace(/-/g, '/');
  const selectedJalali = toEnglishDigits(numericJalali(selectedDate));
  if (enteredDate !== selectedJalali) {
    showToast('تاریخ را از نوار بالای صفحه انتخاب کن');
    return;
  }
  tasks.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: ui.taskTitle.value.trim(),
    note: ui.taskNote.value.trim(),
    date: dateKey(selectedDate),
    time: ui.taskTime.value,
    done: false
  });
  persist();
  ui.form.reset();
  ui.dialog.close();
  renderTasks();
  showToast('کار ذخیره شد');
});

render();
syncNativeTasks();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
window.setInterval(checkNotifications, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNotifications(); });
checkNotifications();
initializeDailyFal();
