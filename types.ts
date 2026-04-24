
export interface FigureDetection {
  id: string;          // Khớp với thẻ [[FIG_X]] trong văn bản
  source_index: number; // Chỉ số ảnh gốc (trang nào)
  box_2d: number[];     // Tọa độ [ymin, xmin, ymax, xmax] (0-1000)
}

export interface ConversionResult {
  latex: string;
  html: string;
  figures?: FigureDetection[];
}

export enum FileType {
  PDF = 'application/pdf',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  PNG = 'image/png',
  JPEG = 'image/jpeg',
  JPG = 'image/jpg'
}

export interface ProcessingFile {
  file: File;
  type: FileType;
  status: 'idle' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: ConversionResult;
  error?: string;
  sourceImages?: string[];
}
