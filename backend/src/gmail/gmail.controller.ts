import { Body, Controller, Post } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { ScanEmailsDto } from './dto/scan-emails.dto';

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

  /**
   * Escanea correos recientes por palabras clave y devuelve las tareas
   * académicas extraídas con Gemini.
   */
  @Post('scan')
  scan(@Body() dto: ScanEmailsDto) {
    return this.gmailService.scanEmails(dto);
  }
}
