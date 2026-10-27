import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { ACTIVE_TICKET_STATUSES } from '../../tickets/ticket-status';
import { pageResult, resolvePage } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminSettingsService } from '../settings/admin-settings.service';
import {
  enumerateBuckets,
  measurementState,
  observedCount,
  percentDelta,
  resolvePeriod,
  truncate,
  type ResolvedPeriod,
} from './admin-period';

const SERIES = [
  'signups',
  'activeUsers',
  'contentViews',
  'huntViews',
  'forumPosts',
  'tickets',
  'contributions',
] as const;

type SeriesMetric = (typeof SERIES)[number];

type BucketRow = { bucket: Date; value: number };

type AdminSearchHit = {
  type: 'user' | 'creature' | 'hunt' | 'ticket';
  id: string;
  label: string;
  href: string;
};

@Injectable()
export class AdminInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AdminSettingsService,
  ) {}

  async overview(query: { preset?: string; from?: string; to?: string }) {
    const period = resolvePeriod(query);
    const coverage = await this.coverageStartedAt();
    const currentViews = measurementState(coverage, period.from, period.to);
    const previousViews = measurementState(
      coverage,
      period.previousFrom,
      period.previousTo,
    );
    const amounts = await this.settings.amounts();
    const [
      usersTotal,
      signups,
      signupsPrev,
      active,
      activePrev,
      logins,
      loginsPrev,
      hunts,
      huntsNew,
      creatures,
      topics,
      topicsPrev,
      replies,
      repliesPrev,
      openTickets,
      reviewTickets,
      waitingUserTickets,
      waitingStaffTickets,
      pendingContributions,
      huntViews,
      huntViewsPrev,
      bestiaryUpdates,
      bestiaryUpdatesPrev,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.created(this.prisma.user, period.from, period.to),
      this.created(this.prisma.user, period.previousFrom, period.previousTo),
      this.activeUsers(period.from, period.to),
      this.activeUsers(period.previousFrom, period.previousTo),
      this.created(this.prisma.authSession, period.from, period.to),
      this.created(
        this.prisma.authSession,
        period.previousFrom,
        period.previousTo,
      ),
      this.prisma.hunt.count({ where: { isActive: true } }),
      this.created(this.prisma.hunt, period.from, period.to),
      this.prisma.creature.count({ where: { isActive: true } }),
      this.created(this.prisma.forumThread, period.from, period.to),
      this.created(
        this.prisma.forumThread,
        period.previousFrom,
        period.previousTo,
      ),
      this.created(this.prisma.forumReply, period.from, period.to),
      this.created(
        this.prisma.forumReply,
        period.previousFrom,
        period.previousTo,
      ),
      this.prisma.ticket.count({ where: { status: 'OPEN' } }),
      this.prisma.ticket.count({ where: { status: 'IN_REVIEW' } }),
      this.prisma.ticket.count({ where: { status: 'WAITING_ON_USER' } }),
      this.prisma.ticket.count({ where: { status: 'WAITING_ON_STAFF' } }),
      this.prisma.huntUpdateRequest.count({
        where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
      }),
      this.prisma.contentViewEvent.count({
        where: {
          subject: 'HUNT',
          createdAt: { gte: period.from, lt: period.to },
        },
      }),
      this.prisma.contentViewEvent.count({
        where: {
          subject: 'HUNT',
          createdAt: { gte: period.previousFrom, lt: period.previousTo },
        },
      }),
      this.prisma.userBestiaryProgress.count({
        where: { updatedAt: { gte: period.from, lt: period.to } },
      }),
      this.prisma.userBestiaryProgress.count({
        where: {
          updatedAt: { gte: period.previousFrom, lt: period.previousTo },
        },
      }),
    ]);
    const overdue = amounts.has('sla.resolutionMinutes')
      ? await this.overdueCount(amounts.get('sla.resolutionMinutes')!)
      : null;

    const metrics = [
      this.card({
        key: 'usersTotal',
        label: 'Usuários cadastrados',
        definition: 'Contas existentes, independente do período.',
        source: 'User',
        unit: 'contas',
        window: 'cumulative',
        value: usersTotal,
        href: '/admin/users',
      }),
      this.card({
        key: 'signups',
        label: 'Novos usuários',
        definition: 'Contas criadas dentro do período selecionado.',
        source: 'User.createdAt',
        unit: 'contas',
        window: 'period',
        value: signups,
        previous: signupsPrev,
        href: '/admin/users',
      }),
      this.card({
        key: 'activeUsers',
        label: 'Usuários ativos',
        definition:
          'Pessoas distintas com tópico, resposta, comentário de Hunt, chamado ou visualização identificada no período.',
        source:
          'ForumThread, ForumReply, HuntComment, Ticket, ContentViewEvent',
        unit: 'pessoas',
        window: 'period',
        value: active,
        previous: activePrev,
        href: '/admin/users',
      }),
      this.card({
        key: 'logins',
        label: 'Logins iniciados',
        definition:
          'Sessões de autenticação criadas no período. Não representa visitas de página.',
        source: 'AuthSession.createdAt',
        unit: 'logins',
        window: 'period',
        value: logins,
        previous: loginsPrev,
        href: '/admin/analytics',
      }),
      this.card({
        key: 'hunts',
        label: 'Hunts cadastradas',
        definition: 'Hunts ativas no catálogo. Total acumulado.',
        source: 'Hunt.isActive',
        unit: 'hunts',
        window: 'cumulative',
        value: hunts,
        href: '/admin/hunts',
      }),
      this.card({
        key: 'huntsNew',
        label: 'Hunts novas',
        definition: 'Hunts criadas no período, ativas ou não.',
        source: 'Hunt.createdAt',
        unit: 'hunts',
        window: 'period',
        value: huntsNew,
        href: '/admin/hunts',
      }),
      this.card({
        key: 'huntViews',
        label: 'Visualizações de Hunts',
        definition:
          'Aberturas de uma Hunt, no máximo uma por sessão e hora. A cobertura começa no primeiro evento armazenado.',
        source: 'ContentViewEvent',
        unit: 'visualizações',
        window: 'period',
        value: observedCount(currentViews, huntViews),
        previous: observedCount(previousViews, huntViewsPrev),
        available: currentViews !== 'none',
        unavailableReason:
          currentViews === 'none'
            ? 'Ainda não há visualizações instrumentadas neste período.'
            : null,
        href: '/admin/hunts',
      }),
      this.card({
        key: 'creatures',
        label: 'Criaturas cadastradas',
        definition:
          'Registros ativos do catálogo mestre. Não inclui o progresso individual.',
        source: 'Creature.isActive',
        unit: 'criaturas',
        window: 'cumulative',
        value: creatures,
        href: '/admin/bestiary',
      }),
      this.card({
        key: 'bestiaryActivity',
        label: 'Atividade do Bestiário',
        definition:
          'Progressos individuais atualizados no período. Não mede consultas ao catálogo.',
        source: 'UserBestiaryProgress.updatedAt',
        unit: 'atualizações',
        window: 'period',
        value: bestiaryUpdates,
        previous: bestiaryUpdatesPrev,
        href: '/admin/bestiary',
      }),
      this.card({
        key: 'forumTopics',
        label: 'Tópicos criados',
        definition: 'Tópicos do fórum criados no período.',
        source: 'ForumThread.createdAt',
        unit: 'tópicos',
        window: 'period',
        value: topics,
        previous: topicsPrev,
        href: '/admin/forum',
      }),
      this.card({
        key: 'forumReplies',
        label: 'Respostas publicadas',
        definition: 'Respostas do fórum criadas no período.',
        source: 'ForumReply.createdAt',
        unit: 'respostas',
        window: 'period',
        value: replies,
        previous: repliesPrev,
        href: '/admin/forum',
      }),
      this.card({
        key: 'ticketsOpen',
        label: 'Chamados abertos',
        definition:
          'Chamados no status Aberto agora. Não é filtrado pelo período.',
        source: 'Ticket.status',
        unit: 'chamados',
        window: 'snapshot',
        value: openTickets,
        href: '/admin/tickets?view=OPEN',
      }),
      this.card({
        key: 'ticketsReview',
        label: 'Chamados em atendimento',
        definition: 'Chamados no status Em análise agora.',
        source: 'Ticket.status',
        unit: 'chamados',
        window: 'snapshot',
        value: reviewTickets,
        href: '/admin/tickets?view=IN_REVIEW',
      }),
      this.card({
        key: 'ticketsWaitingUser',
        label: 'Aguardando usuário',
        definition:
          'Chamados em que a equipe espera uma resposta do autor. Estado atual, fora do período.',
        source: 'Ticket.status',
        unit: 'chamados',
        window: 'snapshot',
        value: waitingUserTickets,
        href: '/admin/tickets?view=WAITING_ON_USER',
      }),
      this.card({
        key: 'ticketsWaitingStaff',
        label: 'Aguardando equipe',
        definition:
          'Chamados em que a equipe aguarda outro membro. Estado atual, fora do período.',
        source: 'Ticket.status',
        unit: 'chamados',
        window: 'snapshot',
        value: waitingStaffTickets,
        href: '/admin/tickets?view=WAITING_ON_STAFF',
      }),
      this.card({
        key: 'ticketsOverdue',
        label: 'Chamados fora do prazo',
        definition: amounts.has('sla.resolutionMinutes')
          ? `Abertos ou em análise há mais de ${amounts.get('sla.resolutionMinutes')} minutos corridos, sem resolução.`
          : 'Depende do limite de resolução configurado pela administração.',
        source: 'Ticket',
        unit: 'chamados',
        window: 'snapshot',
        value: overdue,
        available: overdue !== null,
        unavailableReason:
          overdue === null
            ? 'O limite de resolução não está configurado.'
            : null,
        href: '/admin/tickets',
      }),
      this.card({
        key: 'contributionsPending',
        label: 'Contribuições aguardando',
        definition:
          'Solicitações de atualização de Hunt em aberto ou em análise. Resolver uma solicitação não altera a Hunt automaticamente.',
        source: 'HuntUpdateRequest.status',
        unit: 'solicitações',
        window: 'snapshot',
        value: pendingContributions,
        href: '/admin/contributions',
      }),
    ];

    return {
      period: this.periodPayload(period),
      coverageStartedAt: coverage,
      viewMeasurement: currentViews,
      clock: 'elapsed' as const,
      metrics,
    };
  }

  async series(
    metric: string,
    query: { preset?: string; from?: string; to?: string },
  ) {
    if (!SERIES.includes(metric as SeriesMetric)) {
      throw new BadRequestException('Métrica de série desconhecida.');
    }
    const period = resolvePeriod(query);
    const coverage = await this.coverageStartedAt();
    const rows = await this.seriesRows(metric as SeriesMetric, period);
    const measured =
      metric === 'contentViews' || metric === 'huntViews'
        ? measurementState(coverage, period.from, period.to)
        : 'full';
    const buckets = enumerateBuckets(period.from, period.to, period.grain).map(
      (start) => {
        const end = new Date(
          start.getTime() +
            (period.grain === 'hour'
              ? 3_600_000
              : period.grain === 'day'
                ? 86_400_000
                : 1),
        );
        const available =
          measured === 'full' ||
          (coverage !== null &&
            coverage.getTime() <
              (period.grain === 'month'
                ? this.monthEnd(start).getTime()
                : end.getTime()));
        const key = truncate(start, period.grain).toISOString();
        const found = rows.find(
          (row) =>
            truncate(new Date(row.bucket), period.grain).toISOString() === key,
        );
        return {
          start: start.toISOString(),
          value: !available || measured === 'none' ? null : (found?.value ?? 0),
        };
      },
    );
    return {
      metric,
      definition: this.seriesDefinition(metric as SeriesMetric),
      period: this.periodPayload(period),
      coverageStartedAt: coverage,
      measurement: measured,
      buckets,
    };
  }

  async activity() {
    const [tickets, requests, threads, audits] = await Promise.all([
      this.prisma.ticket.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          protocol: true,
          problemType: true,
          createdAt: true,
        },
      }),
      this.prisma.huntUpdateRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          hunt: { select: { name: true } },
        },
      }),
      this.prisma.forumThread.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, title: true, createdAt: true },
      }),
      this.prisma.adminAuditEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          summary: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
    ]);
    const items = [
      ...tickets.map((row) => ({
        at: row.createdAt,
        type: 'ticket',
        title: `Chamado ${row.protocol}`,
        detail: row.problemType,
        href: `/admin/tickets/${row.id}`,
      })),
      ...requests.map((row) => ({
        at: row.createdAt,
        type: 'contribution',
        title: `Correção de Hunt: ${row.hunt.name}`,
        detail: `${row.type} · ${row.status}`,
        href: '/admin/contributions',
      })),
      ...threads.map((row) => ({
        at: row.createdAt,
        type: 'forum',
        title: row.title,
        detail: 'Novo tópico',
        href: `/forum/${row.id}`,
      })),
      ...audits.map((row) => ({
        at: row.createdAt,
        type: 'audit',
        title: row.summary,
        detail: row.action,
        href: '/admin/audit',
      })),
    ]
      .sort((left, right) => right.at.getTime() - left.at.getTime())
      .slice(0, 20);
    return { items };
  }

  async alerts() {
    const amounts = await this.settings.amounts();
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      href: string;
      criterion: string;
    }> = [];
    const unassignedHours = amounts.get('sla.unassignedHours');
    if (unassignedHours) {
      const since = new Date(Date.now() - unassignedHours * 3_600_000);
      const count = await this.prisma.ticket.count({
        where: {
          status: { in: ACTIVE_TICKET_STATUSES },
          assigneeId: null,
          createdAt: { lt: since },
        },
      });
      if (count > 0) {
        items.push({
          id: 'unassigned',
          title: `${count} chamado(s) sem responsável`,
          detail: `Abertos há mais de ${unassignedHours} horas corridas.`,
          href: '/admin/tickets?view=unassigned',
          criterion: 'sla.unassignedHours',
        });
      }
    }
    const resolution = amounts.get('sla.resolutionMinutes');
    if (resolution) {
      const count = await this.overdueCount(resolution);
      if (count > 0) {
        items.push({
          id: 'overdue',
          title: `${count} chamado(s) fora do prazo de resolução`,
          detail: `Limite configurado: ${resolution} minutos corridos.`,
          href: '/admin/tickets',
          criterion: 'sla.resolutionMinutes',
        });
      }
    }
    const first = amounts.get('sla.firstResponseMinutes');
    if (first) {
      const since = new Date(Date.now() - first * 60_000);
      const count = await this.prisma.ticket.count({
        where: {
          status: { in: ACTIVE_TICKET_STATUSES },
          firstResponseAt: null,
          createdAt: { lt: since },
        },
      });
      if (count > 0) {
        items.push({
          id: 'first-response',
          title: `${count} chamado(s) sem primeira resposta`,
          detail: `Limite configurado: ${first} minutos corridos.`,
          href: '/admin/tickets',
          criterion: 'sla.firstResponseMinutes',
        });
      }
    }
    const drop = amounts.get('alert.usageDropPercent');
    if (drop) {
      const period = resolvePeriod({ preset: '7d' });
      const coverage = await this.coverageStartedAt();
      if (
        measurementState(coverage, period.from, period.to) === 'full' &&
        measurementState(coverage, period.previousFrom, period.previousTo) ===
          'full'
      ) {
        const [current, previous] = await Promise.all([
          this.prisma.contentViewEvent.count({
            where: {
              subject: 'HUNT',
              createdAt: { gte: period.from, lt: period.to },
            },
          }),
          this.prisma.contentViewEvent.count({
            where: {
              subject: 'HUNT',
              createdAt: { gte: period.previousFrom, lt: period.previousTo },
            },
          }),
        ]);
        const delta = percentDelta(current, previous);
        if (delta !== null && delta <= -drop) {
          items.push({
            id: 'usage-drop',
            title: 'Queda de visualizações de Hunts',
            detail: `${delta}% nos últimos 7 dias, acima do limite de ${drop}%.`,
            href: '/admin/hunts',
            criterion: 'alert.usageDropPercent',
          });
        }
      }
    }
    const staleDays = amounts.get('alert.staleContentDays');
    if (staleDays) {
      const since = new Date(Date.now() - staleDays * 86_400_000);
      const count = await this.prisma.hunt.count({
        where: { isActive: true, updatedAt: { lt: since } },
      });
      if (count > 0) {
        items.push({
          id: 'stale-hunts',
          title: `${count} Hunt(s) sem atualização recente`,
          detail: `Última alteração há mais de ${staleDays} dias. Isso não indica dado incorreto.`,
          href: '/admin/hunts',
          criterion: 'alert.staleContentDays',
        });
      }
    }
    const pending = await this.prisma.huntUpdateRequest.count({
      where: { status: 'OPEN' },
    });
    if (pending > 0) {
      items.push({
        id: 'pending-contributions',
        title: `${pending} correção(ões) de Hunt sem análise`,
        detail: 'Solicitações ainda no status Aberto.',
        href: '/admin/contributions',
        criterion: 'fila de HuntUpdateRequest OPEN',
      });
    }
    return {
      clock: 'elapsed' as const,
      configured: {
        firstResponse: amounts.has('sla.firstResponseMinutes'),
        resolution: amounts.has('sla.resolutionMinutes'),
        unassigned: amounts.has('sla.unassignedHours'),
        usageDrop: amounts.has('alert.usageDropPercent'),
        staleContent: amounts.has('alert.staleContentDays'),
      },
      items,
    };
  }

  async badges() {
    const [openTickets, unassigned, contributions, redemptions] =
      await Promise.all([
        this.prisma.ticket.count({
          where: { status: { in: ACTIVE_TICKET_STATUSES } },
        }),
        this.prisma.ticket.count({
          where: { status: { in: ACTIVE_TICKET_STATUSES }, assigneeId: null },
        }),
        this.prisma.huntUpdateRequest.count({
          where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
        }),
        this.prisma.rewardRedemption.count({ where: { status: 'PENDING' } }),
      ]);
    return { openTickets, unassigned, contributions, redemptions };
  }

  async huntRankings(query: {
    preset?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    order?: string;
  }) {
    const period = resolvePeriod(query);
    const { page, limit, skip } = resolvePage(query);
    const coverage = await this.coverageStartedAt();
    const measurement = measurementState(coverage, period.from, period.to);
    const order = query.order === 'asc' ? 'ASC' : 'DESC';
    if (order === 'ASC' && measurement !== 'full') {
      return {
        measurement,
        coverageStartedAt: coverage,
        definition:
          'O ranking de menor uso só aparece quando o período inteiro está coberto pela instrumentação.',
        period: this.periodPayload(period),
        items: [],
        page,
        limit,
        total: 0,
        hasMore: false,
      };
    }
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        slug: string;
        location: string;
        updatedAt: Date;
        createdAt: Date;
        views: number;
        readers: number;
      }>
    >`
      SELECT h.id, h.name, h.slug, h.location, h."updatedAt", h."createdAt",
        COUNT(v.id)::int AS views,
        COUNT(DISTINCT v."userId")::int AS readers
      FROM "Hunt" h
      LEFT JOIN "ContentViewEvent" v
        ON v.subject = 'HUNT'
        AND v."subjectId" = h.id
        AND v."createdAt" >= ${period.from}
        AND v."createdAt" < ${period.to}
      WHERE h."isActive" = true
        AND (${order} = 'DESC' OR h."createdAt" < ${period.from})
      GROUP BY h.id
      ORDER BY views ${Prisma.raw(order)}, h.name ASC, h.id ASC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const totalRows = await this.prisma.$queryRaw<Array<{ value: number }>>`
      SELECT COUNT(*)::int AS value FROM "Hunt" h
      WHERE h."isActive" = true
        AND (${order} = 'DESC' OR h."createdAt" < ${period.from})
    `;
    return {
      measurement,
      coverageStartedAt: coverage,
      definition:
        order === 'ASC'
          ? 'Hunts ativas criadas antes do período, ordenadas pelas visualizações observadas. Zero significa nenhum evento na janela, não ausência histórica de uso.'
          : 'Hunts ativas ordenadas pelas visualizações do período. Usuários distintos contam apenas visualizações autenticadas.',
      period: this.periodPayload(period),
      ...pageResult(
        rows.map((row, index) => ({
          position: skip + index + 1,
          ...row,
          views: measurement === 'none' ? null : row.views,
          readers: measurement === 'none' ? null : row.readers,
        })),
        totalRows[0]?.value ?? 0,
        page,
        limit,
      ),
    };
  }

  async huntQuality(query: { page?: number; limit?: number }) {
    const { page, limit, skip } = resolvePage(query);
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        slug: string;
        missingDescription: boolean;
        missingMap: boolean;
        missingVocations: boolean;
        missingCreatures: boolean;
        duplicateName: boolean;
      }>
    >`
      SELECT h.id, h.name, h.slug,
        (h.description IS NULL OR btrim(h.description) = '') AS "missingDescription",
        (h."mapImage" IS NULL OR btrim(h."mapImage") = '') AS "missingMap",
        NOT EXISTS (SELECT 1 FROM "HuntVocation" v WHERE v."huntId" = h.id) AS "missingVocations",
        NOT EXISTS (SELECT 1 FROM "HuntCreature" c WHERE c."huntId" = h.id) AS "missingCreatures",
        EXISTS (
          SELECT 1 FROM "Hunt" other
          WHERE other."isActive" = true AND other.id <> h.id AND lower(other.name) = lower(h.name)
        ) AS "duplicateName"
      FROM "Hunt" h
      WHERE h."isActive" = true
        AND (
          h.description IS NULL OR btrim(h.description) = ''
          OR h."mapImage" IS NULL OR btrim(h."mapImage") = ''
          OR NOT EXISTS (SELECT 1 FROM "HuntVocation" v WHERE v."huntId" = h.id)
          OR NOT EXISTS (SELECT 1 FROM "HuntCreature" c WHERE c."huntId" = h.id)
          OR EXISTS (
            SELECT 1 FROM "Hunt" other
            WHERE other."isActive" = true AND other.id <> h.id AND lower(other.name) = lower(h.name)
          )
        )
      ORDER BY h.name ASC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const totalRows = await this.prisma.$queryRaw<Array<{ value: number }>>`
      SELECT COUNT(*)::int AS value FROM "Hunt" h
      WHERE h."isActive" = true
        AND (
          h.description IS NULL OR btrim(h.description) = ''
          OR h."mapImage" IS NULL OR btrim(h."mapImage") = ''
          OR NOT EXISTS (SELECT 1 FROM "HuntVocation" v WHERE v."huntId" = h.id)
          OR NOT EXISTS (SELECT 1 FROM "HuntCreature" c WHERE c."huntId" = h.id)
          OR EXISTS (
            SELECT 1 FROM "Hunt" other
            WHERE other."isActive" = true AND other.id <> h.id AND lower(other.name) = lower(h.name)
          )
        )
    `;
    return {
      definition:
        'Uma Hunt ativa está incompleta quando falta descrição, mapa, vocação, criatura, ou quando outra Hunt ativa tem o mesmo nome. Conteúdo antigo não entra nesta lista.',
      ...pageResult(rows, totalRows[0]?.value ?? 0, page, limit),
    };
  }

  async creatures(query: { page?: number; limit?: number; search?: string }) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const where: Prisma.CreatureWhereInput = {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.creature.count({ where }),
      this.prisma.creature.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          hp: true,
          experience: true,
          difficulty: true,
          description: true,
          bestiaryEntry: { select: { id: true } },
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        updatedAt: row.updatedAt,
        missingBestiary: row.bestiaryEntry === null,
        missingFields: [
          row.hp === null ? 'HP' : null,
          row.experience === null ? 'experiência' : null,
          row.difficulty === null ? 'dificuldade' : null,
          !row.description?.trim() ? 'descrição' : null,
        ].filter((field): field is string => Boolean(field)),
      })),
      total,
      page,
      limit,
    );
  }

  async forum(query: { preset?: string; from?: string; to?: string }) {
    const period = resolvePeriod(query);
    const [
      topicsTotal,
      topics,
      repliesTotal,
      replies,
      unanswered,
      authors,
      responders,
    ] = await Promise.all([
      this.prisma.forumThread.count(),
      this.created(this.prisma.forumThread, period.from, period.to),
      this.prisma.forumReply.count(),
      this.created(this.prisma.forumReply, period.from, period.to),
      this.prisma.forumThread.count({ where: { replies: { none: {} } } }),
      this.distinctCount(
        Prisma.sql`SELECT COUNT(DISTINCT "authorId")::int AS value FROM "ForumThread" WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}`,
      ),
      this.distinctCount(
        Prisma.sql`SELECT COUNT(DISTINCT "authorId")::int AS value FROM "ForumReply" WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}`,
      ),
    ]);
    return {
      period: this.periodPayload(period),
      definition:
        'Totais históricos ficam separados da atividade do período. Não há denúncias nem reações no fórum atual.',
      topicsTotal,
      topics,
      repliesTotal,
      replies,
      unanswered,
      authors,
      responders,
    };
  }

  async users(query: { page?: number; limit?: number; search?: string }) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            {
              activeCharacter: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          role: true,
          createdAt: true,
          activeCharacter: {
            select: { name: true, level: true, vocation: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        role: row.role,
        createdAt: row.createdAt,
        name: row.activeCharacter?.name ?? null,
        level: row.activeCharacter?.level ?? null,
        vocation: row.activeCharacter?.vocation ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async userDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        activeCharacter: {
          select: { name: true, level: true, vocation: true, world: true },
        },
        rewardWallet: { select: { points: true, gold: true, diamond: true } },
        _count: {
          select: {
            forumThreads: true,
            forumReplies: true,
            huntUpdateRequests: true,
            tickets: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const openTickets = await this.prisma.ticket.count({
      where: { authorId: id, status: { in: ACTIVE_TICKET_STATUSES } },
    });
    const [licenses, recentTickets, activeSessions, devices] =
      await Promise.all([
        this.prisma.billingLicense.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            source: true,
            term: true,
            expiresAt: true,
            grantedAt: true,
            order: {
              select: {
                payments: {
                  orderBy: { createdAt: 'desc' },
                  take: 3,
                  select: {
                    id: true,
                    status: true,
                    amountMinor: true,
                    currency: true,
                    providerPaymentId: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.ticket.findMany({
          where: { authorId: id },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            protocol: true,
            status: true,
            priority: true,
            createdAt: true,
          },
        }),
        this.prisma.authSession.count({
          where: { userId: id, expiresAt: { gt: new Date() } },
        }),
        this.prisma.authDevice.findMany({
          where: { userId: id },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            label: true,
            deviceType: true,
            osName: true,
            clientName: true,
            status: true,
            createdAt: true,
            lastSeenAt: true,
            revokedAt: true,
          },
        }),
      ]);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      character: user.activeCharacter,
      wallet: user.rewardWallet,
      forumThreads: user._count.forumThreads,
      forumReplies: user._count.forumReplies,
      contributions: user._count.huntUpdateRequests,
      tickets: user._count.tickets,
      openTickets,
      activeSessions,
      devices: devices.map((device) => ({
        ...device,
        createdAt: device.createdAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
        revokedAt: device.revokedAt?.toISOString() ?? null,
      })),
      licenses: licenses.map((license) => ({
        id: license.id,
        status:
          license.status === 'ACTIVE' &&
          license.expiresAt &&
          license.expiresAt.getTime() <= Date.now()
            ? 'EXPIRED'
            : license.status,
        source: license.source,
        term: license.term,
        expiresAt: license.expiresAt?.toISOString() ?? null,
        grantedAt: license.grantedAt.toISOString(),
        payments: (license.order?.payments ?? []).map((payment) => ({
          id: payment.id,
          status: payment.status,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          providerPaymentId: payment.providerPaymentId,
          createdAt: payment.createdAt.toISOString(),
        })),
      })),
      recentTickets: recentTickets.map((ticket) => ({
        ...ticket,
        createdAt: ticket.createdAt.toISOString(),
      })),
    };
  }

  async search(term: string) {
    const query = term.trim().slice(0, 80);
    if (query.length < 2) {
      return { items: [] as AdminSearchHit[] };
    }
    const [users, creatures, hunts, tickets] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            {
              activeCharacter: {
                name: { contains: query, mode: 'insensitive' },
              },
            },
          ],
        },
        select: {
          id: true,
          email: true,
          activeCharacter: { select: { name: true } },
        },
        take: 5,
      }),
      this.prisma.creature.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, slug: true },
        take: 5,
      }),
      this.prisma.hunt.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, slug: true },
        take: 5,
      }),
      this.prisma.ticket.findMany({
        where: {
          OR: [
            { protocol: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, protocol: true, status: true },
        take: 5,
      }),
    ]);
    const items: AdminSearchHit[] = [
      ...users.map((user) => ({
        type: 'user' as const,
        id: user.id,
        label: user.activeCharacter?.name || user.email,
        href: `/admin/users/${user.id}`,
      })),
      ...creatures.map((creature) => ({
        type: 'creature' as const,
        id: creature.id,
        label: creature.name,
        href: `/admin/bestiary?search=${encodeURIComponent(creature.name)}`,
      })),
      ...hunts.map((hunt) => ({
        type: 'hunt' as const,
        id: hunt.id,
        label: hunt.name,
        href: `/admin/hunts?search=${encodeURIComponent(hunt.name)}`,
      })),
      ...tickets.map((ticket) => ({
        type: 'ticket' as const,
        id: ticket.id,
        label: ticket.protocol,
        href: `/admin/tickets/${ticket.id}`,
      })),
    ];
    return { items };
  }

  async rankings(
    dimension: string,
    query: {
      preset?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const period = resolvePeriod(query);
    const { page, limit, skip } = resolvePage(query);
    if (dimension === 'ticket-categories') {
      const rows = await this.prisma.ticket.groupBy({
        by: ['problemType'],
        where: { createdAt: { gte: period.from, lt: period.to } },
        _count: { _all: true },
        orderBy: { _count: { problemType: 'desc' } },
      });
      const items = rows.map((row, index) => ({
        position: index + 1,
        id: row.problemType,
        label: row.problemType,
        value: row._count._all,
      }));
      return {
        dimension,
        definition:
          'Chamados criados no período, agrupados pelo tipo de problema.',
        period: this.periodPayload(period),
        ...pageResult(
          items.slice(skip, skip + limit),
          items.length,
          page,
          limit,
        ),
      };
    }
    const source = this.rankingSource(dimension);
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; label: string; value: number }>
    >`
      ${source.countSql(period)}
      ORDER BY value DESC, label ASC, id ASC
      LIMIT ${limit} OFFSET ${skip}
    `;
    const total = await this.distinctCount(source.totalSql(period));
    const ids = rows.map((row) => row.id);
    const previous = ids.length
      ? await this.prisma.$queryRaw<Array<{ id: string; value: number }>>(
          source.previousSql(period, ids),
        )
      : [];
    const previousById = new Map(previous.map((row) => [row.id, row.value]));
    return {
      dimension,
      definition: source.definition,
      period: this.periodPayload(period),
      ...pageResult(
        rows.map((row, index) => ({
          position: skip + index + 1,
          id: row.id,
          label: row.label,
          value: row.value,
          previous: previousById.get(row.id) ?? 0,
          deltaPercent: percentDelta(row.value, previousById.get(row.id) ?? 0),
        })),
        total,
        page,
        limit,
      ),
    };
  }

  async searchMisses(query: { preset?: string; from?: string; to?: string }) {
    const period = resolvePeriod(query);
    const rows = await this.prisma.$queryRaw<
      Array<{ term: string; category: string; value: number }>
    >`
      SELECT term, category, COUNT(*)::int AS value
      FROM "SearchMiss"
      WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
      GROUP BY term, category
      ORDER BY value DESC, term ASC
      LIMIT 50
    `;
    return {
      period: this.periodPayload(period),
      definition:
        'HUNT é uma busca do servidor sem resultados. HUNT_CLIENT é o filtro local da lista carregada no navegador. Nenhum identificador de usuário é gravado.',
      items: rows,
    };
  }

  async huntCatalog(query: {
    page?: number;
    limit?: number;
    search?: string;
    vocation?: string;
  }) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const vocation = (['EK', 'RP', 'ED', 'MS', 'EM'] as const).find(
      (item) => item === query.vocation,
    );
    const where: Prisma.HuntWhereInput = {
      isActive: true,
      ...(vocation ? { vocations: { some: { vocation } } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              {
                creatures: {
                  some: {
                    creature: {
                      name: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.hunt.count({ where }),
      this.prisma.hunt.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          location: true,
          updatedAt: true,
          vocations: {
            select: {
              vocation: true,
              levelMin: true,
              xpPerHour: true,
              profitPerHour: true,
            },
            orderBy: { vocation: 'asc' },
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(rows, total, page, limit);
  }

  async forumThreads(query: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const { page, limit, skip } = resolvePage(query);
    const search = query.search?.trim();
    const where: Prisma.ForumThreadWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { body: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await Promise.all([
      this.prisma.forumThread.count({ where }),
      this.prisma.forumThread.findMany({
        where,
        select: {
          id: true,
          title: true,
          category: true,
          createdAt: true,
          author: {
            select: { activeCharacter: { select: { name: true } } },
          },
          _count: { select: { replies: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
    ]);
    return pageResult(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        createdAt: row.createdAt,
        replies: row._count.replies,
        author: row.author.activeCharacter?.name ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async bossViews(query: { preset?: string; from?: string; to?: string }) {
    const period = resolvePeriod(query);
    const coverage = await this.coverageStartedAt();
    const rows = await this.prisma.contentViewEvent.groupBy({
      by: ['subjectId'],
      where: {
        subject: 'BOSS',
        createdAt: { gte: period.from, lt: period.to },
      },
      _count: { _all: true },
    });
    return {
      period: this.periodPayload(period),
      measurement: measurementState(coverage, period.from, period.to),
      coverageStartedAt: coverage,
      definition:
        'Visualizações de bosses no período, uma por sessão e hora UTC, identificadas pelo slug do catálogo estático.',
      items: rows
        .map((row) => ({ slug: row.subjectId, views: row._count._all }))
        .sort(
          (left, right) =>
            right.views - left.views || left.slug.localeCompare(right.slug),
        ),
    };
  }

  catalog() {
    return {
      clock: 'elapsed',
      viewDefinition:
        'Uma visualização é a abertura de uma Hunt, criatura ou boss por uma sessão pseudônima, deduplicada por hora cheia em UTC. O histórico começa no primeiro evento; períodos anteriores não são estimados.',
      comparisons:
        'A variação percentual só aparece quando o período anterior equivalente tem valor maior que zero.',
    };
  }

  private card(input: {
    key: string;
    label: string;
    definition: string;
    source: string;
    unit: string;
    window: 'snapshot' | 'period' | 'cumulative';
    value: number | null;
    previous?: number | null;
    available?: boolean;
    unavailableReason?: string | null;
    href: string;
  }) {
    const available = input.available !== false && input.value !== null;
    const previous = input.previous ?? null;
    return {
      key: input.key,
      label: input.label,
      definition: input.definition,
      source: input.source,
      unit: input.unit,
      window: input.window,
      value: available ? input.value : null,
      previous: available ? previous : null,
      deltaPercent:
        available && previous !== null && input.value !== null
          ? percentDelta(input.value, previous)
          : null,
      available,
      unavailableReason: input.unavailableReason ?? null,
      href: input.href,
    };
  }

  private periodPayload(period: ResolvedPeriod) {
    return {
      preset: period.preset,
      from: period.from,
      to: period.to,
      previousFrom: period.previousFrom,
      previousTo: period.previousTo,
      grain: period.grain,
      clock: period.clock,
    };
  }

  private created(
    delegate: {
      count: (args: {
        where: { createdAt: { gte: Date; lt: Date } };
      }) => Promise<number>;
    },
    from: Date,
    to: Date,
  ) {
    return delegate.count({ where: { createdAt: { gte: from, lt: to } } });
  }

  private async coverageStartedAt() {
    const rows = await this.prisma.$queryRaw<Array<{ started: Date | null }>>`
      SELECT MIN("createdAt") AS started FROM "ContentViewEvent"
    `;
    return rows[0]?.started ?? null;
  }

  private async activeUsers(from: Date, to: Date) {
    return this.distinctCount(Prisma.sql`
      SELECT COUNT(*)::int AS value FROM (
        SELECT "authorId" AS "userId" FROM "ForumThread"
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        UNION
        SELECT "authorId" FROM "ForumReply"
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        UNION
        SELECT "authorId" FROM "Ticket"
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        UNION
        SELECT "userId" FROM "HuntComment"
          WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        UNION
        SELECT "userId" FROM "ContentViewEvent"
          WHERE "userId" IS NOT NULL
            AND "createdAt" >= ${from} AND "createdAt" < ${to}
      ) people
    `);
  }

  private async distinctCount(query: Prisma.Sql) {
    const rows = await this.prisma.$queryRaw<Array<{ value: number }>>(query);
    return Number(rows[0]?.value ?? 0);
  }

  private async overdueCount(minutes: number) {
    const since = new Date(Date.now() - minutes * 60_000);
    return this.prisma.ticket.count({
      where: {
        status: { in: ACTIVE_TICKET_STATUSES },
        createdAt: { lt: since },
      },
    });
  }

  private monthEnd(start: Date) {
    return new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );
  }

  private async seriesRows(metric: SeriesMetric, period: ResolvedPeriod) {
    const grain = period.grain;
    if (metric === 'activeUsers') {
      return this.prisma.$queryRaw<BucketRow[]>`
        SELECT date_trunc(${grain}, "createdAt") AS bucket, COUNT(DISTINCT "userId")::int AS value
        FROM (
          SELECT "createdAt", "authorId" AS "userId" FROM "ForumThread"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
          UNION ALL
          SELECT "createdAt", "authorId" FROM "ForumReply"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
          UNION ALL
          SELECT "createdAt", "authorId" FROM "Ticket"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
          UNION ALL
          SELECT "createdAt", "userId" FROM "HuntComment"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
          UNION ALL
          SELECT "createdAt", "userId" FROM "ContentViewEvent"
            WHERE "userId" IS NOT NULL
              AND "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
        ) events
        GROUP BY 1
        ORDER BY 1
      `;
    }
    if (metric === 'forumPosts') {
      return this.prisma.$queryRaw<BucketRow[]>`
        SELECT date_trunc(${grain}, "createdAt") AS bucket, COUNT(*)::int AS value
        FROM (
          SELECT "createdAt" FROM "ForumThread"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
          UNION ALL
          SELECT "createdAt" FROM "ForumReply"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
        ) posts
        GROUP BY 1
        ORDER BY 1
      `;
    }
    const table =
      metric === 'signups'
        ? Prisma.raw('"User"')
        : metric === 'tickets'
          ? Prisma.raw('"Ticket"')
          : metric === 'contributions'
            ? Prisma.raw('"HuntUpdateRequest"')
            : Prisma.raw('"ContentViewEvent"');
    const subject =
      metric === 'huntViews' ? Prisma.sql`AND subject = 'HUNT'` : Prisma.sql``;
    return this.prisma.$queryRaw<BucketRow[]>`
      SELECT date_trunc(${grain}, "createdAt") AS bucket, COUNT(*)::int AS value
      FROM ${table}
      WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
      ${subject}
      GROUP BY 1
      ORDER BY 1
    `;
  }

  private seriesDefinition(metric: SeriesMetric) {
    const definitions: Record<SeriesMetric, string> = {
      signups: 'Contas criadas em cada intervalo.',
      activeUsers:
        'Pessoas distintas com atividade de fórum, comentário, chamado ou visualização identificada.',
      contentViews:
        'Visualizações instrumentadas de Hunts, criaturas e bosses.',
      huntViews: 'Visualizações instrumentadas de Hunts.',
      forumPosts: 'Tópicos e respostas criados, somados.',
      tickets: 'Chamados criados.',
      contributions: 'Solicitações de atualização de Hunt criadas.',
    };
    return definitions[metric];
  }

  private rankingSource(dimension: string) {
    if (dimension === 'forum-topics') {
      return {
        definition:
          'Usuários que criaram mais tópicos no período. Empate ordenado pelo nome e pelo identificador.',
        countSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT u.id, COALESCE(c.name, 'Jogador') AS label, COUNT(t.id)::int AS value
          FROM "ForumThread" t
          JOIN "User" u ON u.id = t."authorId"
          LEFT JOIN "Character" c ON c.id = u."activeCharacterId"
          WHERE t."createdAt" >= ${period.from} AND t."createdAt" < ${period.to}
          GROUP BY u.id, c.name
        `,
        totalSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT COUNT(*)::int AS value FROM (
            SELECT "authorId" FROM "ForumThread"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
            GROUP BY "authorId"
          ) ranked
        `,
        previousSql: (period: ResolvedPeriod, ids: string[]) => Prisma.sql`
          SELECT "authorId" AS id, COUNT(*)::int AS value
          FROM "ForumThread"
          WHERE "authorId" IN (${Prisma.join(ids)})
            AND "createdAt" >= ${period.previousFrom}
            AND "createdAt" < ${period.previousTo}
          GROUP BY "authorId"
        `,
      };
    }
    if (dimension === 'forum-replies') {
      return {
        definition: 'Usuários que publicaram mais respostas no período.',
        countSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT u.id, COALESCE(c.name, 'Jogador') AS label, COUNT(r.id)::int AS value
          FROM "ForumReply" r
          JOIN "User" u ON u.id = r."authorId"
          LEFT JOIN "Character" c ON c.id = u."activeCharacterId"
          WHERE r."createdAt" >= ${period.from} AND r."createdAt" < ${period.to}
          GROUP BY u.id, c.name
        `,
        totalSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT COUNT(*)::int AS value FROM (
            SELECT "authorId" FROM "ForumReply"
            WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
            GROUP BY "authorId"
          ) ranked
        `,
        previousSql: (period: ResolvedPeriod, ids: string[]) => Prisma.sql`
          SELECT "authorId" AS id, COUNT(*)::int AS value
          FROM "ForumReply"
          WHERE "authorId" IN (${Prisma.join(ids)})
            AND "createdAt" >= ${period.previousFrom}
            AND "createdAt" < ${period.previousTo}
          GROUP BY "authorId"
        `,
      };
    }
    if (dimension === 'approved-corrections' || dimension === 'suggestions') {
      const approved = dimension === 'approved-corrections';
      return {
        definition: approved
          ? 'Solicitações de Hunt marcadas como resolvidas no período. Não concede pontos.'
          : 'Solicitações de Hunt enviadas no período, independente do resultado.',
        countSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT u.id, COALESCE(c.name, 'Jogador') AS label, COUNT(r.id)::int AS value
          FROM "HuntUpdateRequest" r
          JOIN "User" u ON u.id = r."userId"
          LEFT JOIN "Character" c ON c.id = u."activeCharacterId"
          WHERE ${
            approved
              ? Prisma.sql`r.status = 'RESOLVED' AND r."resolvedAt" >= ${period.from} AND r."resolvedAt" < ${period.to}`
              : Prisma.sql`r."createdAt" >= ${period.from} AND r."createdAt" < ${period.to}`
          }
          GROUP BY u.id, c.name
        `,
        totalSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT COUNT(*)::int AS value FROM (
            SELECT "userId" FROM "HuntUpdateRequest" r
            WHERE ${
              approved
                ? Prisma.sql`r.status = 'RESOLVED' AND r."resolvedAt" >= ${period.from} AND r."resolvedAt" < ${period.to}`
                : Prisma.sql`r."createdAt" >= ${period.from} AND r."createdAt" < ${period.to}`
            }
            GROUP BY "userId"
          ) ranked
        `,
        previousSql: (period: ResolvedPeriod, ids: string[]) => Prisma.sql`
          SELECT "userId" AS id, COUNT(*)::int AS value
          FROM "HuntUpdateRequest" r
          WHERE r."userId" IN (${Prisma.join(ids)})
            AND ${
              approved
                ? Prisma.sql`r.status = 'RESOLVED' AND r."resolvedAt" >= ${period.previousFrom} AND r."resolvedAt" < ${period.previousTo}`
                : Prisma.sql`r."createdAt" >= ${period.previousFrom} AND r."createdAt" < ${period.previousTo}`
            }
          GROUP BY "userId"
        `,
      };
    }
    if (dimension === 'forum-threads') {
      return {
        definition: 'Tópicos com mais respostas criadas no período.',
        countSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT t.id, t.title AS label, COUNT(r.id)::int AS value
          FROM "ForumThread" t
          JOIN "ForumReply" r ON r."threadId" = t.id
          WHERE r."createdAt" >= ${period.from} AND r."createdAt" < ${period.to}
          GROUP BY t.id, t.title
        `,
        totalSql: (period: ResolvedPeriod) => Prisma.sql`
          SELECT COUNT(*)::int AS value FROM (
            SELECT r."threadId" FROM "ForumReply" r
            WHERE r."createdAt" >= ${period.from} AND r."createdAt" < ${period.to}
            GROUP BY r."threadId"
          ) ranked
        `,
        previousSql: (period: ResolvedPeriod, ids: string[]) => Prisma.sql`
          SELECT "threadId" AS id, COUNT(*)::int AS value
          FROM "ForumReply"
          WHERE "threadId" IN (${Prisma.join(ids)})
            AND "createdAt" >= ${period.previousFrom}
            AND "createdAt" < ${period.previousTo}
          GROUP BY "threadId"
        `,
      };
    }
    throw new BadRequestException('Ranking desconhecido.');
  }
}
