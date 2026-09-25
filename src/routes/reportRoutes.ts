import { Router } from 'express';
import {
  createReport,
  updateReportDraft,
  finalizeReport,
  sendReport,
  verifyReport,
  getMyReports,
  getAllReports,
  getReportById,
  getBookingsForReport,
  savePdfUrl,
  uploadReportPdf,
  getPublicReportVerification,
} from '../controllers/reportController';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.get('/:id/verify', getPublicReportVerification);
router.get('/my-reports', authenticate, getMyReports);
router.get('/bookings-for-report', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), getBookingsForReport);
router.get('/', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), getAllReports);
router.get('/:id', authenticate, getReportById);
router.post('/', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), createReport);
router.patch('/:id/draft', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), updateReportDraft);
router.patch('/:id/verify', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), verifyReport);
router.patch('/:id/finalize', authenticate, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), finalizeReport);
router.patch('/:id/send', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), sendReport);
router.patch('/:id/pdf-url', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), savePdfUrl);
router.post('/:id/upload-pdf', authenticate, authorizeRoles('ADMIN', 'PATHOLOGIST', 'SUPER_ADMIN', 'PATHOLOGY_PARTNER'), upload.single('pdf'), uploadReportPdf);

export default router;