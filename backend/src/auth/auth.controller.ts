import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth/google')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Redirige al usuario a la pantalla de consentimiento de Google. */
  @Get()
  redirectToGoogle(@Res() res: Response): void {
    const url = this.authService.getConsentUrl();
    res.redirect(url);
  }

  /**
   * Callback de OAuth. Google redirige aquí con ?code=...
   * Tras persistir tokens, redirige al frontend.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      throw new BadRequestException(`Autorización denegada: ${error}`);
    }
    if (!code) {
      throw new BadRequestException('Falta el parámetro "code".');
    }

    const tokens = await this.authService.handleCallback(code);
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );
    res.redirect(`${frontendUrl}/?auth=success&email=${tokens.email ?? ''}`);
  }
}
