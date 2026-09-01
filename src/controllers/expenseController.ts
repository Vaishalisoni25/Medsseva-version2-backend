import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

export const EXPENSE_CATEGORIES = [
  { key: 'LAB_REAGENTS', label: 'Lab Reagents & Chemicals', icon: 'TestTube' },
  { key: 'EQUIPMENT_MAINTENANCE', label: 'Equipment & Calibration', icon: 'Wrench' },
  { key: 'STAFF_SALARY', label: 'Staff Salary & Wages', icon: 'Users' },
  { key: 'UTILITIES', label: 'Electricity & Utilities', icon: 'Zap' },
  { key: 'RENT', label: 'Lab Facility & Rent', icon: 'Building' },
  { key: 'OFFICE_SUPPLIES', label: 'Office Supplies & Stationery', icon: 'FileText' },
  { key: 'MARKETING', label: 'Marketing & Promotion', icon: 'Megaphone' },
  { key: 'LOGISTICS', label: 'Sample Transport & Logistics', icon: 'Truck' },
  { key: 'MISCELLANEOUS', label: 'Miscellaneous / Other', icon: 'Receipt' },
];

export const getExpenseCategories = (_req: Request, res: Response) => {
  res.json(EXPENSE_CATEGORIES);
};

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const {
      search,
      category,
      paymentMethod,
      startDate,
      endDate,
      period,
      page = '1',
      limit = '50',
    } = req.query as any;

    const pageNum = parseInt(page, 10) || 1;
    const take = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * take;

    const now = new Date();
    let dateFilter: any = {};

    if (startDate && endDate) {
      dateFilter = {
        expenseDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };
    } else if (period === 'TODAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      dateFilter = { expenseDate: { gte: startOfDay, lte: endOfDay } };
    } else if (period === 'THIS_MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      dateFilter = { expenseDate: { gte: startOfMonth } };
    } else if (period === 'THIS_YEAR') {
      const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      dateFilter = { expenseDate: { gte: startOfYear } };
    }

    try {
      if ((prisma as any).expense) {
        const where: any = {
          ...dateFilter,
          ...(category && category !== 'ALL' && { category }),
          ...(paymentMethod && paymentMethod !== 'ALL' && { paymentMethod }),
          ...(search && {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { vendorName: { contains: search, mode: 'insensitive' } },
              { referenceNo: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
            ],
          }),
        };

        const [expenses, total] = await Promise.all([
          (prisma as any).expense.findMany({
            where,
            orderBy: { expenseDate: 'desc' },
            skip,
            take,
            include: {
              createdBy: {
                select: { id: true, name: true, email: true, mobile: true },
              },
            },
          }),
          (prisma as any).expense.count({ where }),
        ]);

        return res.json({
          expenses,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / take),
        });
      }
    } catch {
      // fallback to raw query
    }

    const expenses: any = await prisma.$queryRaw`
      SELECT * FROM "Expense"
      ORDER BY "expenseDate" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const countRes: any = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "Expense"
    `;

    res.json({
      expenses: expenses || [],
      total: countRes?.[0]?.count || 0,
      page: pageNum,
      totalPages: Math.ceil((countRes?.[0]?.count || 0) / take),
    });
  } catch (error: any) {
    console.error('Failed to get expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses', details: error.message });
  }
};

export const getExpenseSummary = async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0);

    let allExpenses: any[] = [];

    try {
      if ((prisma as any).expense) {
        allExpenses = await (prisma as any).expense.findMany({
          orderBy: { expenseDate: 'desc' },
        });
      } else {
        allExpenses = (await prisma.$queryRaw`
          SELECT * FROM "Expense" ORDER BY "expenseDate" DESC
        `) as any[];
      }
    } catch {
      allExpenses = (await prisma.$queryRaw`
        SELECT * FROM "Expense" ORDER BY "expenseDate" DESC
      `) as any[];
    }

    let todayTotal = 0;
    let monthTotal = 0;
    let yearTotal = 0;
    let allTimeTotal = 0;
    const categoryTotals: Record<string, { totalAmount: number; count: number }> = {};

    for (const exp of allExpenses) {
      const expDate = new Date(exp.expenseDate);
      const amt = Number(exp.amount) || 0;

      allTimeTotal += amt;

      if (expDate >= startOfToday && expDate <= endOfToday) {
        todayTotal += amt;
      }
      if (expDate >= startOfMonth) {
        monthTotal += amt;
      }
      if (expDate >= startOfYear) {
        yearTotal += amt;
      }

      const cat = exp.category || 'MISCELLANEOUS';
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { totalAmount: 0, count: 0 };
      }
      categoryTotals[cat].totalAmount += amt;
      categoryTotals[cat].count += 1;
    }

    const categoryBreakdown = Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      totalAmount: data.totalAmount,
      count: data.count,
    }));

    res.json({
      todayTotal,
      monthTotal,
      yearTotal,
      allTimeTotal,
      totalCount: allExpenses.length,
      categoryBreakdown,
      recentExpenses: allExpenses.slice(0, 5),
    });
  } catch (error: any) {
    console.error('Failed to get expense summary:', error);
    res.status(500).json({ error: 'Failed to fetch expense summary', details: error.message });
  }
};

