import { Router } from 'express';
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  createDoctorSamplePickupRequest,
  doctorDirectSampleHandover,
} from '../controllers/doctorController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', getDoctors);
router.get('/:id', getDoctorById);
router.post('/pickup-request', createDoctorSamplePickupRequest);
router.post('/direct-handover', doctorDirectSampleHandover);

// Admin / Partner protected actions
router.post('/', createDoctor);
router.put('/:id', updateDoctor);
router.delete('/:id', deleteDoctor);

export default router;
