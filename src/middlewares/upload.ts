import multer from 'multer';
import { cloudinary } from '../config/cloudinary';
import { Readable } from 'stream';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx'];

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`INVALID_FILE_TYPE:Unsupported file type. Allowed: JPG, PNG, WEBP, PDF, DOC, DOCX`));
  }
  cb(null, true);
};

export const prescriptionUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
}).single('file');

const avatarFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
  const allowedExt = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowedMime.includes(file.mimetype) || !allowedExt.includes(ext)) {
    return cb(new Error('INVALID_FILE_TYPE:Only JPG, PNG, and WEBP images are allowed for profile photos.'));
  }
  cb(null, true);
};

export const avatarUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: avatarFileFilter,
}).single('avatar');

export const uploadToCloudinary = (buffer: Buffer, originalName: string, mimeType: string, folder = 'medseva/prescriptions'): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
    const resourceType = isImage ? 'image' : 'raw';

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary upload failed'));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

export { cloudinary };