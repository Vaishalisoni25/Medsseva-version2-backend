import { z } from 'zod';

export const createBookingSchema = z.object({
  testIds: z.array(z.string()).optional().default([]),
  packageIds: z.array(z.string()).optional().default([]),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  scheduledSlot: z.string().nullable().optional(),
  patientName: z.string().min(1, 'Patient name is required'),
  patientAge: z.union([z.number(), z.string(), z.null()]).optional(),
  patientGender: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  collectionMode: z.string().nullable().optional(),
  addressId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  couponCode: z.string().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  razorpay_payment_id: z.string().nullable().optional(),
  razorpay_order_id: z.string().nullable().optional(),
  razorpay_signature: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
});
export const createReportSchema = z.object({
  bookingId: z.string().uuid('Valid booking ID is required'),
  testName: z.string().min(1, 'Test name is required'),
  clinicalNotes: z.string().optional(),
  parameters: z.array(z.object({
    parameterId: z.string().optional(),
    parameterName: z.string().min(1, 'Parameter name is required'),
    observedValue: z.string().min(1, 'Observed value is required'),
    unit: z.string().optional(),
    referenceRange: z.string().optional(),
    isAbnormal: z.boolean().optional()
  })).min(1, 'At least one parameter is required')
});
