import { Router } from 'express';
import { getAddresses, addAddress, deleteAddress } from '../controllers/addressController';

const router = Router();

router.get('/', getAddresses);
router.post('/', addAddress);
router.delete('/:id', deleteAddress);

export default router;
