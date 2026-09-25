// Subscription data is separate from tasks and the retired project records.
const SUBSCRIPTION_KEY = 'emrooz.subscriptions.v1';
const subscriptionLabels = {
  'jalali-month': 'هر ماه شمسی', 'gregorian-month': 'هر ماه میلادی',
  '30-days': 'هر ۳۰ روز', week: 'هر هفته', 'jalali-year': 'هر سال شمسی'
};
let subscriptions = readSubscriptions();
let editingSubscriptionId = null;
const jalaliMonthCache = new Map();

function readSubscriptions() {
  try {
    const value = JSON.parse(localStorage.getItem(SUBSCRIPTION_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function subscriptionDue(subscription, cycle) {
  const purchase = new Date(`${subscription.date}T00:00:00`);
  const [hour, minute] = subscription.time.split(':').map(Number);
  let day;
  if (subscription.rule === 'week' || subscription.rule === '30-days') {
    day = plusDays(purchase, cycle * (subscription.rule === 'week' ? 7 : 30));
  } else if (subscription.rule === 'gregorian-month') {
    const year = purchase.getFullYear();
    const month = purchase.getMonth() + cycle;
    const last = new Date(year, month + 1, 0).getDate();
    day = new Date(year, month, Math.min(purchase.getDate(), last));
  } else {
    const originalDay = jalaliParts(purchase).day;
    const steps = cycle * (subscription.rule === 'jalali-year' ? 12 : 1);
    const cacheKey = `${subscription.date}:${subscription.rule}`;
    if (!jalaliMonthCache.has(cacheKey)) jalaliMonthCache.set(cacheKey, [firstDayOfJalaliMonth(purchase)]);
    const starts = jalaliMonthCache.get(cacheKey);
    while (starts.length <= steps) starts.push(firstDayOfNextJalaliMonth(starts[starts.length - 1]));
    day = starts[steps];
    const end = firstDayOfNextJalaliMonth(day);
    const length = Math.round((end - day) / DAY_IN_MS);
    day = plusDays(day, Math.min(originalDay, length) - 1);
  }
  day.setHours(hour, minute, 0, 0);
  return day;
}

function firstFutureCycle(subscription, now = new Date()) {
  for (let cycle = 1; cycle < 2000; cycle += 1) {
    if (subscriptionDue(subscription, cycle) >= now) return cycle;
  }
  return 1;
}

function subscriptionStatus(subscription, now = new Date()) {
  if (subscription.paused) return 'paused';
  const due = subscriptionDue(subscription, subscription.currentCycle);
  if (due < now) return 'overdue';
  if (due - now <= 3 * DAY_IN_MS) return 'soon';
  return 'upcoming';
}

function subscriptionAmountText(subscription) {
  return subscription.amount === '' || subscription.amount == null ? '' :
    `${new Intl.NumberFormat('fa-IR').format(Number(subscription.amount))} ریال`;
}

function subscriptionCard(subscription, compact = false) {
  const due = subscriptionDue(subscription, subscription.currentCycle);
  const status = subscriptionStatus(subscription);
  const labels = { paused: 'متوقف', overdue: 'عقب‌افتاده', soon: 'نزدیک', upcoming: 'پیش رو' };
  const card = document.createElement('article');
  card.className = `subscription-card ${status}`;
  card.innerHTML = `<div class="subscription-card-main"><strong class="subscription-name"></strong><span class="subscription-status">${labels[status]}</span></div>
    <p class="subscription-due">${dateLong.format(due)}، ساعت ${toPersianDigits(subscription.time)}</p>
    <p class="subscription-details">${subscriptionLabels[subscription.rule]}<span class="subscription-amount"></span></p>
    ${compact ? '' : '<div class="subscription-actions"><button type="button" data-action="paid">پرداخت شد</button><button type="button" data-action="skip">رد کردن نوبت</button><button type="button" data-action="pause">توقف</button><button type="button" data-action="edit">ویرایش</button><button type="button" data-action="delete">حذف</button></div>'}`;
  card.querySelector('.subscription-name').textContent = subscription.title;
  const amount = subscriptionAmountText(subscription);
  card.querySelector('.subscription-amount').textContent = amount ? ` · ${amount}` : '';
  if (!compact) {
    card.querySelector('[data-action="paid"]').disabled = subscription.paused;
    card.querySelector('[data-action="skip"]').disabled = subscription.paused;
    card.querySelector('[data-action="pause"]').textContent = subscription.paused ? 'فعال‌سازی' : 'توقف';
    card.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.action;
      if (action === 'edit') return openSubscriptionDialog(subscription);
      if (action === 'delete') {
        if (!confirm(`اشتراک «${subscription.title}» حذف شود؟`)) return;
        subscriptions = subscriptions.filter(item => item.id !== subscription.id);
      } else if (action === 'pause') {
        subscription.paused = !subscription.paused;
      } else {
        if (action === 'paid') {
          subscription.history ||= [];
          subscription.history.push({ cycle: subscription.currentCycle, paidAt: new Date().toISOString() });
        }
        subscription.currentCycle += 1;
      }
      persistSubscriptions();
      renderSubscriptions();
    }));
  }
  return card;
}

function renderSubscriptions() {
  const ordered = [...subscriptions].sort((a, b) => subscriptionDue(a, a.currentCycle) - subscriptionDue(b, b.currentCycle));
  const list = $('subscriptionsList');
  const preview = $('subscriptionPreviewList');
  list.replaceChildren();
  preview.replaceChildren();
  ordered.forEach(item => list.append(subscriptionCard(item)));
  ordered.filter(item => !item.paused).slice(0, 3).forEach(item => preview.append(subscriptionCard(item, true)));
  if (!preview.children.length) {
    const empty = document.createElement('p');
    empty.className = 'subscription-hint';
    empty.textContent = 'پرداخت فعالی ثبت نشده است.';
    preview.append(empty);
  }
  $('subscriptionCount').textContent = `${formatFa.format(subscriptions.length)} اشتراک`;
  $('subscriptionsEmpty').hidden = subscriptions.length > 0;
}
window.renderSubscriptions = renderSubscriptions;

function subscriptionAlarmPayload() {
  return subscriptions.filter(item => !item.paused).map(item => {
    const events = [];
    const now = Date.now();
    const horizon = item.rule === 'week' ? 520 : item.rule === 'jalali-year' ? 20 : 120;
    for (let cycle = item.currentCycle; cycle < item.currentCycle + horizon; cycle += 1) {
      const due = subscriptionDue(item, cycle).getTime();
      if (due <= now) continue;
      events.push({ cycle, at: due, kind: 'due' });
      const early = due - Number(item.lead) * DAY_IN_MS;
      if (Number(item.lead) > 0 && early > now) events.push({ cycle, at: early, kind: 'early' });
    }
    return { id: item.id, title: item.title, events };
  });
}

function persistSubscriptions() {
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscriptions));
  try { window.AndroidNotifications?.syncSubscriptions(JSON.stringify(subscriptionAlarmPayload())); } catch { /* Web preview. */ }
}

