import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ObservabilidadEvento } from '../atracciones/entities/observabilidad-evento.entity';
import { BrowserBatchDto, BrowserEventDto, CATEGORIES } from './telemetry.dto';
import { sanitizeEvent } from './telemetry-safety';
import { Subject, concatMap, defer, merge, takeUntil, timer, auditTime, map } from 'rxjs';

@Injectable()
export class ObservabilidadService {
  private readonly persisted = new Subject<void>();
  stream() {
    // Persist first, then publish. Periodic reconciliation sees other instances.
    return merge(timer(0, 15000), this.persisted).pipe(
      auditTime(100), concatMap(() => defer(() => this.recent())),
      map(data => ({ type: 'snapshot', data })),
      // Renew connection and authorization every 55 seconds.
      takeUntil(timer(55000)),
    );
  }
  constructor(@InjectRepository(ObservabilidadEvento) private readonly repository: Repository<ObservabilidadEvento>) {}
  async ingest(batch: BrowserBatchDto) {
    if (Buffer.byteLength(JSON.stringify(batch), 'utf8') > 48 * 1024) throw new BadRequestException('Batch demasiado grande.');
    const events = batch.events.map(sanitizeEvent);
    await this.repository.save(events.map(event => this.repository.create({
      tipoEvento: `BROWSER_${event.category}`, endpointRuta: event.route, userId: null,
      latenciaMs: typeof event.payload.durationMs === 'number' ? Math.round(event.payload.durationMs) : null,
      payloadJson: { category: event.category, type: event.type, timestamp: event.timestamp, sessionId: event.sessionId, payload: event.payload },
    })));
    this.persisted.next();
    return { accepted: events.length };
  }
  async recent() {
    const rows = await this.repository.find({ where: { tipoEvento: In(CATEGORIES.map(category => `BROWSER_${category}`)) }, order: { createdAt: 'DESC', id: 'DESC' }, take: 100 });
    const events = rows.map(row => {
      const data = row.payloadJson as unknown as BrowserEventDto;
      const clean = sanitizeEvent({ ...data, route: row.endpointRuta });
      return { ...clean, id: row.id, receivedAt: row.createdAt.toISOString() };
    });
    const counts = Object.fromEntries(CATEGORIES.map(category => [category, events.filter(event => event.category === category).length]));
    const navigations = events.filter(event => event.type === 'navigation_timing' && typeof event.payload.loadMs === 'number');
    return { events, summary: {
      sampleSize: events.length, sampleLimit: 100, counts,
      navigationSamples: navigations.length,
      averageLoadMs: navigations.length >= 2 ? navigations.reduce((sum, event) => sum + Number(event.payload.loadMs), 0) / navigations.length : null,
    }, generatedAt: new Date().toISOString() };
  }
}
