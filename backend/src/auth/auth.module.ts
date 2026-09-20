import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTokens } from './entities/user-tokens.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthClient } from './google-auth.client';

@Module({
  imports: [TypeOrmModule.forFeature([UserTokens])],
  controllers: [AuthController],
  providers: [AuthService, GoogleAuthClient],
  // GoogleAuthClient se exporta para que Calendar y Gmail (fases 2/3)
  // obtengan clientes autenticados.
  exports: [GoogleAuthClient],
})
export class AuthModule {}
