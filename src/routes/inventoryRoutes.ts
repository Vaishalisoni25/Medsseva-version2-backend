import { Router } from 'express';
import {
  getInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  stockIn,
  stockOut,
  stockAdjustment,
  branchTransfer,
  getTransactions,
  getAnalytics,
  getSuppliers,
  createSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  receiveGRN,
} from '../controllers/inventoryController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/analytics', getAnalytics);
router.get('/transactions', getTransactions);
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.get('/purchase-orders', getPurchaseOrders);
router.post('/purchase-orders', createPurchaseOrder);
router.post('/grn', receiveGRN);
router.post('/stock-in', stockIn);
router.post('/stock-out', stockOut);
router.post('/adjustment', stockAdjustment);
router.post('/transfer', branchTransfer);
router.get('/', getInventoryItems);
router.get('/:id', getInventoryItem);
router.post('/', createInventoryItem);
router.put('/:id', updateInventoryItem);

export default router;