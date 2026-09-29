import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Aspirant } from './aspirant.entity';
import { AspirantController } from './aspirant.controller';
import { AspirantService } from './aspirant.service';
import { Role } from '../role/role.entity';
import { VerificationModule } from 'src/shared/verification/verification.module';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';
import { PoliticalParty } from '../political-party/political-party.entity';
import { AspirantRepository } from './aspirant.repository';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Aspirant, ElectoralOffice, PoliticalParty, Role]),
    VerificationModule,
    UserModule,
  ],
  controllers: [AspirantController],
  providers: [AspirantService, AspirantRepository],
  exports: [AspirantService, AspirantRepository],
})
export class AspirantModule {}
