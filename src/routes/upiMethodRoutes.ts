import { Router } from 'express';
import { getUpiMethods, addUpiMethod, setPrimaryUpi, removeUpiMethod } from '../controllers/upiMethodController';

const router = Router();

router.get('/', getUpiMethods);
router.post('/', addUpiMethod);
router.patch('/:id/primary', setPrimaryUpi);
router.delete('/:id', removeUpiMethod);

export default router;