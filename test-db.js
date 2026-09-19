require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const booking = await prisma.booking.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { report: true, user: true }
    });
    
    if (!booking) {
        console.log('No booking found');
        return;
    }
    
    if (booking.report) {
        // Test what my updated updateReportDraft does
        const reportBranchId = 'invalid-id'; // Simulating Partner Lab ID
        
        const validBranchId = await (async () => {
            if (!reportBranchId) return null;
            const branch = await prisma.branch.findUnique({ where: { id: reportBranchId } });
            return branch ? reportBranchId : null;
        })();
        console.log('Valid branch ID (update):', validBranchId);
        
        const report = await prisma.report.update({
          where: { id: booking.report.id },
          data: {
            status: 'DRAFT',
            reportBranchId: validBranchId,
          }
        });
        console.log('Report updated successfully:', report.id);
        
        // Test verifyReport
        const verified = await prisma.report.update({
          where: { id: report.id },
          data: {
            status: 'UNDER_REVIEW',
            verifiedById: booking.userId, // use random user id
            verifiedAt: new Date(),
            auditLogs: {
              create: {
                action: 'SUBMITTED_FOR_REVIEW',
                performedBy: booking.userId,
                details: 'Report submitted for clinical review',
              },
            },
          }
        });
        console.log('Report verified successfully:', verified.id);
    } else {
        console.log('Testing create report for booking', booking.id);
        const reportBranchId = 'invalid-id';
        const validBranchId = await (async () => {
            if (!reportBranchId) return null;
            const branch = await prisma.branch.findUnique({ where: { id: reportBranchId } });
            return branch ? reportBranchId : null;
        })();
        console.log('Valid branch ID (create):', validBranchId);
        
        const report = await prisma.report.create({
          data: {
            bookingId: booking.id,
            testName: 'Test Name',
            clinicalNotes: '',
            status: 'DRAFT',
            hasAbnormalFlags: false,
            recipientType: 'USER',
            recipientId: null,
            reportBranchId: validBranchId,
            doctorName: null,
            doctorQualification: null,
            doctorRegNo: null,
            doctorDesignation: null,
            doctorVerifiedAt: null,
            doctorSignatureUrl: null,
            parameters: {
              create: []
            }
          }
        });
        console.log('Report created successfully:', report.id);
    }
  } catch (e) {
    console.error('Error during test:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
