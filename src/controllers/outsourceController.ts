import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middlewares/authMiddleware';

const DEFAULT_REFERENCE_LABS = [
  {
    name: 'SRL Diagnostics Central Reference Lab',
    code: 'REF-SRL',
    contactPerson: 'Dr. Rajesh Sharma (Head of Referral Diagnostics)',
    phone: '+91 98200 11223',
    email: 'referrals@srl.in',
    address: 'Goregaon West, Plot #44, Industrial Area',
    city: 'Mumbai',
    isActive: true,
  },
  {
    name: 'Dr. Lal PathLabs National Reference Lab',
    code: 'REF-LAL',
    contactPerson: 'Dr. Amitav Ghosh (Reference Operations)',
    phone: '+91 98110 44556',
    email: 'nrl@lalpathlabs.com',
    address: 'Block E, Sector 18, Rohini',
    city: 'New Delhi',
    isActive: true,
  },
  {
    name: 'Metropolis Healthcare Referral Lab',
    code: 'REF-METRO',
    contactPerson: 'Pooja Kulkarni (Specimen Intake Lead)',
    phone: '+91 99870 55667',
    email: 'outsource@metropolisindia.com',
    address: 'Kohinoor City, Commercial Tower, Kurla',
    city: 'Mumbai',
    isActive: true,
  },
  {
    name: 'Thyrocare Central Automated Lab',
    code: 'REF-THYRO',
    contactPerson: 'Sanjay Nair (Logistics Coordinator)',
    phone: '+91 98220 99881',
    email: 'b2b@thyrocare.com',
    address: 'D-37/1, TTC Industrial Area, MIDC Turbhe',
    city: 'Navi Mumbai',
    isActive: true,
  },
];

// Seed default reference labs if empty
const ensureReferenceLabs = async () => {
  try {
    if ((prisma as any).referenceLab) {
      const count = await (prisma as any).referenceLab.count();
      if (count === 0) {
        for (const lab of DEFAULT_REFERENCE_LABS) {
          await (prisma as any).referenceLab.create({ data: lab });
        }
      }
      return;
    }
  } catch {
    // fallback
  }

  const countRes: any = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "ReferenceLab"`;
  if (!countRes?.[0]?.count || countRes[0].count === 0) {
    for (const lab of DEFAULT_REFERENCE_LABS) {
      const id = (await import('crypto')).randomUUID();
      await prisma.$executeRaw`
        INSERT INTO "ReferenceLab" ("id", "name", "code", "contactPerson", "phone", "email", "address", "city", "isActive", "createdAt", "updatedAt")
        VALUES (${id}, ${lab.name}, ${lab.code}, ${lab.contactPerson}, ${lab.phone}, ${lab.email}, ${lab.address}, ${lab.city}, true, NOW(), NOW())
        ON CONFLICT ("code") DO NOTHING
      `;
    }
  }
};

// REFERENCE LABS CONTROLLERS
export const getReferenceLabs = async (_req: Request, res: Response) => {
  try {
    await ensureReferenceLabs();

    try {
      if ((prisma as any).referenceLab) {
        const labs = await (prisma as any).referenceLab.findMany({
          orderBy: { name: 'asc' },
        });
        return res.json(labs);
      }
    } catch {
      // fallback
    }

    const labs: any = await prisma.$queryRaw`
      SELECT * FROM "ReferenceLab" ORDER BY "name" ASC
    `;
    res.json(labs || []);
  } catch (error: any) {
    console.error('Failed to fetch reference labs:', error);
    res.status(500).json({ error: 'Failed to fetch reference labs', details: error.message });
  }
};

export const createReferenceLab = async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, contactPerson, phone, email, address, city, isActive = true } = req.body;

    if (!name || !phone || !code) {
      return res.status(400).json({ error: 'Lab Name, Unique Code and Phone are required' });
    }

    const cleanCode = code.trim().toUpperCase();

    try {
      if ((prisma as any).referenceLab) {
        const created = await (prisma as any).referenceLab.create({
          data: {
            name: name.trim(),
            code: cleanCode,
            contactPerson: contactPerson?.trim() || null,
            phone: phone.trim(),
            email: email?.trim() || null,
            address: address?.trim() || null,
            city: city?.trim() || null,
            isActive: Boolean(isActive),
          },
        });
        return res.status(201).json({
          message: 'Reference lab created successfully',
          lab: created,
        });
      }
    } catch {
      // fallback
    }

    const id = (await import('crypto')).randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "ReferenceLab" ("id", "name", "code", "contactPerson", "phone", "email", "address", "city", "isActive", "createdAt", "updatedAt")
      VALUES (${id}, ${name.trim()}, ${cleanCode}, ${contactPerson?.trim() || null}, ${phone.trim()}, ${email?.trim() || null}, ${address?.trim() || null}, ${city?.trim() || null}, ${Boolean(isActive)}, NOW(), NOW())
    `;

    const inserted: any = await prisma.$queryRaw`
      SELECT * FROM "ReferenceLab" WHERE id = ${id} LIMIT 1
    `;

    res.status(201).json({
      message: 'Reference lab created successfully',
      lab: inserted?.[0],
    });
  } catch (error: any) {
    console.error('Failed to create reference lab:', error);
    res.status(500).json({ error: 'Failed to create reference lab', details: error.message });
  }
};

