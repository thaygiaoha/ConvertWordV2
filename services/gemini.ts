
import { GoogleGenAI, Type } from "@google/genai";
import { ConversionResult } from "../types";

export const convertToLatexHtml = async (
  base64Images: string[],
  textContext: string = "",
  apiKey: string
): Promise<ConversionResult> => {
  const keyToUse = apiKey || process.env.API_KEY || '';
  if (!keyToUse) {
    throw new Error("API Key không được để trống. Vui lòng kiểm tra lại.");
  }
  const ai = new GoogleGenAI({ apiKey: keyToUse });
  const modelName = 'gemini-3-flash-preview';
  
  const imageParts = base64Images.map(base64 => {
    const parts = base64.split(',');
    const data = parts.length > 1 ? parts[1] : parts[0];
    return {
      inlineData: {
        mimeType: 'image/jpeg',
        data
      }
    };
  });

  try {
    const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [...imageParts, { text: `Dữ liệu gốc:\n${textContext}` }] },
    config: {
      systemInstruction: `Bạn là chuyên gia số hóa tài liệu toán học. Hãy gõ lại tài liệu theo các quy tắc sau:

1. ĐỊNH DẠNG TOÁN HỌC (MATHJAX COMPATIBLE):
   - Với phần văn bản chữ thường, không chứa công thức hay ký hiệu toán học thì gõ lại nguyên bản.
   - Tự động xuống dòng giống văn bản gốc , tuyệt đối không dùng lệnh \n.
   - Các số nguyên sau chữ câu (ví dụ: Câu 1.) hoặc sau chữ bài (ví dụ: Bài 5.) hoặc sau chữ ví dụ (ví dụ: Ví dụ 7.) không bọc trong $...$ mà gõ lại y nguyên nhé.
   - Sử dụng $...$ cho công thức nội dòng (inline) và \\[...\\] cho công thức khối (block).
   - Đảm bảo các ký hiệu toán học gõ chuẩn LaTeX (ví dụ: \\frac, \\sqrt, \\alpha...).
   - Toàn bộ các điểm (A, B, C, M, N, P...), các ký hiệu toán học trong văn bản PHẢI được bọc trong $...$ (ví dụ: $A$, $B$, $x$, $y$).
   - Các số nguyên độc lập được bọc trong $...$ (ví dụ: $3$, $2026$), các số thập phân dùng dấu phẩy phải bọc trong $...$ (ví dụ: $2,7$, $6,2$), các số thập phân dùng dấu chấm thì giữ nguyên dạng văn bản (ví dụ: 2.5 vẫn gõ lại 2.5, không bọc $...$).
   - Hệ phương trình dùng \\begin{cases}. Ký hiệu độ dùng ^\\circ.      
2. Quy tắc gạch chân: 
   - Khi gặp văn bản là một chữ cái A., B., C., D., a), b), c), d),... và có gạch chân thì dùng lệnh \\underline{...} trong LaTeX để bọc chữ cái đó nếu bản gốc không có, KHÔNG có gạch chân tuyệt đối không dùng lệnh \\underline{...} trong LaTeX để bọc.  
   - Phần văn bản nào không gạch chân tuyệt đối không dùng lệnh \\underline{...} trong LaTeX .
3. VỚI HÌNH ẢNH:
   - Hãy bỏ qua khi thấy hình vẽ, đồ thị, bảng biến thiên, hoặc bảng số liệu (tức là không gõ lại, không lưu lại hình ảnh, đồ thị, bảng biểu, biểu đồ, bảng biến thiên đó) .
4. CẤU TRÚC VĂN BẢN:
   - Gõ lại y nguyên toàn bộ văn bản (trừ Header và Footer), giữ đúng vị trí và định dạng như bản gốc.
   - Giữ nguyên Câu 1, Câu 2... và các phương án A, B, C, D; 
   - Nếu ngay sau Câu 1, Câu 2,... có các thẻ [...] thì gõ lại y nguyên (Ví dụ: Câu 1. [1001.a] thì giữ nguyên Câu 1. [1001.a])
   - Quan trọng : Khi gặp thẻ dạng <key=...> thì gõ lại văn bản y nguyên nhé, không bọc số trong $...& (Ví dụ: gõ lại y giữ nguyên <key=2.5>)
   - Còn lại không bọc bất kỳ văn bản nào, đặc biệt không dùng \textbf{...} để bọc nhé. 
   - Xuống dòng gõ bình thường, không dùng \n nhé

Trả về JSON theo schema cung cấp.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          latex: { type: Type.STRING },
          html: { type: Type.STRING },
          figures: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "ID tương ứng trong văn bản, ví dụ FIG_0" },
                source_index: { type: Type.INTEGER, description: "Chỉ số ảnh đầu vào (0, 1, 2...)" },
                box_2d: { 
                  type: Type.ARRAY, 
                  items: { type: Type.NUMBER },
                  description: "[ymin, xmin, ymax, xmax] từ 0-1000"
                }
              },
              required: ["id", "source_index", "box_2d"]
            }
          }
        },
        required: ["latex", "html"]
      },
      temperature: 0,
    }
  });

    try {
      return JSON.parse(response.text || "{}") as ConversionResult;
    } catch (parseError) {
      console.error("Lỗi phân tích JSON:", parseError);
      throw new Error("Kết quả từ AI không đúng định dạng. Vui lòng thử lại.");
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const msg = error?.message || "Lỗi không xác định từ Gemini API";
    if (msg.includes("API_KEY_INVALID")) {
      throw new Error("API Key không hợp lệ. Vui lòng kiểm tra lại.");
    }
    if (msg.includes("quota") || msg.includes("429")) {
      throw new Error("Hết hạn mức (Quota) hoặc bị giới hạn tốc độ. Vui lòng thử lại sau.");
    }
    throw new Error(msg);
  }
};
