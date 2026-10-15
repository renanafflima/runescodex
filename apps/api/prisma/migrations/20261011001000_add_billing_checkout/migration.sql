-- AlterEnum
ALTER TYPE "BillingEventType" ADD VALUE 'PAYMENT_PENDING';

-- AlterTable
ALTER TABLE "BillingPayment" ADD COLUMN "providerCheckoutId" TEXT;
ALTER TABLE "BillingPayment" ADD COLUMN "checkoutUrl" TEXT;
