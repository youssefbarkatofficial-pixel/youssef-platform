import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMastery,
  reviewCards,
  buildPlan,
  predictScore,
  weeklySummary,
  createLocalStore,
  DAY_MS,
} from '../src/lib/revision/index.ts';

const NOW = Date.UTC(2026, 9, 19, 12, 0, 0);
const ev = (questionId, skillId, outcome, daysAgo, extra = {}) => ({
  questionId,
  skillId,
  outcome,
  at: NOW - daysAgo * DAY_MS,
  ...extra,
});

test('mastery: الأخطاء الحديثة = مهارة ضعيفة، والإجابات الصحيحة الكثيرة = متمكّن', () => {
  const wrong = Array.from({ length: 5 }, (_, i) => ev(`q${i}`, 's1', 'wrong', 1));
  const right = Array.from({ length: 10 }, (_, i) => ev(`r${i}`, 's2', 'correct', 1));
  const m = computeMastery([...wrong, ...right], NOW);
  assert.equal(m.get('s1').status, 'weak');
  assert.equal(m.get('s2').status, 'strong');
  assert.ok(m.get('s1').mastery < 0.5);
  assert.ok(m.get('s2').mastery > 0.8);
});

test('mastery: الدليل القديم أقل وزنًا من الحديث', () => {
  const recent = computeMastery([ev('q', 's', 'wrong', 1)], NOW).get('s');
  const old = computeMastery([ev('q', 's', 'wrong', 90)], NOW).get('s');
  assert.ok(old.mastery > recent.mastery, 'الخطأ القديم يقلّ أثره');
  assert.ok(old.confidence < recent.confidence);
});

test('mastery: أحداث من المستقبل تُتجاهل', () => {
  const m = computeMastery([ev('q', 's', 'wrong', -3)], NOW);
  assert.equal(m.size, 0);
});

test('scheduler: فواصل SM-2 (1 ثم 3 ثم ease) وإعادة الضبط عند الخطأ', () => {
  const events = [ev('q1', 's', 'correct', 10), ev('q1', 's', 'correct', 9), ev('q1', 's', 'correct', 5)];
  const c = reviewCards(events).get('q1');
  assert.equal(c.reps, 3);
  assert.equal(c.intervalDays, 8);
  assert.equal(c.dueAt, NOW - 5 * DAY_MS + 8 * DAY_MS);

  const lapsed = reviewCards([...events, ev('q1', 's', 'wrong', 1)]).get('q1');
  assert.equal(lapsed.reps, 0);
  assert.equal(lapsed.lapses, 1);
  assert.equal(lapsed.intervalDays, 1);
  assert.ok(lapsed.ease < 2.5);
});

test('scheduler: الإجابة الصحيحة السريعة ترفع ease', () => {
  const c = reviewCards([ev('q', 's', 'correct', 1, { timeMs: 3000 })]).get('q');
  assert.ok(c.ease > 2.5);
});

test('planner: المستحق قبل الجديد، والجديد محدود عند توفر مراجعات', () => {
  const questions = [];
  const events = [];
  for (let i = 0; i < 5; i++) {
    questions.push({ id: `d${i}`, skillId: i % 2 ? 'a' : 'b' });
    events.push(ev(`d${i}`, i % 2 ? 'a' : 'b', 'wrong', 4));
  }
  for (let i = 0; i < 6; i++) questions.push({ id: `n${i}`, skillId: 'c' });

  const plan = buildPlan(questions, events, NOW, { size: 5, maxNew: 1 });
  assert.equal(plan.items.length, 5);
  assert.equal(plan.items.filter((x) => x.reason === 'new').length, 1);
  assert.equal(plan.items.filter((x) => x.reason === 'due').length, 4);
  assert.equal(plan.dueCount, 5);
});