export const getExpenseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let expense: any = null;

    try {
      if ((prisma as any).expense) {
        expense = await (prisma as any).expense.findUnique({
          where: { id },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
        });
      }
    } catch {
      // fallback
    }

    if (!expense) {
      const rows: any = await prisma.$queryRaw`
        SELECT * FROM "Expense" WHERE id = ${id} LIMIT 1
      `;
      expense = rows?.[0] || null;
    }

    if (!expense) {
      return res.status(404).json({ error: 'Expense record not found' });
    }

    res.json(expense);
  } catch (error: any) {
    console.error('Failed to get expense by id:', error);
    res.status(500).json({ error: 'Failed to fetch expense record', details: error.message });
  }
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      category = 'MISCELLANEOUS',
      amount,
      expenseDate = new Date(),
      paymentMethod = 'CASH',
      referenceNo,
      receiptUrl,
      notes,
      vendorName,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Expense title is required' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid expense amount greater than 0 is required' });
    }

    const createdById = req.user?.id || null;
    const parsedDate = new Date(expenseDate);

    try {
      if ((prisma as any).expense) {
        const created = await (prisma as any).expense.create({
          data: {
            title: title.trim(),
            category,
            amount: parsedAmount,
            expenseDate: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
            paymentMethod,
            referenceNo: referenceNo?.trim() || null,
            receiptUrl: receiptUrl?.trim() || null,
            notes: notes?.trim() || null,
            vendorName: vendorName?.trim() || null,
            createdById,
          },
        });
        return res.status(201).json({
          message: 'Expense created successfully',
          expense: created,
        });
      }
    } catch {
      // fallback
    }

    const id = (await import('crypto')).randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "Expense" (
        "id", "title", "category", "amount", "expenseDate", "paymentMethod",
        "referenceNo", "receiptUrl", "notes", "vendorName", "createdById",
        "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${title.trim()},
        ${category},
        ${parsedAmount},
        ${isNaN(parsedDate.getTime()) ? new Date() : parsedDate},
        ${paymentMethod},
        ${referenceNo?.trim() || null},
        ${receiptUrl?.trim() || null},
        ${notes?.trim() || null},
        ${vendorName?.trim() || null},
        ${createdById},
        NOW(),
        NOW()
      )
    `;

    const inserted: any = await prisma.$queryRaw`
      SELECT * FROM "Expense" WHERE id = ${id} LIMIT 1
    `;

    res.status(201).json({
      message: 'Expense created successfully',
      expense: inserted?.[0],
    });
  } catch (error: any) {
    console.error('Failed to create expense:', error);
    res.status(500).json({ error: 'Failed to create expense', details: error.message });
  }
};

export const updateExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      amount,
      expenseDate,
      paymentMethod,
      referenceNo,
      receiptUrl,
      notes,
      vendorName,
    } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Valid expense amount greater than 0 is required' });
      }
      updateData.amount = parsedAmount;
    }
    if (expenseDate !== undefined) {
      const parsedDate = new Date(expenseDate);
      if (!isNaN(parsedDate.getTime())) updateData.expenseDate = parsedDate;
    }
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (referenceNo !== undefined) updateData.referenceNo = referenceNo?.trim() || null;
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (vendorName !== undefined) updateData.vendorName = vendorName?.trim() || null;

    try {
      if ((prisma as any).expense) {
        const updated = await (prisma as any).expense.update({
          where: { id },
          data: updateData,
        });
        return res.json({
          message: 'Expense updated successfully',
          expense: updated,
        });
      }
    } catch {
      // fallback
    }

    // Raw update
    const currentRows: any = await prisma.$queryRaw`
      SELECT * FROM "Expense" WHERE id = ${id} LIMIT 1
    `;
    if (!currentRows || currentRows.length === 0) {
      return res.status(404).json({ error: 'Expense record not found' });
    }

    const current = currentRows[0];
    const newTitle = updateData.title ?? current.title;
    const newCategory = updateData.category ?? current.category;
    const newAmount = updateData.amount ?? current.amount;
    const newDate = updateData.expenseDate ?? current.expenseDate;
    const newMethod = updateData.paymentMethod ?? current.paymentMethod;
    const newRef = updateData.referenceNo ?? current.referenceNo;
    const newReceipt = updateData.receiptUrl ?? current.receiptUrl;
    const newNotes = updateData.notes ?? current.notes;
    const newVendor = updateData.vendorName ?? current.vendorName;

    await prisma.$executeRaw`
      UPDATE "Expense"
      SET
        "title" = ${newTitle},
        "category" = ${newCategory},
        "amount" = ${newAmount},
        "expenseDate" = ${newDate},
        "paymentMethod" = ${newMethod},
        "referenceNo" = ${newRef},
        "receiptUrl" = ${newReceipt},
        "notes" = ${newNotes},
        "vendorName" = ${newVendor},
        "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;

    const updatedRows: any = await prisma.$queryRaw`
      SELECT * FROM "Expense" WHERE id = ${id} LIMIT 1
    `;

    res.json({
      message: 'Expense updated successfully',
      expense: updatedRows?.[0],
    });
  } catch (error: any) {
    console.error('Failed to update expense:', error);
    res.status(500).json({ error: 'Failed to update expense', details: error.message });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    try {
      if ((prisma as any).expense) {
        await (prisma as any).expense.delete({ where: { id } });
        return res.json({ message: 'Expense deleted successfully' });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`
      DELETE FROM "Expense" WHERE "id" = ${id}
    `;

    res.json({ message: 'Expense deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete expense:', error);
    res.status(500).json({ error: 'Failed to delete expense', details: error.message });
  }
};
