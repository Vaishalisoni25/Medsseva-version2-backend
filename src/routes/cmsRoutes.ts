import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/authMiddleware';
import { requirePermission } from '../middlewares/rbacMiddleware';
import {
  getBanners, createBanner, updateBanner, deleteBanner, uploadBannerImage,
  getConfig, updateConfig,
  getAlerts, upsertAlert, deleteAlert,
  getPages, updatePage,
  getCmsAuditLogs,
} from '../controllers/cmsController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);
router.use(requirePermission('cms:manage'));

router.get('/banners', getBanners);
router.post('/banners', createBanner);
router.put('/banners/:id', updateBanner);
router.delete('/banners/:id', deleteBanner);
router.post('/banners/upload-image', upload.single('image'), uploadBannerImage);

router.get('/config', getConfig);
router.put('/config', updateConfig);

router.get('/alerts', getAlerts);
router.post('/alerts', upsertAlert);
router.delete('/alerts/:id', deleteAlert);

router.get('/pages', getPages);
router.put('/pages/:slug', updatePage);

router.get('/audit-logs', getCmsAuditLogs);

export default router;