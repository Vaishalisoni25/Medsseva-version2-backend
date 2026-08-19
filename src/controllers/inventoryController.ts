import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getInventoryItems = async (req: Request, res: Response) => {
  try {
    const { branchId, itemType, status } = req.query;
    const now = new Date();

    const where: any = { isActive: true };
    if (branchId) where.branchId = branchId as string;
    if (itemType) where.itemType = itemType as string;
    if (status === 'low') where.currentStock = { lte: prisma.inventoryItem.fields.minThreshold };
    if (status === 'expired') where.expiryDate = { lt: now };

    const items = await prisma.inventoryItem.findMany({
      where,
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = items.map(item => ({
      ...item,
      stockStatus:
        item.currentStock <= 0
          ? 'OUT_OF_STOCK'
          : item.currentStock <= item.minThreshold
          ? 'LOW_STOCK'
          : item.expiryDate && item.expiryDate < now
          ? 'EXPIRED'
          : 'IN_STOCK',
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch inventory', details: error.message });
  }
};

export const getInventoryItem = async (req: Request, res: Response) => {
  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id: req.params.id },
      include: { supplier: true, transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch item', details: error.message });
  }
};

export const createInventoryItem = async (req: Request, res: Response) => {
  try {
    const existing = await prisma.inventoryItem.findUnique({ where: { sku: req.body.sku } });
    if (existing) return res.status(409).json({ error: 'SKU already exists' });

    const item = await prisma.inventoryItem.create({ data: req.body });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create item', details: error.message });
  }
};

export const updateInventoryItem = async (req: Request, res: Response) => {
  try {
    const item = await prisma.inventoryItem.update({ where: { id: req.params.id }, data: req.body });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update item', details: error.message });
  }
};

export const stockIn = async (req: Request, res: Response) => {
  try {
    const { inventoryItemId, quantity, reason, referenceNumber, remarks, branchId } = req.body;
    if (!inventoryItemId || !quantity || quantity <= 0)
      return res.status(400).json({ error: 'inventoryItemId and quantity are required' });

    const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const quantityBefore = item.currentStock;
    const quantityAfter = quantityBefore + quantity;

    const [updated] = await prisma.$transaction([
      prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: quantityAfter } }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId,
          transactionType: 'STOCK_IN',
          quantity,
          quantityBefore,
          quantityAfter,
          reason,
          referenceNumber,
          remarks,
          performedById: (req as any).user?.id,
          branchId,
        },
      }),
    ]);

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Stock in failed', details: error.message });
  }
};

export const stockOut = async (req: Request, res: Response) => {
  try {
    const { inventoryItemId, quantity, reason, referenceNumber, remarks, branchId } = req.body;
    if (!inventoryItemId || !quantity || quantity <= 0)
      return res.status(400).json({ error: 'inventoryItemId and quantity are required' });

    const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.currentStock < quantity) return res.status(400).json({ error: 'Insufficient stock' });

    const quantityBefore = item.currentStock;
    const quantityAfter = quantityBefore - quantity;

    const [updated] = await prisma.$transaction([
      prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: quantityAfter } }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId,
          transactionType: 'STOCK_OUT',
          quantity,
          quantityBefore,
          quantityAfter,
          reason,
          referenceNumber,
          remarks,
          performedById: (req as any).user?.id,
          branchId,
        },
      }),
    ]);

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Stock out failed', details: error.message });
  }
};

export const stockAdjustment = async (req: Request, res: Response) => {
  try {
    const { inventoryItemId, quantity, transactionType, reason, referenceNumber, remarks, branchId } = req.body;
    const validTypes = ['ADJUSTMENT', 'DAMAGED', 'EXPIRED'];
    if (!validTypes.includes(transactionType))
      return res.status(400).json({ error: 'Invalid transaction type' });

    const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const quantityBefore = item.currentStock;
    const quantityAfter = Math.max(0, quantityBefore - quantity);

    const [updated] = await prisma.$transaction([
      prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: quantityAfter } }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId,
          transactionType,
          quantity,
          quantityBefore,
          quantityAfter,
          reason,
          referenceNumber,
          remarks,
          performedById: (req as any).user?.id,
          branchId,
        },
      }),
    ]);

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Adjustment failed', details: error.message });
  }
};