test('planner: عند قلة المراجعات تُملأ الجلسة بأسئلة جديدة', () => {
  const questions = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, skillId: 's' }));
  const plan = buildPlan(questions, [], NOW, { size: 6, maxNew: 2 });
  assert.equal(plan.items.length, 6);
  assert.ok(plan.items.every((x) => x.reason === 'new'));
});

test('planner: لا تتجاور نفس المهارة عند وجود بديل', () => {
  const questions = [];
  for (const s of ['a', 'b']) for (let i = 0; i < 3; i++) questions.push({ id: `${s}${i}`, skillId: s });
  const plan = buildPlan(questions, [], NOW, { size: 6, maxNew: 6 });
  for (let i = 1; i < plan.items.length; i++) {
    assert.notEqual(plan.items[i].skillId, plan.items[i - 1].skillId);
  }
});

test('planner: حتمي، ويحترم focusSkillIds', () => {
  const questions = [
    { id: 'x1', skillId: 'x' },
    { id: 'y1', skillId: 'y' },
    { id: 'y2', skillId: 'y' },
  ];
  const p1 = buildPlan(questions, [], NOW, { focusSkillIds: ['y'] });
  const p2 = buildPlan(questions, [], NOW, { focusSkillIds: ['y'] });
  assert.deepEqual(p1, p2);
  assert.ok(p1.items.every((i) => i.skillId === 'y'));
});

test('planner: السؤال غير المستحق في مهارة قوية لا يدخل الجلسة', () => {
  const questions = [{ id: 'q', skillId: 's' }];
  const events = [ev('q', 's', 'correct', 0.1)];
  const plan = buildPlan(questions, events, NOW);
  assert.equal(plan.items.length, 0);
});

test('predict: بلا بيانات = 50% وتغطية صفر، ومع بيانات قوية يرتفع التقدير', () => {
  const none = predictScore([{ skillId: 's', weight: 1 }], new Map());
  assert.equal(none.expected, 0.5);
  assert.equal(none.coverage, 0);

  const events = Array.from({ length: 12 }, (_, i) => ev(`q${i}`, 's', 'correct', 1));
  const p = predictScore([{ skillId: 's', weight: 1 }], computeMastery(events, NOW));
  assert.ok(p.expected > 0.8);
  assert.ok(p.low < p.expected && p.expected < p.high);
  assert.equal(p.coverage, 1);
});

test('report: ملخص أسبوعي وسلسلة الأيام', () => {
  const events = [
    ...Array.from({ length: 4 }, (_, i) => ev(`a${i}`, 'a', 'correct', 0.1)),
    ev('b0', 'b', 'correct', 1),
    ev('b1', 'b', 'wrong', 1),
    ev('b2', 'b', 'wrong', 1),
    ev('b3', 'b', 'wrong', 1),
    ev('old', 'a', 'wrong', 30),
  ];
  const s = weeklySummary(events, { a: 'الدرس الأول', b: 'الدرس الثاني' }, NOW, 0);
  assert.equal(s.answered, 8);
  assert.equal(s.streakDays, 2);
  assert.equal(s.strongestSkillId, 'a');
  assert.equal(s.weakestSkillId, 'b');
  assert.ok(s.lines.some((l) => l.includes('الدرس الثاني')));
  assert.equal(weeklySummary([], {}, NOW, 0).lines.length, 1);
});

function fakeStorage() {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

test('store: حفظ بدون تكرار، وبيانات تالفة = قائمة فارغة، وفشل الحفظ يظهر كخطأ', async () => {
  const st = fakeStorage();
  const store = createLocalStore('u1', st);
  const e = ev('q', 's', 'correct', 1, { source: 'practice' });
  await store.append([e]);
  await store.append([e, ev('q2', 's', 'wrong', 1, { source: 'practice' })]);
  assert.equal((await store.load()).length, 2);

  st.data['rev:v1:u1'] = '{not json';
  assert.deepEqual(await store.load(), []);

  const full = createLocalStore('u2', {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  });
  await assert.rejects(() => full.append([e]), /تعذّر حفظ التقدّم/);
});
