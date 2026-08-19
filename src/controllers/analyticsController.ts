import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [
      todayBookings,
      allBookings,
      allReports,
      allBranches,
      topTests,
      bookingsByStatus,
      paymentBreakdown,
      revenueByDay,
      branchStats,
      recentSlaData,
    ] = await Promise.all([

      // Today's bookings
      prisma.booking.findMany({
        where: { createdAt: { gte: todayStart, lt: todayEnd } },
        select: { totalPaid: true, paymentStatus: true, collectionMode: true, status: true },
      }),

      // All bookings for general KPIs
      prisma.booking.findMany({
        select: {
          id: true,
          totalPaid: true,
          paymentStatus: true,
          collectionMode: true,
          status: true,
          createdAt: true,
          sampleCollectedAt: true,
          branchId: true,
          report: {
            select: {
              status: true,
              reportedDate: true,
              verifiedAt: true,
              doctorVerifiedAt: true,
            },
          },
        },
      }),

      // All reports
      prisma.report.findMany({
        select: {
          status: true,
          reportedDate: true,
          verifiedAt: true,
          doctorVerifiedAt: true,
          booking: {
            select: {
              sampleCollectedAt: true,
              createdAt: true,
            },
          },
        },
      }),

      // Branches
      prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),

      // Top selling tests
      prisma.bookingTest.groupBy({
        by: ['testId'],
        _count: { testId: true },
        orderBy: { _count: { testId: 'desc' } },
        take: 5,
      }),

      // Bookings grouped by status
      prisma.booking.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Payment breakdown by mode
      prisma.booking.groupBy({
        by: ['paymentMode'],
        where: { paymentStatus: 'SUCCESS' },
        _count: { paymentMode: true },
        _sum: { totalPaid: true },
      }),

      // Revenue last 7 days
      prisma.booking.findMany({
        where: {
          createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
          paymentStatus: 'SUCCESS',
        },
        select: { totalPaid: true, createdAt: true },
      }),

      // Bookings per branch
      prisma.booking.groupBy({
        by: ['branchId'],
        _count: { branchId: true },
        _sum: { totalPaid: true },
      }),

      // Reports for SLA calculation (last 30 days)
      prisma.report.findMany({
        where: { reportedDate: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        select: {
          status: true,
          reportedDate: true,
          verifiedAt: true,
          booking: {
            select: { sampleCollectedAt: true, createdAt: true, scheduledDate: true },
          },
        },
      }),
    ]);

    // --- KPI Calculations ---
    const todayRevenue = todayBookings
      .filter(b => b.paymentStatus === 'SUCCESS')
      .reduce((s, b) => s + b.totalPaid, 0);

    const totalRevenue = allBookings
      .filter(b => b.paymentStatus === 'SUCCESS')
      .reduce((s, b) => s + b.totalPaid, 0);

    const totalRefunds = allBookings
      .filter(b => b.paymentStatus === 'REFUNDED')
      .reduce((s, b) => s + b.totalPaid, 0);

    const pendingPayments = allBookings
      .filter(b => b.paymentStatus === 'PENDING')
      .reduce((s, b) => s + b.totalPaid, 0);

    const completedReports = allReports.filter(r => r.status === 'RELEASED' || r.status === 'APPROVED').length;
    const pendingReports = allReports.filter(r => r.status === 'DRAFT' || r.status === 'UNDER_REVIEW').length;

    const pendingSampleCollections = allBookings.filter(
      b => b.status === 'CONFIRMED' || b.status === 'ASSIGNED' || b.status === 'ACCEPTED' || b.status === 'ON_THE_WAY' || b.status === 'REACHED_LOCATION'
    ).length;

    const homeCollectionBookings = allBookings.filter(b => b.collectionMode === 'HOME').length;
    const labVisitBookings = allBookings.filter(b => b.collectionMode === 'LAB').length;
    const activeBookings = allBookings.filter(
      b => !['COMPLETED', 'CANCELLED'].includes(b.status)
    ).length;

    // --- TAT Calculations ---
    const tatValues: number[] = [];
    const doctorApprovalTimes: number[] = [];

    for (const report of allReports) {
      const collectedAt = report.booking?.sampleCollectedAt;
      const createdAt = report.booking?.createdAt;
      const startTime = collectedAt || createdAt;

      if (startTime && report.reportedDate) {
        const tat = (new Date(report.reportedDate).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);
        if (tat > 0 && tat < 168) tatValues.push(tat);
      }

      if (report.reportedDate && report.doctorVerifiedAt) {
        const approvalTime = (new Date(report.doctorVerifiedAt).getTime() - new Date(report.reportedDate).getTime()) / (1000 * 60);
        if (approvalTime > 0) doctorApprovalTimes.push(approvalTime);
      }
    }

    const avgTat = tatValues.length > 0 ? tatValues.reduce((a, b) => a + b, 0) / tatValues.length : 0;
    const medianTat = tatValues.length > 0
      ? [...tatValues].sort((a, b) => a - b)[Math.floor(tatValues.length / 2)]
      : 0;
    const fastestTat = tatValues.length > 0 ? Math.min(...tatValues) : 0;
    const slowestTat = tatValues.length > 0 ? Math.max(...tatValues) : 0;

    const avgDoctorApproval = doctorApprovalTimes.length > 0
      ? doctorApprovalTimes.reduce((a, b) => a + b, 0) / doctorApprovalTimes.length
      : 0;

    // --- SLA Calculations (benchmark: 24 hours) ---
    const SLA_BENCHMARK_HOURS = 24;
    let withinSla = 0;
    let nearSla = 0;
    let breachedSla = 0;
    const delays: number[] = [];

    for (const report of recentSlaData) {
      const start = report.booking?.sampleCollectedAt || report.booking?.createdAt;
      if (!start || !report.reportedDate) continue;
      const tat = (new Date(report.reportedDate).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
      if (tat <= SLA_BENCHMARK_HOURS * 0.9) withinSla++;
      else if (tat <= SLA_BENCHMARK_HOURS) nearSla++;
      else {
        breachedSla++;
        delays.push(tat - SLA_BENCHMARK_HOURS);
      }
    }

    const totalSlaReports = withinSla + nearSla + breachedSla;
    const slaCompliance = totalSlaReports > 0 ? Math.round((withinSla / totalSlaReports) * 100 * 10) / 10 : 100;
    const avgDelay = delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
    const worstDelay = delays.length > 0 ? Math.max(...delays) : 0;

    // --- Revenue chart (last 7 days) ---
    const revenueChartData: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      revenueChartData[label] = 0;
    }
    for (const b of revenueByDay) {
      const label = new Date(b.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (revenueChartData[label] !== undefined) {
        revenueChartData[label] += b.totalPaid;
      }
    }
    const revenueChart = Object.entries(revenueChartData).map(([name, Revenue]) => ({ name, Revenue }));

    // --- Booking status breakdown ---
    const bookingStatusMap: Record<string, number> = {};
    for (const item of bookingsByStatus) {
      bookingStatusMap[item.status] = item._count.status;
    }

    // --- Payment breakdown ---
    const paymentModes = paymentBreakdown.map(p => ({
      mode: p.paymentMode || 'UNKNOWN',
      count: p._count.paymentMode,
      total: p._sum.totalPaid || 0,
    }));

    // --- Branch stats ---
    const branchAnalytics = allBranches.map(branch => {
      const stat = branchStats.find(s => s.branchId === branch.id);
      const pendingForBranch = allBookings.filter(
        b => b.branchId === branch.id && !['COMPLETED', 'CANCELLED'].includes(b.status)
      ).length;
      return {
        branchId: branch.id,
        branchName: branch.name,
        bookingCount: stat?._count.branchId || 0,
        revenue: stat?._sum.totalPaid || 0,
        pendingBookings: pendingForBranch,
      };
    });

    // --- Top tests ---
    const testIds = topTests.map(t => t.testId);
    const testNames = await prisma.test.findMany({
      where: { id: { in: testIds } },
      select: { id: true, name: true },
    });
    const topTestsWithNames = topTests.map(t => ({
      testId: t.testId,
      name: testNames.find(n => n.id === t.testId)?.name || t.testId,
      count: t._count.testId,
    }));

    // --- Dynamic alerts ---
    const alerts: { type: string; message: string; severity: 'critical' | 'warning' | 'info' }[] = [];

    if (pendingReports > 15) {
      alerts.push({ type: 'High Pending Reports', message: `${pendingReports} reports are pending review or approval.`, severity: 'critical' });
    }
    if (breachedSla > 0) {
      alerts.push({ type: 'SLA Breach', message: `${breachedSla} report(s) have exceeded the SLA benchmark.`, severity: 'critical' });
    }
    if (pendingSampleCollections > 10) {
      alerts.push({ type: 'Sample Queue', message: `${pendingSampleCollections} bookings are awaiting sample collection.`, severity: 'warning' });
    }
    if (pendingPayments > 0) {
      alerts.push({ type: 'Pending Payments', message: `₹${pendingPayments.toLocaleString('en-IN')} in payments are still outstanding.`, severity: 'warning' });
    }
    for (const branch of branchAnalytics) {
      if (branch.pendingBookings > 20) {
        alerts.push({ type: 'Branch Overloaded', message: `${branch.branchName} has ${branch.pendingBookings} active bookings.`, severity: 'warning' });
      }
    }

    // --- Insights ---
    const insights: string[] = [];
    if (topTestsWithNames.length > 0) {
      insights.push(`"${topTestsWithNames[0].name}" is the most booked test with ${topTestsWithNames[0].count} orders.`);
    }
    if (avgTat > 0) {
      insights.push(`Average turnaround time is ${avgTat.toFixed(1)} hours across all reports.`);
    }
    if (slaCompliance > 0) {
      insights.push(`SLA compliance stands at ${slaCompliance}% over the last 30 days.`);
    }
    if (homeCollectionBookings > labVisitBookings) {
      insights.push(`Home collections (${homeCollectionBookings}) outnumber lab visits (${labVisitBookings}).`);
    }
    const upiEntry = paymentModes.find(p => p.mode === 'UPI');
    if (upiEntry) {
      insights.push(`UPI has collected ₹${upiEntry.total.toLocaleString('en-IN')} across ${upiEntry.count} transactions.`);
    }

    res.json({
      kpis: {
        todayBookings: todayBookings.length,
        todayRevenue,
        totalRevenue,
        totalRefunds,
        pendingPayments,
        completedReports,
        pendingReports,
        pendingSampleCollections,
        homeCollectionBookings,
        labVisitBookings,
        activeBookings,
        totalBookings: allBookings.length,
      },
      tat: {
        avgHours: Math.round(avgTat * 10) / 10,
        medianHours: Math.round(medianTat * 10) / 10,
        fastestHours: Math.round(fastestTat * 10) / 10,
        slowestHours: Math.round(slowestTat * 10) / 10,
        avgDoctorApprovalMinutes: Math.round(avgDoctorApproval),
      },
      sla: {
        compliance: slaCompliance,
        withinSla,
        nearSla,
        breachedSla,
        avgDelayHours: Math.round(avgDelay * 10) / 10,
        worstDelayHours: Math.round(worstDelay * 10) / 10,
        pieData: [
          { name: 'Within SLA Threshold', value: withinSla + nearSla },
          { name: 'SLA Lag (Late Release)', value: breachedSla },
        ],
      },
      revenueChart,
      bookingsByStatus: bookingStatusMap,
      paymentModes,
      branchAnalytics,
      topTests: topTestsWithNames,
      alerts,
      insights,
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
};