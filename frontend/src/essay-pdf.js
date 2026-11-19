const width = 376;
const pageHeight = 542;
const lineHeight = 20;
const sectionGap = 23;
const documentTitleHeight = 72;
const words = new Intl.Segmenter('ko', {granularity: 'grapheme'});

function wrap(text, measure, maxWidth = width) {
  return text.replace(/\r\n?/g, '\n').split('\n').flatMap(paragraph => {
    const lines = [];
    let line = '';
    for (const {segment} of words.segment(paragraph)) {
      if (line && measure(line + segment) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += segment;
    }
    return [...lines, line];
  });
}

export function paginateEssay(sections, measure, titleLines = 1) {
  const pages = [{first: true, sections: []}];
  let left = pageHeight - documentTitleHeight - (titleLines - 1) * lineHeight;
  for (const section of sections) {
    const heading = wrap('Q' + section.number + '. ' + section.prompt, value => measure(value, true));
    const lines = wrap(section.text, measure);
    let offset = 0;
    do {
      const header = offset ? [] : heading;
      const headingHeight = header.length ? header.length * lineHeight + 14 : 0;
      if (left < headingHeight + lineHeight) {
        pages.push({first: false, sections: []});
        left = pageHeight;
      }
      const count = Math.max(1, Math.floor((left - headingHeight) / lineHeight));
      const visible = lines.slice(offset, offset + count);
      pages.at(-1).sections.push({...section, heading: header, lines: visible});
      left -= headingHeight + visible.length * lineHeight + sectionGap;
      offset += visible.length;
    } while (offset < lines.length);
  }
  return pages;
}

export function essayLayout(title, sections) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw Error('layout');
  const measure = (value, bold = false) => {
    context.font = (bold ? '600 12px' : '400 12px') + ' "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
    return context.measureText(value).width;
  };
  const titleLines = wrap(title, value => {
    context.font = '700 15px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
    return context.measureText(value).width;
  });
  return {titleLines, pages: paginateEssay(sections, measure, titleLines.length)};
}
