import ImageKit from '@imagekit/nodejs';
import 'dotenv/config';

let client: ImageKit | null = null;

export const getImageKitClient = (): ImageKit => {
  if (!client) {
    client = new ImageKit({
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    });
  }
  return client;
};

// Proxy export for direct property access
export const imagekit = new Proxy({} as ImageKit, {
  get(_, prop) {
    return (getImageKitClient() as any)[prop];
  },
});

export const uploadToImageKit = async (
  file: Buffer | string,
  fileName: string,
  folder = '/medseva'
): Promise<{ secure_url: string; public_id: string }> => {
  const fileData = Buffer.isBuffer(file) ? file.toString('base64') : file;
  const normalizedFolder = folder.startsWith('/') ? folder : `/${folder}`;
  const ik = getImageKitClient();

  const res = await ik.files.upload({
    file: fileData,
    fileName,
    folder: normalizedFolder,
  });

  return {
    secure_url: res.url || '',
    public_id: res.fileId || '',
  };
};

export const deleteFromImageKit = async (fileId: string): Promise<void> => {
  if (!fileId) return;
  try {
    const ik = getImageKitClient();
    await ik.files.delete(fileId);
  } catch (err: any) {
    console.warn(`[ImageKit] Failed to delete file ${fileId}:`, err?.message || err);
  }
};

export default imagekit;
