import { Router } from 'express';
import multer from 'multer';
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  createDoctorSamplePickupRequest,
  doctorDirectSampleHandover,
  uploadDoctorSignature,
} from '../controllers/doctorController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

const signatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: Express.Multer.File, cb: any) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const ext = file.originalname.split('.').pop()?.toLowerCase() || '';
    if (!allowed.includes(file.mimetype) || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      return cb(new Error('INVALID_FILE_TYPE:Only JPG, JPEG, PNG, and WEBP images are allowed for doctor signature.'));
    }
    cb(null, true);
  },
}).single('signature');

router.post(
  '/upload-signature',
  (req, res, next) => {
    signatureUpload(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Signature file upload error' });
      }
      next();
    });
  },
  uploadDoctorSignature
);

router.get('/', getDoctors);
router.get('/:id', getDoctorById);
router.post('/pickup-request', createDoctorSamplePickupRequest);
router.post('/direct-handover', doctorDirectSampleHandover);

// Admin / Partner protected actions
router.post('/', createDoctor);
router.put('/:id', updateDoctor);
router.delete('/:id', deleteDoctor);

export default router;
