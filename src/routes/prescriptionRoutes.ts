import { Router } from 'express';
import { prescriptionController } from '../controllers/prescriptionController';
import { authenticate } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/rbacMiddleware';
import { prescriptionUpload } from '../middlewares/upload';

const router = Router();

const handleMulterError = (req: any, res: any, next: any) => {
  prescriptionUpload(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 20 MB limit.' });
      }
      if (err.message?.startsWith('INVALID_FILE_TYPE:')) {
        return res.status(400).json({ message: err.message.split(':')[1] });
      }
      return res.status(400).json({ message: err.message || 'File upload error.' });
    }
    next();
  });
};

router.post('/upload', authenticate, handleMulterError, prescriptionController.upload);
router.get('/my', authenticate, prescriptionController.getMyPrescriptions);
router.get('/:id', authenticate, prescriptionController.getById);
router.delete('/:id', authenticate, prescriptionController.deletePrescription);

router.get('/', authenticate, requirePermission('prescriptions.view'), prescriptionController.getAllForAdmin);
router.patch('/:id/status', authenticate, requirePermission('prescriptions.update'), prescriptionController.updateStatus);

export default router;