import { Router } from 'express';
import { getAllCities, addCity } from '../controllers/cityController';

const router = Router();

router.get('/', getAllCities);
router.post('/', addCity);

export default router;
