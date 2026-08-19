import { Router } from 'express';
import { getAllPackages, createPackage, getPackageById } from '../controllers/packageController';

const router = Router();

router.get('/', getAllPackages);
router.get('/:id', getPackageById);
router.post('/', createPackage);

export default router;
