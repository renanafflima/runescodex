import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuditService } from '../../audit/admin-audit.service';
import { BillingCheckoutAttemptService } from '../../billing/billing-checkout-attempt.service';
import { BillingService } from '../../billing/billing.service';
import {
  APPROVED_BILLING_PRICES,
  MERCADO_PAGO_PROVIDER,
} from '../../billing/billing.constants';
import { MercadoPagoClient } from '../../billing/mercado-pago.client';
import { mapMercadoPagoStatus } from '../../billing/mercado-pago.status';
import { PrismaService } from '../../prisma/prisma.service';
import type { ReconcileCheckoutAttemptDto } from './admin-checkout-attempt.dto';

export type CheckoutAttemptEvidence = {
  recommended: 'READY' | 'FAILED' | 'UNKNOWN';
  preferenceLookup:
    | 'found'
    | 'not_found'
    | 'inconclusive'
    | 'invalid_id'
    | 'skipped';
  localPaymentId: string | null;
  matchingApprovedPayments: number;
  notes: string[];
};

@Injectable()
export class AdminCheckoutAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: BillingCheckoutAttemptService,
    private readonly billing: BillingService,
    private readonly mercadoPago: MercadoPagoClient,
    private readonly audit: AdminAuditService,
  ) {}

  async inspect(id: string) {
    const attempt = await this.attempts.getById(id);
    if (!attempt) {
      throw new NotFoundException('Checkout attempt not found');
    }
    const evidence = await this.collectEvidence(attempt);
    return {
      attempt: {
        id: attempt.id,
        orderId: attempt.orderId,
        userId: attempt.userId,
        generation: attempt.generation,
        state: attempt.state,
        providerCheckoutId: attempt.providerCheckoutId,
        billingPaymentId: attempt.billingPaymentId,
        lastErrorCode: attempt.lastErrorCode,
        completedAt: attempt.completedAt,
      },
      evidence: {
        recommended: evidence.recommended,
        preferenceLookup: evidence.preferenceLookup,
        localPaymentId: evidence.localPaymentId,
        matchingApprovedPayments: evidence.matchingApprovedPayments,
        notes: evidence.notes,
      },
    };
  }

  async reconcile(
    actorUserId: string,
    id: string,
    dto: ReconcileCheckoutAttemptDto,
  ) {
    const reason = dto.reason.trim();
    if (reason.length < 8) {
      throw new BadRequestException('A justificativa é obrigatória');
    }
    const attempt = await this.attempts.getById(id);
    if (!attempt) {
      throw new NotFoundException('Checkout attempt not found');
    }
    if (attempt.state !== 'UNKNOWN') {
      throw new ConflictException(
        'Only UNKNOWN checkout attempts can be reconciled',
      );
    }

    const evidence = await this.collectEvidence(attempt);
    if (dto.outcome === 'READY') {
      if (evidence.recommended !== 'READY') {
        throw new BadRequestException(
          'READY requires a stored payment or a confirmed existing preference',
        );
      }
      let paymentId = evidence.localPaymentId;
      if (!paymentId) {
        if (!attempt.providerCheckoutId || !evidence.initPoint) {
          throw new BadRequestException(
            'READY requires a BillingPayment matched to the preference',
          );
        }
        const attached = await this.billing.attachCheckout({
          orderId: attempt.orderId,
          provider: MERCADO_PAGO_PROVIDER,
          providerCheckoutId: attempt.providerCheckoutId,
          checkoutUrl: evidence.initPoint,
        });
        const stored = await this.prisma.billingPayment.findFirst({
          where: {
            orderId: attached.orderId,
            providerCheckoutId: attempt.providerCheckoutId,
          },
          orderBy: { createdAt: 'desc' },
        });
        paymentId = stored?.id ?? null;
      }
      if (!paymentId || !attempt.providerCheckoutId) {
        throw new BadRequestException(
          'READY requires a BillingPayment matched to the preference',
        );
      }
      const updated = await this.attempts.reconcileUnknown({
        id: attempt.id,
        outcome: 'READY',
        providerCheckoutId: attempt.providerCheckoutId,
        billingPaymentId: paymentId,
      });
      await this.audit.record({
        actorUserId,
        action: 'checkout.attempt.reconcile',
        entityType: 'checkout_attempt',
        entityId: attempt.id,
        summary: 'Checkout attempt reconciled to READY',
        metadata: {
          outcome: 'READY',
          reason,
          recommended: evidence.recommended,
          preferenceLookup: evidence.preferenceLookup,
        },
      });
      return { id: updated.id, state: updated.state };
    }

    if (evidence.recommended !== 'FAILED') {
      throw new BadRequestException(
        'FAILED requires proof that the preference is absent and unpaid',
      );
    }
    const updated = await this.attempts.reconcileUnknown({
      id: attempt.id,
      outcome: 'FAILED',
      errorCode: 'admin_reconciled_absent',
      errorMessage: 'Administrator confirmed the preference was not created',
    });
    await this.audit.record({
      actorUserId,
      action: 'checkout.attempt.reconcile',
      entityType: 'checkout_attempt',
      entityId: attempt.id,
      summary: 'Checkout attempt reconciled to FAILED',
      metadata: {
        outcome: 'FAILED',
        reason,
        recommended: evidence.recommended,
        preferenceLookup: evidence.preferenceLookup,
      },
    });
    return { id: updated.id, state: updated.state };
  }

  private async collectEvidence(attempt: {
    id: string;
    orderId: string;
    providerCheckoutId: string | null;
    billingPaymentId: string | null;
  }): Promise<
    CheckoutAttemptEvidence & {
      providerCheckoutId: string | null;
      initPoint: string | null;
    }
  > {
    const notes: string[] = [];
    const approved = APPROVED_BILLING_PRICES.BR;
    const localPayments = await this.prisma.billingPayment.findMany({
      where: { orderId: attempt.orderId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        providerCheckoutId: true,
        providerPaymentId: true,
        status: true,
      },
    });
    const matchedLocal = attempt.providerCheckoutId
      ? localPayments.find(
          (row) => row.providerCheckoutId === attempt.providerCheckoutId,
        )
      : attempt.billingPaymentId
        ? localPayments.find((row) => row.id === attempt.billingPaymentId)
        : undefined;

    let preferenceLookup: CheckoutAttemptEvidence['preferenceLookup'] =
      'skipped';
    let initPoint: string | null = null;
    if (attempt.providerCheckoutId) {
      const lookup = await this.mercadoPago.lookupPreference(
        attempt.providerCheckoutId,
      );
      preferenceLookup = lookup.status;
      initPoint = lookup.initPoint;
      if (lookup.status === 'inconclusive') {
        notes.push('Preference lookup was inconclusive');
      }
    } else {
      notes.push('Attempt has no stored preference id');
    }

    let matchingApprovedPayments = 0;
    let paymentSearchInconclusive = false;
    try {
      const remote = await this.mercadoPago.searchPayments(attempt.orderId);
      matchingApprovedPayments = remote.filter((payment) => {
        const type = mapMercadoPagoStatus(payment.status);
        const matchesPrice =
          payment.currency === approved.currency &&
          payment.amountMinor === approved.amountMinor;
        const matchesPreference =
          !attempt.providerCheckoutId ||
          payment.preferenceId === attempt.providerCheckoutId;
        return type === 'PAYMENT_PAID' && matchesPrice && matchesPreference;
      }).length;
    } catch {
      paymentSearchInconclusive = true;
      notes.push('Payment search was inconclusive');
    }

    const localPaymentId = matchedLocal?.id ?? null;

    const recommended = this.recommend({
      localPaymentId,
      preferenceLookup,
      initPoint,
      matchingApprovedPayments,
      paymentSearchInconclusive,
      hasPreferenceId: Boolean(attempt.providerCheckoutId),
    });
    if (recommended === 'UNKNOWN') {
      notes.push('Evidence is not conclusive');
    }

    return {
      recommended,
      preferenceLookup,
      localPaymentId,
      matchingApprovedPayments,
      notes,
      providerCheckoutId: attempt.providerCheckoutId,
      initPoint,
    };
  }

  private recommend(input: {
    localPaymentId: string | null;
    preferenceLookup: CheckoutAttemptEvidence['preferenceLookup'];
    initPoint: string | null;
    matchingApprovedPayments: number;
    paymentSearchInconclusive: boolean;
    hasPreferenceId: boolean;
  }): 'READY' | 'FAILED' | 'UNKNOWN' {
    if (input.localPaymentId) {
      return 'READY';
    }
    if (input.preferenceLookup === 'found' && input.initPoint) {
      return 'READY';
    }
    if (
      input.hasPreferenceId &&
      input.preferenceLookup === 'not_found' &&
      !input.paymentSearchInconclusive &&
      input.matchingApprovedPayments === 0 &&
      !input.localPaymentId
    ) {
      return 'FAILED';
    }
    return 'UNKNOWN';
  }
}