function openSubscriptionDialog(subscription = null) {
  editingSubscriptionId = subscription?.id || null;
  $('subscriptionDialogTitle').textContent = subscription ? 'ویرایش اشتراک' : 'اشتراک تازه';
  $('subscriptionForm').reset();
  $('subscriptionTitle').value = subscription?.title || '';
  setPickedDate($('subscriptionDate'), subscription ? new Date(`${subscription.date}T00:00:00`) : new Date());
  $('subscriptionTime').value = subscription?.time || `${String(new Date().getHours()).padStart(2, '0')}:00`;
  $('subscriptionRule').value = subscription?.rule || 'jalali-month';
  $('subscriptionAmount').value = subscription?.amount ?? '';
  $('subscriptionLead').value = String(subscription?.lead ?? 3);
  $('subscriptionDialog').showModal();
}

function closeSubscriptionDialog() { $('subscriptionDialog').close(); editingSubscriptionId = null; }
$('openSubscriptionDialog').addEventListener('click', () => openSubscriptionDialog());
$('createSubscriptionEmpty').addEventListener('click', () => openSubscriptionDialog());
$('showSubscriptions').addEventListener('click', () => switchView('subscriptions'));
$('closeSubscriptionDialog').addEventListener('click', closeSubscriptionDialog);
$('subscriptionDialog').addEventListener('click', event => {
  if (event.target === $('subscriptionDialog')) closeSubscriptionDialog();
});
$('subscriptionForm').addEventListener('submit', event => {
  event.preventDefault();
  const purchase = pickedDate($('subscriptionDate'));
  if (!purchase) return showToast('تاریخ خرید را از تقویم انتخاب کن');
  const existing = subscriptions.find(item => item.id === editingSubscriptionId);
  const details = {
    title: $('subscriptionTitle').value.trim(), date: dateKey(purchase),
    time: $('subscriptionTime').value, rule: $('subscriptionRule').value,
    amount: $('subscriptionAmount').value, lead: Number($('subscriptionLead').value)
  };
  if (!details.title || !details.time) return;
  if (existing) {
    const reanchor = existing.date !== details.date || existing.time !== details.time || existing.rule !== details.rule;
    if (reanchor && !confirm('تغییر تاریخ یا دوره، سابقهٔ پرداخت این اشتراک را از نو آغاز می‌کند. ادامه می‌دهی؟')) return;
    Object.assign(existing, details);
    if (reanchor) { existing.history = []; existing.currentCycle = firstFutureCycle(existing); }
  } else {
    const record = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, ...details, paused: false, history: [] };
    record.currentCycle = firstFutureCycle(record);
    subscriptions.push(record);
  }
  persistSubscriptions();
  closeSubscriptionDialog();
  renderSubscriptions();
  showToast('اشتراک ذخیره شد');
});

renderSubscriptions();
persistSubscriptions();
window.setInterval(renderSubscriptions, 60000);
