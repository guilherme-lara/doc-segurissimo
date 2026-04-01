/**
 * File Security & Compression — Zero Trust Upload Pipeline
 *
 * 1. Allowlist estrita de MIME types (extensão + magic bytes)
 * 2. Compressão client-side de imagens via browser-image-compression
 * 3. Limite de 5MB para PDFs
 * 4. Rejeição de arquivos disfarçados (.exe renomeado para .pdf)
 */

import imageCompression from "browser-image-compression";

// Allowlist estrita de tipos aceitos
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];

// Blocklist global de extensões perigosas — Zero Trust
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".msi", ".sh", ".zip", ".rar", ".cmd", ".com", ".scr", ".pif", ".vbs", ".js", ".ws"];

/**
 * Verifica se o arquivo é de um tipo perigoso (blocklist)
 * Retorna string de erro se bloqueado, null se OK
 */
export function checkBlockedExtension(fileName: string): string | null {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return `Formato de arquivo não permitido por motivos de segurança. Extensão "${ext}" bloqueada.`;
  }
  return null;
}

// Magic bytes para validação real do conteúdo
const MAGIC_BYTES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header
  "application/pdf": [[0x25, 0x50, 0x44, 0x46]], // %PDF
};

const PDF_MAX_SIZE_MB = 5;
const IMAGE_MAX_SIZE_MB = 1;
const IMAGE_MAX_WIDTH_PX = 1920;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  processedFile?: File;
}

/**
 * Lê os primeiros bytes do arquivo para verificar magic bytes
 */
async function readMagicBytes(file: File, count: number): Promise<number[]> {
  const slice = file.slice(0, count);
  const buffer = await slice.arrayBuffer();
  return Array.from(new Uint8Array(buffer));
}

/**
 * Verifica se os magic bytes do arquivo correspondem ao tipo declarado
 */
async function validateMagicBytes(file: File, declaredType: string): Promise<boolean> {
  const signatures = MAGIC_BYTES[declaredType];
  if (!signatures) return false;

  const maxLen = Math.max(...signatures.map((s) => s.length));
  const fileBytes = await readMagicBytes(file, maxLen);

  return signatures.some((sig) =>
    sig.every((byte, i) => fileBytes[i] === byte)
  );
}

/**
 * Pipeline completo de validação e processamento de arquivo
 *
 * 1. Verifica extensão contra allowlist
 * 2. Verifica MIME type contra allowlist
 * 3. Valida magic bytes (anti-spoofing)
 * 4. Para imagens: comprime client-side (max 1MB, 1920px)
 * 5. Para PDFs: rejeita se > 5MB
 */
export async function validateAndProcessFile(file: File): Promise<FileValidationResult> {
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf("."));

  // 1. Validar extensão
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Tipo de arquivo não permitido (${extension}). Aceitos: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  // 2. Validar MIME type
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.includes(mimeType as any)) {
    return {
      valid: false,
      error: `Tipo de arquivo inválido (${mimeType}). Envie apenas imagens (JPG, PNG, WebP) ou PDF.`,
    };
  }

  // 3. Validar magic bytes (anti-spoofing)
  const magicValid = await validateMagicBytes(file, mimeType);
  if (!magicValid) {
    return {
      valid: false,
      error: "Arquivo corrompido ou disfarçado. O conteúdo não corresponde ao tipo declarado. 🚫",
    };
  }

  // 4. Processar por tipo
  if (mimeType === "application/pdf") {
    // PDF: apenas limite de tamanho
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > PDF_MAX_SIZE_MB) {
      return {
        valid: false,
        error: `PDF muito grande (${sizeMb.toFixed(1)}MB). O limite é ${PDF_MAX_SIZE_MB}MB. Use ferramentas como iLovePDF ou SmallPDF para reduzir o tamanho. 📄`,
      };
    }
    return { valid: true, processedFile: file };
  }

  // Imagem: comprimir client-side
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: IMAGE_MAX_SIZE_MB,
      maxWidthOrHeight: IMAGE_MAX_WIDTH_PX,
      useWebWorker: true,
      fileType: mimeType as string,
      preserveExif: false,
    });

    // Criar File com mesmo nome (imageCompression retorna Blob)
    const processedFile = new File([compressed], file.name, {
      type: compressed.type,
      lastModified: Date.now(),
    });

    console.log(
      `[file-security] Imagem comprimida: ${(file.size / 1024).toFixed(0)}KB → ${(processedFile.size / 1024).toFixed(0)}KB (${((1 - processedFile.size / file.size) * 100).toFixed(0)}% redução)`
    );

    return { valid: true, processedFile };
  } catch (err) {
    console.error("[file-security] Erro na compressão:", err);
    // Se compressão falhar, usar original (desde que respeite limite do plano)
    return { valid: true, processedFile: file };
  }
}