export const branchTransfer = async (req: Request, res: Response) => {
  try {
    const { inventoryItemId, quantity, fromBranchId, toBranchId, reason, referenceNumber, remarks } = req.body;

    const item = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.currentStock < quantity) return res.status(400).json({ error: 'Insufficient stock for transfer' });

    const quantityBefore = item.currentStock;
    const quantityAfter = quantityBefore - quantity;

    await prisma.$transaction([
      prisma.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: quantityAfter } }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId,
          transactionType: 'TRANSFER_OUT',
          quantity,
          quantityBefore,
          quantityAfter,
          reason,
          referenceNumber,
          remarks,
          performedById: (req as any).user?.id,
          branchId: fromBranchId,
        },
      }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryItemId,
          transactionType: 'TRANSFER_IN',
          quantity,
          quantityBefore: 0,
          quantityAfter: quantity,
          reason,
          referenceNumber,
          remarks,
          performedById: (req as any).user?.id,
          branchId: toBranchId,
        },
      }),
    ]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Transfer failed', details: error.message });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { inventoryItemId, branchId, type } = req.query;
    const where: any = {};
    if (inventoryItemId) where.inventoryItemId = inventoryItemId as string;
    if (branchId) where.branchId = branchId as string;
    if (type) where.transactionType = type as string;

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: { inventoryItem: { select: { name: true, sku: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
  }
};

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysLater = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [total, lowStock, expired, expiringSoon, expiringIn60, allItems] = await Promise.all([
      prisma.inventoryItem.count({ where: { isActive: true } }),
      prisma.inventoryItem.count({ where: { isActive: true, currentStock: { lte: 0 } } }),
      prisma.inventoryItem.count({ where: { isActive: true, expiryDate: { lt: now } } }),
      prisma.inventoryItem.count({ where: { isActive: true, expiryDate: { gte: now, lte: thirtyDaysLater } } }),
      prisma.inventoryItem.count({ where: { isActive: true, expiryDate: { gte: now, lte: sixtyDaysLater } } }),
      prisma.inventoryItem.findMany({ where: { isActive: true }, select: { currentStock: true, purchaseCost: true, itemType: true, minThreshold: true } }),
    ]);

    const lowStockItems = allItems.filter(i => i.currentStock > 0 && i.currentStock <= i.minThreshold).length;
    const totalValue = allItems.reduce((sum, i) => sum + (i.currentStock * (i.purchaseCost || 0)), 0);

    const mostConsumed = await prisma.inventoryTransaction.groupBy({
      by: ['inventoryItemId'],
      where: { transactionType: { in: ['STOCK_OUT', 'AUTO_CONSUMED'] } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const mostConsumedWithNames = await Promise.all(
      mostConsumed.map(async (m) => {
        const item = await prisma.inventoryItem.findUnique({ where: { id: m.inventoryItemId }, select: { name: true, itemType: true } });
        return { ...m, item };
      })
    );

    res.json({
      total,
      lowStock: lowStockItems,
      outOfStock: lowStock,
      expired,
      expiringSoon,
      expiringIn60,
      totalValue: Math.round(totalValue),
      mostConsumed: mostConsumedWithNames,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
};

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch suppliers', details: error.message });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const supplier = await prisma.supplier.create({ data: req.body });
    res.status(201).json(supplier);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create supplier', details: error.message });
  }
};

export const getPurchaseOrders = async (req: Request, res: Response) => {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      include: { supplier: true, items: { include: { inventoryItem: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch purchase orders', details: error.message });
  }
};

export const createPurchaseOrder = async (req: Request, res: Response) => {
  try {
    const { supplierId, items, expectedDelivery } = req.body;
    if (!supplierId || !items?.length)
      return res.status(400).json({ error: 'supplierId and items are required' });

    const poNumber = `PO-${Date.now()}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
        createdById: (req as any).user?.id,
        items: {
          create: items.map((i: { inventoryItemId: string; quantity: number }) => ({
            inventoryItemId: i.inventoryItemId,
            quantity: i.quantity,
          })),
        },
      },
      include: { supplier: true, items: { include: { inventoryItem: true } } },
    });

    res.status(201).json(po);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create purchase order', details: error.message });
  }
};

export const receiveGRN = async (req: Request, res: Response) => {
  try {
    const { purchaseOrderId, items } = req.body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { items: true },
    });
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'CANCELLED') return res.status(400).json({ error: 'PO is cancelled' });

    await prisma.$transaction(async (tx) => {
      for (const received of items) {
        const poItem = po.items.find(i => i.inventoryItemId === received.inventoryItemId);
        if (!poItem) continue;

        const item = await tx.inventoryItem.findUnique({ where: { id: received.inventoryItemId } });
        if (!item) continue;

        const quantityBefore = item.currentStock;
        const quantityAfter = quantityBefore + received.receivedQty;

        await tx.inventoryItem.update({ where: { id: received.inventoryItemId }, data: { currentStock: quantityAfter } });

        await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: received.inventoryItemId,
            transactionType: 'STOCK_IN',
            quantity: received.receivedQty,
            quantityBefore,
            quantityAfter,
            reason: 'GRN',
            referenceNumber: po.poNumber,
            performedById: (req as any).user?.id,
          },
        });

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { receivedQty: poItem.receivedQty + received.receivedQty },
        });
      }

      const updatedPO = await tx.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { items: true } });
      const allReceived = updatedPO!.items.every(i => i.receivedQty >= i.quantity);

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: { status: allReceived ? 'RECEIVED' : 'PARTIAL', receivedDate: new Date() },
      });
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'GRN failed', details: error.message });
  }
};

export const autoConsumeForTest = async (testId: string, bookingCode: string, performedById?: string) => {
  try {
    const rules = await prisma.testConsumptionRule.findMany({
      where: { testId, isActive: true },
      include: { inventoryItem: true },
    });

    for (const rule of rules) {
      const item = rule.inventoryItem;
      if (item.currentStock < rule.quantityPerTest) continue;

      const quantityBefore = item.currentStock;
      const quantityAfter = quantityBefore - rule.quantityPerTest;

      await prisma.$transaction([
        prisma.inventoryItem.update({ where: { id: item.id }, data: { currentStock: quantityAfter } }),
        prisma.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            transactionType: 'AUTO_CONSUMED',
            quantity: rule.quantityPerTest,
            quantityBefore,
            quantityAfter,
            reason: 'Auto consumption',
            referenceNumber: bookingCode,
            performedById,
          },
        }),
      ]);
    }
  } catch (error: any) {
    console.error('Auto consume error:', error.message);
  }
};