import { Router } from 'express';
import {
  getExpenses,
  getExpenseSummary,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseCategories,
} from '../controllers/expenseController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Allow authenticated users to view & manage expenses
router.use(authenticate);

router.get('/categories', getExpenseCategories);
router.get('/summary', getExpenseSummary);
router.get('/', getExpenses);
router.get('/:id', getExpenseById);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
