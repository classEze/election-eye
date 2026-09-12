import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Aspirant } from './aspirant.entity';
import { CreateAspirantDto } from './aspirant.dto';
import { Role } from '../role/role.entity';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';
import { User } from '../user/user.entity';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { PoliticalParty } from '../political-party/political-party.entity';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';

@Injectable()
export class AspirantService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PoliticalParty)
    private readonly parties: Repository<PoliticalParty>,
    @InjectRepository(ElectoralOffice)
    private readonly offices: Repository<ElectoralOffice>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    private readonly verification: EmailVerificationService,
  ) {}

  async create(dto: CreateAspirantDto) {
    const [party, office, role] = await Promise.all([
      this.parties.findOne({ where: { id: dto.politicalPartyId } }),
      this.offices.findOne({ where: { id: dto.electoralOfficeId } }),
      this.roles.findOne({
        where: { code: 'ASPIRANT', type: 'CLIENT', status: true },
      }),
    ]);

    if (!party) {
      throw new NotFoundException('Political party not found');
    }
    if (!office) {
      throw new NotFoundException('Electoral office not found');
    }
    if (!role) {
      throw new NotFoundException('Active aspirant role not found');
    }

    const temporaryPassword = this.passwordHelper.generatePassword(18);
    const password =
      await this.passwordHelper.hashUserPassword(temporaryPassword);

    const result = await this.dataSource.transaction(async (manager) => {
      const aspirant = manager.create(Aspirant, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        politicalParty: party,
        electoralOffice: office,
        logoUrl: dto.logoUrl,
        createdByAdminId: dto.createdByAdminId,
      });
      const savedAspirant = await manager.save(aspirant);

      const account = manager.create(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        emailAddress: dto.emailAddress,
        phoneNumber: dto.phoneNumber,
        password,
        role,
        isActive: false,
        isVerified: false,
      });
      const savedAccount = await manager.save(account);

      savedAspirant.accountUser = savedAccount;
      await manager.save(savedAspirant);

      return { account: savedAccount, aspirant: savedAspirant };
    });

    await this.verification.issueForUser(result.account, temporaryPassword);

    return {
      id: result.aspirant.id,
      firstName: result.aspirant.firstName,
      lastName: result.aspirant.lastName,
      politicalParty: result.aspirant.politicalParty,
      electoralOffice: result.aspirant.electoralOffice,
      accountUserId: result.account.id,
      isActive: result.aspirant.isActive,
      createdAt: result.aspirant.createdAt,
      updatedAt: result.aspirant.updatedAt,
    };
  }
}
