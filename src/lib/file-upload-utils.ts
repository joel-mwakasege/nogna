import { supabase } from './supabase';

export interface UploadedFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getFileIcon(fileType: string): string {
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📄';
  if (fileType.includes('word')) return '📝';
  return '📎';
}

export async function uploadFile(
  file: File,
  bucket: 'expense-attachments' | 'deposit-attachments' | 'payment-attachments',
  recordId: string
): Promise<string> {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error('File type not allowed. Please upload an image, PDF, or Word document.');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size exceeds 10MB limit.');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${recordId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  return fileName;
}

export async function deleteFile(
  bucket: 'expense-attachments' | 'deposit-attachments' | 'payment-attachments',
  filePath: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    throw error;
  }
}

export async function getFileUrl(
  bucket: 'expense-attachments' | 'deposit-attachments' | 'payment-attachments',
  filePath: string
): Promise<string> {
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function downloadFile(
  bucket: 'expense-attachments' | 'deposit-attachments' | 'payment-attachments',
  filePath: string
): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(filePath);

  if (error) {
    throw error;
  }

  return data;
}
