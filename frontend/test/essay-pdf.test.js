import assert from 'node:assert/strict';
import test from 'node:test';
import {paginateEssay} from '../src/essay-pdf.js';

test('keeps headings and body together across pages and preserves long Korean text', () => {
  const text = '가나다라마바사아자차카타파하'.repeat(200);
  const pages = paginateEssay([{number: 1, prompt: '지원 동기', text}], value => [...value].length * 13);
  assert(pages.length > 1);
  assert.equal(pages[0].sections[0].number, 1);
  assert.equal(pages.flatMap(page => page.sections).flatMap(section => section.lines).join(''), text);
  assert(pages.every(page => page.sections.every(section => section.lines.length)));
});

test('keeps empty answers and authored paragraph breaks', () => {
  const pages = paginateEssay([
    {number: 1, prompt: '지원 동기', text: '처음\n\n그다음'},
    {number: 2, prompt: '입사 후 목표', text: ''},
  ], value => value.length * 10);
  assert.deepEqual(pages[0].sections.map(section => section.lines), [['처음', '', '그다음'], ['']]);
});
