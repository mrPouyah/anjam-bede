const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = __dirname;
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const subscriptions = fs.readFileSync(path.join(root, 'subscriptions.js'), 'utf8');
const helpers = app.slice(app.indexOf('function atMidnight('), app.indexOf('function renderDatePicker('));
const recurrence = subscriptions.slice(subscriptions.indexOf('function subscriptionDue('), subscriptions.indexOf('function subscriptionCard('));
const context = vm.createContext({ Intl, Date, Math, Number, String, Object, Set });
vm.runInContext(`const DAY_IN_MS = 86400000;
  const jalaliMonthCache = new Map();
  const numericPersian = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' });
  ${helpers}\n${recurrence}`, context);

function evaluate(code) { return vm.runInContext(code, context); }

const gregorian = { date: '2026-01-31', time: '10:30', rule: 'gregorian-month' };
assert.equal(evaluate(`subscriptionDue(${JSON.stringify(gregorian)}, 1).toISOString().slice(0, 10)`), '2026-02-28');
assert.equal(evaluate(`subscriptionDue(${JSON.stringify(gregorian)}, 2).toISOString().slice(0, 10)`), '2026-03-31');

const fixed = { date: '2026-01-31', time: '10:30', rule: '30-days' };
assert.equal(evaluate(`(subscriptionDue(${JSON.stringify(fixed)}, 1) - new Date(2026, 0, 31, 10, 30)) / DAY_IN_MS`), 30);
const weekly = { ...fixed, rule: 'week' };
assert.equal(evaluate(`(subscriptionDue(${JSON.stringify(weekly)}, 1) - new Date(2026, 0, 31, 10, 30)) / DAY_IN_MS`), 7);

const jalali = evaluate(`(() => {
  for (let day = new Date(2026, 0, 1); day.getFullYear() === 2026; day.setDate(day.getDate() + 1)) {
    const parts = jalaliParts(day);
    if (parts.month === 6 && parts.day === 31) return { date: dateKey(day), time: '10:30', rule: 'jalali-month' };
  }
})()`);
assert.ok(jalali);
assert.equal(evaluate(`jalaliParts(subscriptionDue(${JSON.stringify(jalali)}, 1)).day`), 30);
assert.equal(evaluate(`jalaliParts(subscriptionDue(${JSON.stringify(jalali)}, 7)).day`), 31);
assert.equal(evaluate(`subscriptionDue(${JSON.stringify(jalali)}, 7).getHours()`), 10);
assert.equal(evaluate(`firstFutureCycle(${JSON.stringify(jalali)}, subscriptionDue(${JSON.stringify(jalali)}, 2))`), 2);

console.log('Subscription recurrence tests passed');
