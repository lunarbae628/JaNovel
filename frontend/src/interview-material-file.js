const maxBytes = 10 * 1024 * 1024;
const maxText = 40000;

async function pdfText(file) {
  const [{getDocument, GlobalWorkerOptions}, {default: workerUrl}] = await Promise.all([
    import('pdfjs-dist/build/pdf.min.mjs'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = workerUrl;
  const task = getDocument({data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: false});
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 60) throw Error('60쪽 이하의 PDF를 선택해 주세요.');
    const pages = [];
    let length = 0;
    for (let number = 1; number <= pdf.numPages && length < maxText; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('');
      pages.push(text);
      length += text.length;
    }
    return pages.join('\n').slice(0, maxText);
  } finally {
    await task.destroy();
  }
}

export async function readMaterialFile(file) {
  if (file.size > maxBytes) throw Error('10MB 이하의 파일을 선택해 주세요.');
  if (/\.pdf$/i.test(file.name)) {
    try {
      return await pdfText(file);
    } catch (error) {
      if (error.name === 'PasswordException') throw Error('잠금이 해제된 PDF를 선택해 주세요.');
      if (error.message === '60쪽 이하의 PDF를 선택해 주세요.') throw error;
      throw Error('PDF를 읽지 못했어요. 파일을 다시 선택하거나 본문을 붙여 넣어 주세요.');
    }
  }
  if (/\.(txt|md)$/i.test(file.name)) return (await file.text()).slice(0, maxText);
  throw Error('PDF, TXT, MD 파일을 선택해 주세요.');
}