export const updateReferenceLab = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, contactPerson, phone, email, address, city, isActive } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (code !== undefined) data.code = code.trim().toUpperCase();
    if (contactPerson !== undefined) data.contactPerson = contactPerson?.trim() || null;
    if (phone !== undefined) data.phone = phone.trim();
    if (email !== undefined) data.email = email?.trim() || null;
    if (address !== undefined) data.address = address?.trim() || null;
    if (city !== undefined) data.city = city?.trim() || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    try {
      if ((prisma as any).referenceLab) {
        const updated = await (prisma as any).referenceLab.update({
          where: { id },
          data,
        });
        return res.json({ message: 'Reference lab updated successfully', lab: updated });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`
      UPDATE "ReferenceLab"
      SET
        "name" = COALESCE(${data.name}, "name"),
        "code" = COALESCE(${data.code}, "code"),
        "contactPerson" = ${data.contactPerson},
        "phone" = COALESCE(${data.phone}, "phone"),
        "email" = ${data.email},
        "address" = ${data.address},
        "city" = ${data.city},
        "isActive" = COALESCE(${data.isActive}, "isActive"),
        "updatedAt" = NOW()
      WHERE id = ${id}
    `;

    const updatedRows: any = await prisma.$queryRaw`SELECT * FROM "ReferenceLab" WHERE id = ${id} LIMIT 1`;
    res.json({ message: 'Reference lab updated successfully', lab: updatedRows?.[0] });
  } catch (error: any) {
    console.error('Failed to update reference lab:', error);
    res.status(500).json({ error: 'Failed to update reference lab', details: error.message });
  }
};

