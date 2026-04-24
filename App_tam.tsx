App
import React, { useState, useEffect } from 'react';
import { FileType, ProcessingFile } from './types';
import { pdfToImages, docxToHtmlAndImages, downloadAsWord, downloadAsLatex, fileToDataUrl } from './utils/converters';
import { convertToLatexHtml } from './services/gemini';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [pageRange, setPageRange] = useState({ from: '', to: '' });
  const [currentFile, setCurrentFile] = useState<ProcessingFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showVBAModal, setShowVBAModal] = useState(false);
    // 1. Thêm state lưu lượt truy cập
  const [viewCount, setViewCount] = useState<number | null>(null);

 // 2. Thêm useEffect này để đếm theo phiên và tối ưu tốc độ F5 cực mượt
  useEffect(() => {
    const namespace = "mathdigitizer_smartcrop"; 
    const key = "visits";
    
    // Tìm xem trong Tab này đã lưu con số nào chưa
    const savedCount = sessionStorage.getItem('mathdigitizer_viewCount');

    if (savedCount) {
      // NẾU ĐÃ CÓ (Khách bấm F5): Lấy thẳng số cũ ra hiện, KHÔNG cần gọi mạng nữa! 
      setViewCount(parseInt(savedCount, 10));
    } else {
      // MỞ TAB LẦN ĐẦU (hoặc tắt đi vào lại): Gọi API để CỘNG 1
      fetch(`https://api.counterapi.dev/v1/${namespace}/${key}/up`)
        .then(res => res.json())
        .then(data => {
          setViewCount(data.count); // Hiện số mới lên web
          // Tiện tay cất luôn con số này vào bộ nhớ Tab để nhỡ có F5 thì mang ra dùng
          sessionStorage.setItem('mathdigitizer_viewCount', data.count.toString()); 
        })
        .catch(err => console.error("Lỗi đếm truy cập:", err));
    }
  }, []);

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('MATH_DIGITIZER_API_KEY', apiKey);
    setShowKeyInput(false);
  };

  useEffect(() => {
    if (currentFile?.status === 'completed' && (window as any).MathJax) {
      setTimeout(() => {
        (window as any).MathJax.typesetPromise?.();
      }, 100);
    }
  }, [currentFile?.status]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type as FileType;
    setCurrentFile({ file, type, status: 'idle', progress: 0 });
  };

  const processFile = async () => {
    if (!currentFile) return;
    if (!apiKey) {
      alert("Vui lòng nhập API Key trước khi bắt đầu.");
      setShowKeyInput(true);
      return;
    }
    setIsProcessing(true);
    setCurrentFile(prev => prev ? { ...prev, status: 'processing', progress: 10 } : null);

    try {
      let images: string[] = [];
      let textData = "";

      if (currentFile.type === FileType.PDF) {
        images = await pdfToImages(currentFile.file);
        textData = "[PDF]";
      } else if (currentFile.type === FileType.DOCX) {
        const res = await docxToHtmlAndImages(currentFile.file);
        const div = document.createElement('div');
        div.innerHTML = res.html;
        textData = div.innerText;
        images = res.images.slice(0, 10);
      } else if (
        currentFile.type === FileType.PNG || 
        currentFile.type === FileType.JPEG || 
        currentFile.type === FileType.JPG
      ) {
        const imgUrl = await fileToDataUrl(currentFile.file);
        images = [imgUrl];
        textData = "[IMAGE]";
      }

      const result = await convertToLatexHtml(images, textData, apiKey);
      setCurrentFile(prev => prev ? { 
        ...prev, 
        status: 'completed', 
        progress: 100, 
        result,
        sourceImages: images 
      } : null);
    } catch (err: any) {
      if (err.message.includes("API Key không hợp lệ") || err.message.includes("401") || err.message.includes("403")) {
        localStorage.removeItem('MATH_DIGITIZER_API_KEY');
        setApiKey('');
        setShowKeyInput(true);
      }
      setCurrentFile(prev => prev ? { ...prev, status: 'error', error: err.message } : null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadWord = async () => {
    if (currentFile?.result?.latex && currentFile.sourceImages) {
      const fileName = currentFile.file.name.split('.')[0] + "_MathDigitized.doc";
      await downloadAsWord(
        currentFile.result.latex, 
        currentFile.sourceImages,
        currentFile.result.figures || [],
        fileName
      );
    }
  };

  const handleDownloadLatex = () => {
    if (currentFile?.result?.latex) {
      const fileName = currentFile.file.name.split('.')[0] + "_MathDigitized.tex";
      downloadAsLatex(currentFile.result.latex, fileName);
    }
  };

  const vbaCode = `Sub ExportToMathJaxHTML()
    ' VBA Script chuyển đổi Word chứa LaTeX sang HTML chuẩn MathJax
    ' Hỗ trợ giữ nguyên định dạng gạch chân và các ký hiệu (anh)
    
    Dim doc As Document
    Dim htmlContent As String
    Dim para As Paragraph
    Dim text As String
    Dim filePath As String
    
    Set doc = ActiveDocument
    
    htmlContent = "<html><head>" & vbCrLf & _
                  "<meta charset='utf-8'>" & vbCrLf & _
                  "<script src='https://polyfill.io/v3/polyfill.min.js?features=es6'></script>" & vbCrLf & _
                  "<script id='MathJax-script' async src='https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'></script>" & vbCrLf & _
                  "<style>" & vbCrLf & _
                  "  body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 40px; max-width: 800px; margin: auto; }" & vbCrLf & _
                  "  p { margin-bottom: 15px; }" & vbCrLf & _
                  "  .anh { color: blue; font-weight: bold; border: 1px dashed blue; padding: 2px 5px; }" & vbCrLf & _
                  "  u { text-underline-offset: 3px; }" & vbCrLf & _
                  "</style></head><body>" & vbCrLf
    
    For Each para In doc.Paragraphs
        text = para.Range.text
        text = Left(text, Len(text) - 1) ' Loại bỏ ký tự xuống dòng của Word
        
        If Len(Trim(text)) > 0 Then
            ' Xử lý ký tự đặc biệt HTML
            text = Replace(text, "&", "&amp;")
            text = Replace(text, "<", "&lt;")
            text = Replace(text, ">", "&gt;")
            
            ' Khôi phục lại các thẻ HTML đã bị encode (nếu có)
            text = Replace(text, "&lt;u&gt;", "<u>")
            text = Replace(text, "&lt;/u&gt;", "</u>")
            
            ' Style cho cụm (anh)
            text = Replace(text, "(anh)", "<span class='anh'>(anh)</span>")
            
            htmlContent = htmlContent & "<p>" & text & "</p>" & vbCrLf
        Else
            htmlContent = htmlContent & "<p>&nbsp;</p>" & vbCrLf
        End If
    Next para
    
    htmlContent = htmlContent & "</body></html>"
    
    filePath = doc.Path & "\\" & Left(doc.Name, InStrRev(doc.Name, ".") - 1) & "_Export.html"
    
    Dim fso As Object
    Set fso = CreateObject("Scripting.FileSystemObject")
    Dim oFile As Object
    Set oFile = fso.CreateTextFile(filePath, True, True) ' True cho Unicode
    oFile.WriteLine htmlContent
    oFile.Close
    
    MsgBox "Đã xuất file HTML chuẩn MathJax tại: " & vbCrLf & filePath, vbInformation, "MathDigitizer"
End Sub`;

  return (
    <div className="min-h-screen bg-[#fcfdfe] font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800">MathDigitizer <span className="text-indigo-600">SmartCrop</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precision Image Extraction Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {showKeyInput ? (
              <form onSubmit={handleSaveKey} className="flex items-center gap-2">
                <input 
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Nhập Gemini API Key..."
                  className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 font-mono"
                />
                <button 
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-indigo-700 transition-all"
                >
                  LƯU
                </button>
              </form>
            ) : (
              <div className="flex flex-col items-center gap-2">
  <button 
    onClick={() => setShowKeyInput(true)}
    className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${apiKey ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white hover:bg-black'}`}
  >
    {apiKey ? '● API READY' : 'NHẬP API KEY'}
  </button>
  
  {/* Dòng gợi ý nơi tạo API KEY */}
  {!apiKey && (
    <a 
      href="https://aistudio.google.com/app/apikey" 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-[10px] text-slate-400 hover:text-emerald-600 transition-colors underline decoration-dotted"
    >
      Chưa có Key? Lấy tại Google AI Studio
    </a>
  )}
</div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
              <h2 className="text-lg font-black text-slate-800 mb-6">Tải tài liệu</h2>
              <div 
                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input id="file-upload" type="file" className="hidden" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={handleFileUpload} />
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:text-indigo-600 group-hover:bg-white transition-all shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                </div>
  <div className="flex flex-col items-center justify-center text-center w-full px-2">
  {/* Dòng chính: Dùng whitespace-nowrap để ép không xuống dòng */}
  <span className="text-sm font-black text-slate-600 uppercase whitespace-nowrap">
    PDF, WORD HOẶC FILE ẢNH
  </span>
  
  {/* Dòng phụ: Căn giữa bên dưới */}
  <span className="text-xs font-bold text-slate-400 mt-1 block">
    (Nên dưới 10 trang)
  </span>
</div>
</div>

              {currentFile && (
                <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                      {currentFile.type.includes('image') ? '🖼️' : '📄'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{currentFile.file.name}</p>
                      <p className={`text-[10px] font-black uppercase tracking-wider ${currentFile.status === 'error' ? 'text-red-500' : 'text-indigo-600'}`}>
                        {currentFile.status === 'error' ? `LỖI: ${currentFile.error}` : currentFile.status}
                      </p>
                    </div>
                  </div>
                  {currentFile.status === 'idle' && (
                    <button 
                      onClick={processFile} 
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl text-sm font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      BẮT ĐẦU CHUYỂN ĐỔI
                    </button>
                  )}
                  {currentFile.status === 'processing' && (
                    <div className="py-2 text-center">
                      <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 animate-pulse w-full"></div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-black mt-3 uppercase tracking-widest">Đang phân tích & nhận diện hình vẽ...</p>
                    </div>
                  )}
                </div>
              )}
           </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-center">
        {/* Tiêu đề card - Căn giữa */}
        <h3 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 justify-center">
          <span className="w-2 h-5 bg-indigo-600 rounded-full"></span> NHÀ PHÁT TRIỂN
        </h3>
        
        {/* Nội dung thông tin - Căn giữa toàn bộ */}
        <div className="space-y-4 mb-8 text-center">
          {/* Dòng 1: Tên - Đỏ, Đậm, Không xuống dòng */}
          <p className="text-red-600 font-black text-base uppercase tracking-wide whitespace-nowrap">
            Giáo viên Toán: NGUYỄN VĂN HÀ
          </p>
          
          {/* Dòng 2: Trường - Xanh, Đậm, Không xuống dòng */}
          <p className="text-blue-600 font-black text-sm uppercase whitespace-nowrap">
            Trường THPT Yên Dũng số 2 - Bắc Ninh
          </p>
          
          {/* Dòng 3: Liên hệ - Xanh, Đậm */}
          <p className="text-blue-600 font-black text-sm">
            Liên hệ - Góp ý: 0988.948.882
          </p>
        </div>

        {/* Nút bấm - Căn giữa và co dãn theo chữ */}
        <div className="w-full flex flex-col items-center gap-3">
  {/* Nút 1: WEB RA ĐỀ ONLINE */}
  <div className="flex justify-center w-full">
    <a 
      href="https://smartedu-vn.vercel.app/" 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-200 hover:-translate-y-1 active:translate-y-0 min-w-[240px]"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
      WEB RA ĐỀ ONLINE
    </a>
  </div>

  {/* Nút 2: NHÓM HỖ TRỢ 24/7 (Zalo) */}
 <div className="flex justify-center w-full">
  <a 
    href="https://zalo.me/g/nlvywc450"
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-sky-100 hover:-translate-y-1 active:translate-y-0 min-w-[240px]"
  >
    
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="w-6 h-6"
    >
      <path fill="#2962FF" d="M24 4C12.95 4 4 11.94 4 21.5c0 5.66 3.15 10.65 8.01 13.79L10 44l8.16-4.37c1.86.44 3.82.67 5.84.67 11.05 0 20-7.94 20-17.5S35.05 4 24 4z"/>
      <path fill="#fff" d="M19.7 16h8.6v2.2l-5.7 7.6h5.7V28h-9.1v-2.2l5.7-7.6h-5.2z"/>
    </svg>

    NHÓM HỖ TRỢ 24/7
  </a>
</div>
</div>
      </div>
    </div>

          <div className="lg:col-span-8 flex flex-col min-h-[700px]">
            <div className="bg-white flex-grow rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
              <div className="border-b border-slate-100 px-8 py-5 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Kết quả sau chuyển đổi</h2>
                <div className="flex gap-2">
                  {currentFile?.status === 'completed' && (
                    <>
                      <button 
                        onClick={handleDownloadLatex}
                        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                      >
                        TẢI LATEX (.TEX)
                      </button>
                      <button 
                        onClick={handleDownloadWord}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95"
                      >
                        TẢI WORD (KÈM ẢNH)
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-grow p-10 overflow-auto font-mono text-[15px] leading-relaxed text-slate-800 whitespace-pre-wrap selection:bg-indigo-100">
                {!currentFile && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-40 italic">
                    <p className="text-sm font-black uppercase tracking-widest">Chưa có nội dung</p>
                  </div>
                )}
                
                {currentFile?.status === 'processing' && (
                  <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="w-10 h-10 border-[4px] border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  </div>
                )}

                {currentFile?.status === 'completed' && (
                  <div>
                    {currentFile.result?.latex.split('\n').map((line, idx) => {

  // bọc số nguyên và số dạng 1,2 vào $...$
  const formattedLine = line.replace(
    /(?<![\d$])(\d+(?:,\d+)?)(?![\d.])/g,
    '$$$1$'
  );

  return (
    <div key={idx} className="mb-1">
      {formattedLine.includes('[[FIG_') ? (
        <div className="my-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-[10px] font-black text-indigo-400 text-center uppercase">
          {formattedLine} (AI đã xác định vùng cắt cho hình này)
        </div>
      ) : formattedLine.includes('(anh)') ? (
        <div className="flex items-center gap-2">
          {formattedLine.split('(anh)').map((part, pIdx, arr) => (
            <React.Fragment key={pIdx}>
              {part}
              {pIdx < arr.length - 1 && (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[10px] font-black uppercase">
                  (anh)
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      ) : formattedLine}
    </div>
  );
})}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {showVBAModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Mã VBA Xuất HTML MathJax</h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">Copy mã này vào Module trong Word (Alt + F11)</p>
                </div>
                <button onClick={() => setShowVBAModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 text-slate-400"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="flex-grow overflow-auto p-8 bg-slate-50">
                <pre className="text-xs font-mono text-slate-700 whitespace-pre leading-relaxed">
                  {vbaCode}
                </pre>
              </div>
              <div className="p-8 border-t border-slate-100 flex justify-end gap-4">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(vbaCode);
                    alert("Đã copy mã VBA!");
                  }}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  COPY MÃ VBA
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="max-w-6xl mx-auto py-12 text-center"> 
        {/* Mình đã bỏ opacity-30 ở trên đi để Footer sáng rực rỡ hơn */}
        
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.6em]">
          MathDigitizer SmartCrop &bull; {new Date().getFullYear()}
        </p>       
        
        {/* Đoạn hiển thị lượt truy cập đã được căn giữa và làm lại layout */}
        {viewCount !== null && (
          <div className="flex items-center justify-center gap-2 mt-4 text-slate-300 text-xs font-semibold tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span>Lượt truy cập: {viewCount.toLocaleString()}</span>
          </div>
        )}
      </footer>
    </div>
  );
};

export default App;

utils

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

