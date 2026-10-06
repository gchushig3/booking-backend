import { BadRequestException } from '@nestjs/common';
import { BrowserEventDto, Category, TYPES } from './telemetry.dto';

export const FIELDS: Record<Category, readonly string[]> = {
  PERFORMANCE: ['durationMs', 'domContentLoadedMs', 'loadMs', 'resourceCount', 'resourceDurationMs'],
  ERROR: ['message', 'filename', 'line', 'reason'], RESOURCE_ERROR: ['tag', 'url'],
  INTERACTION: ['tag', 'role', 'action'], VISIBILITY: ['state'], VIEWPORT: ['width', 'height', 'devicePixelRatio'],
  CONNECTION: ['supported', 'effectiveType', 'downlink', 'rtt', 'saveData'],
  CAPABILITY: ['performance', 'navigationTiming', 'networkInformation', 'localStorage', 'sessionStorage', 'eventSource', 'webSocket', 'serviceWorker', 'sendBeacon'],
  HTTP: ['method', 'url', 'durationMs', 'status'], DOMAIN: ['action', 'step', 'result'],
};
const NUMBER_FIELDS = new Set(['durationMs', 'domContentLoadedMs', 'loadMs', 'resourceCount', 'resourceDurationMs', 'line', 'width', 'height', 'devicePixelRatio', 'downlink', 'rtt', 'status']);
const BOOLEAN_FIELDS = new Set(['supported', 'saveData', 'performance', 'navigationTiming', 'networkInformation', 'localStorage', 'sessionStorage', 'eventSource', 'webSocket', 'serviceWorker', 'sendBeacon']);
export function safeText(value: string): string {
  return value.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => safeUrl(url))
    .replace(/Bearer\s+\S+/gi, '[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){1,2}\b/g, '[redacted]')
    .replace(/(?:password|token|authorization|cookies?|pan|cvv|cvc|secret|cedula|cédula|identity_number)["']?\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n}]+)/gi, '[redacted]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[redacted]')
    .replace(/\b\d{7,}\b/g, '[redacted]').slice(0, 240);
}
export function safeUrl(value: string): string {
  try {
    const url = new URL(value, 'http://telemetry.invalid');
    if (!['http:', 'https:'].includes(url.protocol)) return '/unsupported-url';
    const path = url.pathname.split('/').map(segment => {
      let decoded: string;
      try { decoded = decodeURIComponent(segment); } catch { return '[redacted]'; }
      return decoded.length > 64 || /@|\b\d{7,}\b|eyJ|(?:password|token|authorization|cookie|pan|cvv|cvc|secret|cedula|cédula|identity_number)[=:]/i.test(decoded) ? '[redacted]' : segment;
    }).join('/');
    return (url.origin === 'http://telemetry.invalid' ? path : `${url.origin}${path}`).slice(0, 200);
  } catch { return '/invalid-url'; }
}
export function sanitizeEvent(event: BrowserEventDto): BrowserEventDto {
  if (!TYPES[event.category]?.includes(event.type)) throw new BadRequestException('Tipo de telemetría no permitido.');
  if (Buffer.byteLength(JSON.stringify(event.payload), 'utf8') > 2048) throw new BadRequestException('Payload de telemetría demasiado grande.');
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event.payload)) {
    if (!FIELDS[event.category].includes(key)) throw new BadRequestException('Campo de telemetría no permitido.');
    const expected = NUMBER_FIELDS.has(key) ? 'number' : BOOLEAN_FIELDS.has(key) ? 'boolean' : 'string';
    if (typeof value !== expected) throw new BadRequestException('Tipo de campo de telemetría inválido.');
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value > 1e9) throw new BadRequestException('Valor numérico de telemetría inválido.');
      payload[key] = value;
    } else if (typeof value === 'boolean') payload[key] = value;
    else if (typeof value === 'string' && value.length <= 300) payload[key] = key === 'url' || key === 'filename' ? safeUrl(value) : safeText(value);
    else throw new BadRequestException('Solo se admiten valores técnicos planos y limitados.');
  }
  if (event.category === 'VISIBILITY' && !['visible', 'hidden'].includes(String(payload.state))) throw new BadRequestException('Visibilidad inválida.');
  return { ...event, route: new URL(safeUrl(event.route), 'http://telemetry.invalid').pathname.slice(0, 200), payload };
}
