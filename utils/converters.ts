declare const pdfjsLib: any;
declare const mammoth: any;

if (typeof window !== 'undefined' && (window as any).pdfjsLib) {
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Cắt ảnh từ base64 dựa trên tọa độ chuẩn hóa [ymin, xmin, ymax, xmax] (0-1000)
 */
export const cropImage = (base64: string, box: number[]): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64);

      const [ymin, xmin, ymax, xmax] = box;
      const x = (xmin / 1000) * img.width;
      const y = (ymin / 1000) * img.height;
      const width = ((xmax - xmin) / 1000) * img.width;
      const height = ((ymax - ymin) / 1000) * img.height;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = base64;
  });
};

export const pdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const imageUrls: string[] = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
    const page = await pdf.getPage(i);
    const scale = 3;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
      if (context) {
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
}
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, viewport }).promise;
    imageUrls.push(canvas.toDataURL('image/png'));
  }
  return imageUrls;
};

export const docxToHtmlAndImages = async (file: File): Promise<{ html: string, images: string[] }> => {
  const arrayBuffer = await file.arrayBuffer();
  const images: string[] = [];
  const options = {
    convertImage: mammoth.images.inline((element: any) => {
      return element.read("base64").then((imageBuffer: any) => {
        const base64 = `data:${element.contentType};base64,${imageBuffer.base64}`;
        images.push(base64);
        return { src: base64 };
      });
    })
  };
  const result = await mammoth.convertToHtml({ arrayBuffer }, options);
  return { html: result.value, images };
};

export const downloadAsWord = async (
  latexContent: string, 
  sourceImages: string[], 
  figures: any[], 
  fileName: string
) => {
  // Chuẩn bị các ảnh đã được cắt
  const croppedMap: Record<string, string> = {};
  if (figures && figures.length > 0) {
    for (const fig of figures) {
      const sourceBase64 = sourceImages[fig.source_index];
      if (sourceBase64) {
        croppedMap[fig.id] = await cropImage(sourceBase64, fig.box_2d);
      }
    }
  }

  const lines = latexContent.split('\n').map(line => {
    let processed = line.trim();
    if (!processed) return '<p>&nbsp;</p>';
    // GIỮ LẠI <key=...> KHÔNG BỊ WORD XÓA
    processed = processed.replace(/<key=([^>]+)>/g, '&lt;key=$1&gt;');
    
    
    // Xử lý gạch chân \underline{...} -> <u>...</u>
    processed = processed.replace(/\\underline\{(.*?)\}/g, '<u>$1</u>');

    // Đảm bảo (anh) được giữ nguyên và có thể được style nhẹ để dễ nhận diện
    processed = processed.replace(/\(anh\)/g, '<span style="color:blue;font-weight:bold;">(anh)</span>');

    // Thay thế thẻ [[FIG_ID]] bằng ảnh đã cắt
    if (processed.includes('[[FIG_')) {
      return processed.replace(/\[\[(FIG_\w+)\]\]/g, (match, figId) => {
        if (croppedMap[figId]) {
          return `<p>&nbsp;</p><div style="text-align:center;margin:10pt 0;"><img src="${croppedMap[figId]}" style="max-width:400pt; height:auto; border:0.5pt solid #eee;" /></div><p>&nbsp;</p>`;
        }
        return `<p style="text-align:center;color:red;">[Hình vẽ ${figId} không tìm thấy]</p>`;
      });
    }
    
    return `<p style="margin:0 0 8pt 0; font-family:'Times New Roman', serif; font-size:13pt; line-height:1.5;">${processed}</p>`;
  }).join('');

  const htmlWrapper = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><style>body { font-family: 'Times New Roman', serif; }</style></head>
    <body>${lines}</body></html>
  `;

  const blob = new Blob([htmlWrapper], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadAsLatex = (latexContent: string, fileName: string) => {
  const blob = new Blob([latexContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