export const deleteReferenceLab = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    try {
      if ((prisma as any).referenceLab) {
        await (prisma as any).referenceLab.delete({ where: { id } });
        return res.json({ message: 'Reference lab deleted successfully' });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`DELETE FROM "ReferenceLab" WHERE id = ${id}`;
    res.json({ message: 'Reference lab deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete reference lab:', error);
    res.status(500).json({ error: 'Failed to delete reference lab', details: error.message });
  }
};

// OUTSOURCE SAMPLES CONTROLLERS
export const getOutsourcedSamples = async (req: Request, res: Response) => {
  try {
    await ensureReferenceLabs();

    const {
      search,
      status,
      referenceLabId,
      page = '1',
      limit = '50',
    } = req.query as any;

    const pageNum = parseInt(page, 10) || 1;
    const take = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * take;

    try {
      if ((prisma as any).outsourceSample) {
        const where: any = {
          ...(status && status !== 'ALL' && { status }),
          ...(referenceLabId && referenceLabId !== 'ALL' && { referenceLabId }),
          ...(search && {
            OR: [
              { patientName: { contains: search, mode: 'insensitive' } },
              { sampleBarcode: { contains: search, mode: 'insensitive' } },
              { testNames: { contains: search, mode: 'insensitive' } },
              { courierTrackingNo: { contains: search, mode: 'insensitive' } },
              { resultNotes: { contains: search, mode: 'insensitive' } },
            ],
          }),
        };

        const [samples, total] = await Promise.all([
          (prisma as any).outsourceSample.findMany({
            where,
            orderBy: { dispatchDate: 'desc' },
            skip,
            take,
            include: {
              referenceLab: true,
            },
          }),
          (prisma as any).outsourceSample.count({ where }),
        ]);

        return res.json({
          samples,
          total,
          page: pageNum,
          totalPages: Math.ceil(total / take),
        });
      }
    } catch {
      // fallback
    }

    const samples: any = await prisma.$queryRaw`
      SELECT o.*, row_to_json(r.*) as "referenceLab"
      FROM "OutsourceSample" o
      LEFT JOIN "ReferenceLab" r ON o."referenceLabId" = r.id
      ORDER BY o."dispatchDate" DESC
      LIMIT ${take} OFFSET ${skip}
    `;

    const countRes: any = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "OutsourceSample"`;

    res.json({
      samples: samples || [],
      total: countRes?.[0]?.count || 0,
      page: pageNum,
      totalPages: Math.ceil((countRes?.[0]?.count || 0) / take),
    });
  } catch (error: any) {
    console.error('Failed to get outsourced samples:', error);
    res.status(500).json({ error: 'Failed to fetch outsourced samples', details: error.message });
  }
};

export const getOutsourceSummary = async (_req: Request, res: Response) => {
  try {
    let allSamples: any[] = [];

    try {
      if ((prisma as any).outsourceSample) {
        allSamples = await (prisma as any).outsourceSample.findMany();
      } else {
        allSamples = (await prisma.$queryRaw`SELECT * FROM "OutsourceSample"`) as any[];
      }
    } catch {
      allSamples = (await prisma.$queryRaw`SELECT * FROM "OutsourceSample"`) as any[];
    }

    let pendingCount = 0;
    let dispatchedCount = 0;
    let receivedByLabCount = 0;
    let reportReceivedCount = 0;
    let completedCount = 0;
    let totalCost = 0;

    for (const s of allSamples) {
      totalCost += Number(s.outsourceCost) || 0;
      switch (s.status) {
        case 'PENDING':
          pendingCount++;
          break;
        case 'DISPATCHED':
          dispatchedCount++;
          break;
        case 'RECEIVED_BY_LAB':
          receivedByLabCount++;
          break;
        case 'REPORT_RECEIVED':
          reportReceivedCount++;
          break;
        case 'COMPLETED':
          completedCount++;
          break;
        default:
          break;
      }
    }

    res.json({
      totalOutsourced: allSamples.length,
      pendingCount,
      dispatchedCount,
      receivedByLabCount,
      reportReceivedCount,
      completedCount,
      totalCost,
    });
  } catch (error: any) {
    console.error('Failed to get outsource summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary', details: error.message });
  }
};

export const createOutsourceSample = async (req: AuthRequest, res: Response) => {
  try {
    const {
      bookingId,
      patientName,
      patientAge,
      patientGender,
      patientMobile,
      sampleBarcode,
      sampleType = 'Blood (Serum)',
      testNames,
      referenceLabId,
      dispatchDate = new Date(),
      expectedReportDate,
      status = 'PENDING',
      courierTrackingNo,
      courierPartner,
      outsourceCost = 0,
      paymentStatus = 'UNPAID',
      notes,
    } = req.body;

    if (!patientName || !sampleBarcode || !testNames || !referenceLabId) {
      return res.status(400).json({
        error: 'Patient Name, Sample Barcode, Test Names, and Reference Lab are required',
      });
    }

    const createdById = req.user?.id || null;
    const parsedCost = parseFloat(outsourceCost) || 0;
    const parsedDispatch = new Date(dispatchDate);
    const parsedExpected = expectedReportDate ? new Date(expectedReportDate) : null;

    try {
      if ((prisma as any).outsourceSample) {
        const created = await (prisma as any).outsourceSample.create({
          data: {
            bookingId: bookingId || null,
            patientName: patientName.trim(),
            patientAge: patientAge ? String(patientAge) : null,
            patientGender: patientGender || null,
            patientMobile: patientMobile || null,
            sampleBarcode: sampleBarcode.trim(),
            sampleType: sampleType.trim(),
            testNames: testNames.trim(),
            referenceLabId,
            dispatchDate: isNaN(parsedDispatch.getTime()) ? new Date() : parsedDispatch,
            expectedReportDate: parsedExpected,
            status,
            courierTrackingNo: courierTrackingNo?.trim() || null,
            courierPartner: courierPartner?.trim() || null,
            outsourceCost: parsedCost,
            paymentStatus,
            resultNotes: notes?.trim() || null,
            createdById,
          },
          include: {
            referenceLab: true,
          },
        });
        return res.status(201).json({
          message: 'Sample outsourced successfully',
          sample: created,
        });
      }
    } catch {
      // fallback
    }

    const id = (await import('crypto')).randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "OutsourceSample" (
        "id", "bookingId", "patientName", "patientAge", "patientGender", "patientMobile",
        "sampleBarcode", "sampleType", "testNames", "referenceLabId", "dispatchDate",
        "expectedReportDate", "status", "courierTrackingNo", "courierPartner",
        "outsourceCost", "paymentStatus", "resultNotes", "createdById", "createdAt", "updatedAt"
      ) VALUES (
        ${id},
        ${bookingId || null},
        ${patientName.trim()},
        ${patientAge ? String(patientAge) : null},
        ${patientGender || null},
        ${patientMobile || null},
        ${sampleBarcode.trim()},
        ${sampleType.trim()},
        ${testNames.trim()},
        ${referenceLabId},
        ${isNaN(parsedDispatch.getTime()) ? new Date() : parsedDispatch},
        ${parsedExpected},
        ${status},
        ${courierTrackingNo?.trim() || null},
        ${courierPartner?.trim() || null},
        ${parsedCost},
        ${paymentStatus},
        ${notes?.trim() || null},
        ${createdById},
        NOW(),
        NOW()
      )
    `;

    const inserted: any = await prisma.$queryRaw`
      SELECT o.*, row_to_json(r.*) as "referenceLab"
      FROM "OutsourceSample" o
      LEFT JOIN "ReferenceLab" r ON o."referenceLabId" = r.id
      WHERE o.id = ${id} LIMIT 1
    `;

    res.status(201).json({
      message: 'Sample outsourced successfully',
      sample: inserted?.[0],
    });
  } catch (error: any) {
    console.error('Failed to create outsource sample:', error);
    res.status(500).json({ error: 'Failed to create outsource sample', details: error.message });
  }
};

export const updateOutsourceSample = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      courierTrackingNo,
      courierPartner,
      outsourceCost,
      paymentStatus,
      resultNotes,
      reportFileUrl,
      reportReceivedAt,
      completedAt,
      expectedReportDate,
    } = req.body;

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (courierTrackingNo !== undefined) data.courierTrackingNo = courierTrackingNo?.trim() || null;
    if (courierPartner !== undefined) data.courierPartner = courierPartner?.trim() || null;
    if (outsourceCost !== undefined) data.outsourceCost = parseFloat(outsourceCost) || 0;
    if (paymentStatus !== undefined) data.paymentStatus = paymentStatus;
    if (resultNotes !== undefined) data.resultNotes = resultNotes?.trim() || null;
    if (reportFileUrl !== undefined) {
      data.reportFileUrl = reportFileUrl?.trim() || null;
      if (reportFileUrl && !data.reportReceivedAt) {
        data.reportReceivedAt = new Date();
      }
    }
    if (reportReceivedAt !== undefined) {
      data.reportReceivedAt = reportReceivedAt ? new Date(reportReceivedAt) : null;
    }
    if (completedAt !== undefined) {
      data.completedAt = completedAt ? new Date(completedAt) : null;
    }
    if (status === 'COMPLETED' && !data.completedAt) {
      data.completedAt = new Date();
    }
    if (expectedReportDate !== undefined) {
      data.expectedReportDate = expectedReportDate ? new Date(expectedReportDate) : null;
    }

    try {
      if ((prisma as any).outsourceSample) {
        const updated = await (prisma as any).outsourceSample.update({
          where: { id },
          data,
          include: { referenceLab: true },
        });
        return res.json({
          message: 'Outsourced sample updated successfully',
          sample: updated,
        });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`
      UPDATE "OutsourceSample"
      SET
        "status" = COALESCE(${data.status}, "status"),
        "courierTrackingNo" = ${data.courierTrackingNo},
        "courierPartner" = ${data.courierPartner},
        "outsourceCost" = COALESCE(${data.outsourceCost}, "outsourceCost"),
        "paymentStatus" = COALESCE(${data.paymentStatus}, "paymentStatus"),
        "resultNotes" = ${data.resultNotes},
        "reportFileUrl" = ${data.reportFileUrl},
        "reportReceivedAt" = ${data.reportReceivedAt || null},
        "completedAt" = ${data.completedAt || null},
        "updatedAt" = NOW()
      WHERE id = ${id}
    `;

    const updatedRows: any = await prisma.$queryRaw`
      SELECT o.*, row_to_json(r.*) as "referenceLab"
      FROM "OutsourceSample" o
      LEFT JOIN "ReferenceLab" r ON o."referenceLabId" = r.id
      WHERE o.id = ${id} LIMIT 1
    `;

    res.json({
      message: 'Outsourced sample updated successfully',
      sample: updatedRows?.[0],
    });
  } catch (error: any) {
    console.error('Failed to update outsource sample:', error);
    res.status(500).json({ error: 'Failed to update outsource sample', details: error.message });
  }
};

export const deleteOutsourceSample = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    try {
      if ((prisma as any).outsourceSample) {
        await (prisma as any).outsourceSample.delete({ where: { id } });
        return res.json({ message: 'Outsource sample deleted successfully' });
      }
    } catch {
      // fallback
    }

    await prisma.$executeRaw`DELETE FROM "OutsourceSample" WHERE id = ${id}`;
    res.json({ message: 'Outsource sample deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete outsource sample:', error);
    res.status(500).json({ error: 'Failed to delete outsource sample', details: error.message });
  }
};
