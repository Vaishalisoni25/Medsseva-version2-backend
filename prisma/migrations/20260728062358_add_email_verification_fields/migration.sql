/*
  Warnings:

  - You are about to drop the column `details` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `bank` on the `PaymentMethod` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `PaymentMethod` table. All the data in the column will be lost.
  - Added the required column `cardBrand` to the `PaymentMethod` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'REVIEWED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('AI_ACTIVE', 'PENDING_HUMAN', 'HUMAN_ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('USER', 'BOT', 'AGENT');

-- CreateEnum
CREATE TYPE "SampleCondition" AS ENUM ('GOOD', 'HAEMOLYSED', 'INSUFFICIENT', 'LEAKED');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('RECEIVED', 'ACCESSIONED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentTxStatus" AS ENUM ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('REAGENT', 'CONSUMABLE', 'CHEMICAL', 'COLLECTION_KIT', 'TEST_KIT');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'DAMAGED', 'EXPIRED', 'TRANSFER_IN', 'TRANSFER_OUT', 'AUTO_CONSUMED');

-- CreateEnum
CREATE TYPE "POStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportDeliveryMode" AS ENUM ('AUTO_PUSH', 'MANUAL_DISPATCH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'PARTNER_ON_THE_WAY', 'PARTNER_ARRIVED', 'SAMPLE_COLLECTED', 'SAMPLE_RECEIVED_IN_LAB', 'REPORT_READY', 'REPORT_SENT', 'REPORT_APPROVED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'NEW_BOOKING_ASSIGNED', 'BOOKING_CANCELLED_BY_USER', 'PATIENT_REACHED_LAB', 'BOOKING_COMPLETED', 'NEW_CHAT_MESSAGE', 'SUPPORT_REPLY', 'NEW_OFFER', 'NEW_PACKAGE', 'PRICE_UPDATE', 'APPOINTMENT_REMINDER', 'MISSED_APPOINTMENT', 'BROADCAST');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'RETRYING');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'WAITING_FOR_PARTNER';
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';
ALTER TYPE "BookingStatus" ADD VALUE 'PATIENT_REACHED_LAB';

-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'APPROVED';

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "details",
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "performedByRole" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'LOW',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SUCCESS';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "collectionOtp" TEXT,
ADD COLUMN     "labReviewedAt" TIMESTAMP(3),
ADD COLUMN     "labReviewedById" TEXT,
ADD COLUMN     "otpVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "labRegNo" TEXT;

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "applicableBranchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "applicableCityIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "applicableCollectionMode" TEXT,
ADD COLUMN     "applicablePackageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "applicablePaymentMode" TEXT,
ADD COLUMN     "applicableTestIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "applicableUserType" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isFirstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "perUserLimit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "startsAt" TIMESTAMP(3),
ADD COLUMN     "updatedById" TEXT,
ALTER COLUMN "discountType" SET DEFAULT 'PERCENTAGE';

-- AlterTable
ALTER TABLE "PathologyPartner" ADD COLUMN     "availability" JSONB;

-- AlterTable
ALTER TABLE "PaymentMethod" DROP COLUMN "bank",
DROP COLUMN "type",
ADD COLUMN     "cardBrand" TEXT NOT NULL,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "doctorDesignation" TEXT,
ADD COLUMN     "doctorName" TEXT,
ADD COLUMN     "doctorQualification" TEXT,
ADD COLUMN     "doctorRegNo" TEXT,
ADD COLUMN     "doctorRemarks" TEXT,
ADD COLUMN     "doctorVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "pdfPublicId" TEXT,
ADD COLUMN     "pdfUploadedAt" TIMESTAMP(3),
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "recipientId" TEXT,
ADD COLUMN     "recipientType" TEXT,
ADD COLUMN     "reportBranchId" TEXT,
ADD COLUMN     "technicianRemarks" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "altMobile" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "dob" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "otpHash" TEXT,
ADD COLUMN     "otpLastSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UpiMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "upiId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpiMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingIntent" (
    "id" TEXT NOT NULL,
    "razorpayOrderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "bookingPayload" JSONB NOT NULL,
    "pricingSnapshot" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiRequestLog" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "ip" TEXT,
    "userId" TEXT,
    "userRole" TEXT,
    "requestId" TEXT,
    "userAgent" TEXT,
    "branchId" TEXT,
    "responseSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAuditLog" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRejection" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingRejection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "notes" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'AI_ACTIVE',
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAssignment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "sampleType" TEXT NOT NULL,
    "condition" "SampleCondition" NOT NULL DEFAULT 'GOOD',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "status" "SampleStatus" NOT NULL DEFAULT 'RECEIVED',
    "processingStartedAt" TIMESTAMP(3),
    "branchId" TEXT,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "discount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponAuditLog" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "couponCode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedById" TEXT,
    "performedByRole" TEXT,
    "ipAddress" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "couponDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "collectionCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "couponCode" TEXT,
    "couponId" TEXT,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "method" TEXT,
    "gateway" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "status" "PaymentTxStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceNumber" TEXT,
    "receiptNumber" TEXT,
    "invoiceUrl" TEXT,
    "invoicePublicId" TEXT,
    "invoiceGeneratedAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "receiptPublicId" TEXT,
    "receiptGeneratedAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "collectedById" TEXT,
    "branchId" TEXT,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "webhookVerified" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorDescription" TEXT,
    "method" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "razorpayOrderId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSnapshot" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "testIds" TEXT[],
    "packageIds" TEXT[],
    "subtotal" DOUBLE PRECISION NOT NULL,
    "testDiscount" DOUBLE PRECISION NOT NULL,
    "couponCode" TEXT,
    "couponId" TEXT,
    "couponDiscount" DOUBLE PRECISION NOT NULL,
    "collectionCharge" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL,
    "finalAmount" DOUBLE PRECISION NOT NULL,
    "collectionMode" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastInvoiceSeq" INTEGER NOT NULL DEFAULT 0,
    "lastReceiptSeq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "razorpayRefundId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "approvalNotes" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "processedAt" TIMESTAMP(3),
    "gatewayResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "settlementRef" TEXT NOT NULL,
    "franchiseId" TEXT,
    "franchiseName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totalBusiness" DOUBLE PRECISION NOT NULL,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxOnCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPayable" DOUBLE PRECISION NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "payoutReference" TEXT,
    "gatewayResponse" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "settlementId" TEXT,
    "bookingRef" TEXT,
    "txReference" TEXT,
    "performedById" TEXT,
    "performedByRole" TEXT,
    "ipAddress" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "gstNumber" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemType" "InventoryItemType" NOT NULL DEFAULT 'REAGENT',
    "supplierId" TEXT,
    "manufacturer" TEXT,
    "unit" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxCapacity" DOUBLE PRECISION,
    "batchNumber" TEXT,
    "lotNumber" TEXT,
    "manufacturingDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "quantityBefore" DOUBLE PRECISION NOT NULL,
    "quantityAfter" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "referenceNumber" TEXT,
    "remarks" TEXT,
    "performedById" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestConsumptionRule" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityPerTest" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestConsumptionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDelivery" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "status" "POStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "receivedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT,
    "linkType" TEXT NOT NULL DEFAULT 'Package',
    "linkValue" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "layoutSections" JSONB NOT NULL DEFAULT '[]',
    "categoryOrder" JSONB NOT NULL DEFAULT '[]',
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "maintenance" JSONB NOT NULL DEFAULT '{}',
    "minVersion" JSONB NOT NULL DEFAULT '{}',
    "contactInfo" JSONB NOT NULL DEFAULT '{}',
    "socialLinks" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CmsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsEmergencyAlert" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "branches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEmergencyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "minimumHomeCollectionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "homeCollectionCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultPartnerCommission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "labOpenTime" TEXT NOT NULL DEFAULT '06:00',
    "labCloseTime" TEXT NOT NULL DEFAULT '22:00',
    "reportDeliveryMode" "ReportDeliveryMode" NOT NULL DEFAULT 'AUTO_PUSH',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "platformVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "allowBookings" BOOLEAN NOT NULL DEFAULT true,
    "allowPartnerRegistration" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "adminRole" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CmsAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "deepLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "fcmResponse" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_razorpayOrderId_key" ON "BookingIntent"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_idempotencyKey_key" ON "BookingIntent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingIntent_bookingId_key" ON "BookingIntent"("bookingId");

-- CreateIndex
CREATE INDEX "BookingIntent_razorpayOrderId_idx" ON "BookingIntent"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "BookingIntent_userId_idx" ON "BookingIntent"("userId");

-- CreateIndex
CREATE INDEX "BookingIntent_status_idx" ON "BookingIntent"("status");

-- CreateIndex
CREATE INDEX "BookingIntent_expiresAt_idx" ON "BookingIntent"("expiresAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_createdAt_idx" ON "ApiRequestLog"("createdAt");

-- CreateIndex
CREATE INDEX "ApiRequestLog_statusCode_idx" ON "ApiRequestLog"("statusCode");

-- CreateIndex
CREATE INDEX "ApiRequestLog_method_idx" ON "ApiRequestLog"("method");

-- CreateIndex
CREATE INDEX "ApiRequestLog_userId_idx" ON "ApiRequestLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRejection_bookingId_partnerId_key" ON "BookingRejection"("bookingId", "partnerId");

-- CreateIndex
CREATE INDEX "Prescription_userId_idx" ON "Prescription"("userId");

-- CreateIndex
CREATE INDEX "Prescription_status_idx" ON "Prescription"("status");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_bookingId_key" ON "Sample"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_accessionNumber_key" ON "Sample"("accessionNumber");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "Sample"("status");

-- CreateIndex
CREATE INDEX "Sample_bookingId_idx" ON "Sample"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_bookingId_key" ON "CouponRedemption"("bookingId");

-- CreateIndex
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_couponId_userId_bookingId_key" ON "CouponRedemption"("couponId", "userId", "bookingId");

-- CreateIndex
CREATE INDEX "CouponAuditLog_couponId_idx" ON "CouponAuditLog"("couponId");

-- CreateIndex
CREATE INDEX "CouponAuditLog_action_idx" ON "CouponAuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayOrderId_key" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_razorpayPaymentId_key" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_invoiceNumber_key" ON "Payment"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_paymentId_idx" ON "PaymentAttempt"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_createdAt_idx" ON "PaymentAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventId_idx" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_event_idx" ON "WebhookEvent"("event");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_razorpayOrderId_idx" ON "WebhookEvent"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingSnapshot_bookingId_key" ON "PricingSnapshot"("bookingId");

-- CreateIndex
CREATE INDEX "PricingSnapshot_bookingId_idx" ON "PricingSnapshot"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_razorpayRefundId_key" ON "Refund"("razorpayRefundId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_bookingId_idx" ON "Refund"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_settlementRef_key" ON "Settlement"("settlementRef");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE INDEX "Settlement_periodStart_idx" ON "Settlement"("periodStart");

-- CreateIndex
CREATE INDEX "FinanceAuditLog_action_idx" ON "FinanceAuditLog"("action");

-- CreateIndex
CREATE INDEX "FinanceAuditLog_createdAt_idx" ON "FinanceAuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "InventoryItem_branchId_idx" ON "InventoryItem"("branchId");

-- CreateIndex
CREATE INDEX "InventoryItem_itemType_idx" ON "InventoryItem"("itemType");

-- CreateIndex
CREATE INDEX "InventoryItem_expiryDate_idx" ON "InventoryItem"("expiryDate");

-- CreateIndex
CREATE INDEX "InventoryTransaction_inventoryItemId_idx" ON "InventoryTransaction"("inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_transactionType_idx" ON "InventoryTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "TestConsumptionRule_testId_idx" ON "TestConsumptionRule"("testId");

-- CreateIndex
CREATE UNIQUE INDEX "TestConsumptionRule_testId_inventoryItemId_key" ON "TestConsumptionRule"("testId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPage_slug_key" ON "CmsPage"("slug");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_userId_token_key" ON "DeviceToken"("userId", "token");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_severity_idx" ON "AuditLog"("severity");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "UpiMethod" ADD CONSTRAINT "UpiMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingIntent" ADD CONSTRAINT "BookingIntent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportBranchId_fkey" FOREIGN KEY ("reportBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAuditLog" ADD CONSTRAINT "ReportAuditLog_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRejection" ADD CONSTRAINT "BookingRejection_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponAuditLog" ADD CONSTRAINT "CouponAuditLog_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAuditLog" ADD CONSTRAINT "FinanceAuditLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAuditLog" ADD CONSTRAINT "FinanceAuditLog_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAuditLog" ADD CONSTRAINT "FinanceAuditLog_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestConsumptionRule" ADD CONSTRAINT "TestConsumptionRule_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
