import { Router } from 'express';
import {
  getReferenceLabs,
  createReferenceLab,
  updateReferenceLab,
  deleteReferenceLab,
  getOutsourcedSamples,
  getOutsourceSummary,
  createOutsourceSample,
  updateOutsourceSample,
  deleteOutsourceSample,
} from '../controllers/outsourceController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Allow authenticated users to view & manage outsource samples
router.use(authenticate);

// Reference Labs Routes
router.get('/labs', getReferenceLabs);
router.post('/labs', createReferenceLab);
router.put('/labs/:id', updateReferenceLab);
router.delete('/labs/:id', deleteReferenceLab);

// Outsource Samples Routes
router.get('/summary', getOutsourceSummary);
router.get('/samples', getOutsourcedSamples);
router.post('/samples', createOutsourceSample);
router.patch('/samples/:id', updateOutsourceSample);
router.put('/samples/:id', updateOutsourceSample);
router.delete('/samples/:id', deleteOutsourceSample);

export default router;
