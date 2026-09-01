import { Router } from 'express';
import { getAllCategories, createCategory } from '../controllers/categoryController';

const router = Router();

router.get('/', getAllCategories);
router.post('/', createCategory);

export default router;
