import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AzureADStrategy } from './azure-ad.strategy';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'azure-ad' })],
  providers: [AuthService, AzureADStrategy],
  exports: [AuthService],
})
export class AuthModule { }
