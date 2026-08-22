import { Router } from 'express';
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} from '../controllers/doctorController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Public/Authenticated list of doctors for report dropdowns and booking
router.get('/', getDoctors);
router.get('/:id', getDoctorById);

// Admin / Partner protected actions
router.post('/', authenticate, createDoctor);
router.put('/:id', authenticate, updateDoctor);
router.delete('/:id', authenticate, deleteDoctor);

export default router;
