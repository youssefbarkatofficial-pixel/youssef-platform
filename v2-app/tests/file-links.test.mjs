import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFileLinks, countLinks } from '../scripts/file-links-lib.mjs';

const course = {
  source: 'v2',
  contents: {
    layoutVersion: 2,
    lectures: [
      { id: 'L1', pdfUrl: 'https://example.test/a.pdf', files: [{ id: 'f1', title: 'ملف', url: 'https://example.test/b.pdf' }] },
      { id: 'L2', pdfUrl: '', files: [] },
    ],
    sections: [
      {
        id: 's1',
        items: [
          {
            id: 'I1',
            type: 'pdf',
            pdfUrl: 'https://example.test/c.pdf',
            children: [{ id: 'I2', files: [{ id: 'f2', title: 't', url: 'https://example.test/d.pdf' }] }],
          },
          { id: 'I3', type: 'video', videoUrl: 'https://youtu.be/x' },
        ],
      },
    ],
  },
};

test('1. استخراج روابط الملفات من lectures وsections (بما فيها children)', () => {
  const m = extractFileLinks(course);
  assert.deepEqual(Object.keys(m).sort(), ['I1', 'I2', 'L1']);
  assert.equal(countLinks(m), 4);
  assert.ok(!('I3' in m) && !('L2' in m)); // فيديو بس أو فاضي = مش ملف
});

test('2. بيانات ناقصة أو غريبة ما بتكسرش', () => {
  assert.deepEqual(extractFileLinks({}), {});
  assert.deepEqual(extractFileLinks({ contents: { lectures: [null, 5, { id: '', pdfUrl: 'x' }] } }), {});
});
