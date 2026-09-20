import { Injectable, Logger } from '@nestjs/common';
import { google, calendar_v3 } from 'googleapis';
import { GoogleAuthClient } from '../auth/google-auth.client';

export interface CalendarEventInput {
  titulo: string;
  descripcion?: string;
  /** Fecha/hora límite de la tarea. */
  fechaLimite: Date;
  /** Duración del bloque en minutos (por defecto 60). */
  duracionMin?: number;
}

/**
 * Envoltura de la Google Calendar API. Crea, actualiza y borra eventos
 * en el calendario "primary" del usuario autenticado.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(private readonly googleAuth: GoogleAuthClient) {}

  private async getClient(): Promise<calendar_v3.Calendar> {
    const auth = await this.googleAuth.getAuthenticatedClient();
    return google.calendar({ version: 'v3', auth });
  }

  private buildEventBody(input: CalendarEventInput): calendar_v3.Schema$Event {
    const start = new Date(input.fechaLimite);
    const end = new Date(
      start.getTime() + (input.duracionMin ?? 60) * 60_000,
    );
    return {
      summary: input.titulo,
      description: input.descripcion,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 24 * 60 }, // 1 día antes
          { method: 'popup', minutes: 60 }, // 1 hora antes
        ],
      },
    };
  }

  /** Crea un evento y devuelve su id. */
  async createEvent(input: CalendarEventInput): Promise<string | null> {
    const calendar = await this.getClient();
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: this.buildEventBody(input),
    });
    this.logger.log(`Evento de Calendar creado: ${data.id}`);
    return data.id ?? null;
  }

  /** Actualiza un evento existente. */
  async updateEvent(
    eventId: string,
    input: CalendarEventInput,
  ): Promise<void> {
    const calendar = await this.getClient();
    await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: this.buildEventBody(input),
    });
    this.logger.log(`Evento de Calendar actualizado: ${eventId}`);
  }

  /** Borra un evento. No lanza si ya no existe (410/404). */
  async deleteEvent(eventId: string): Promise<void> {
    const calendar = await this.getClient();
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId });
      this.logger.log(`Evento de Calendar eliminado: ${eventId}`);
    } catch (err: any) {
      const status = err?.code ?? err?.response?.status;
      if (status === 404 || status === 410) {
        this.logger.warn(`El evento ${eventId} ya no existía en Calendar.`);
        return;
      }
      throw err;
    }
  }
}
