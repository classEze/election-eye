import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Aspirant } from './aspirant.entity';
import { CreateAspirantDto, AspirantQueryDto } from './aspirant.dto';
import { AspirantRepository } from './aspirant.repository';
import { RoleService } from '../role/role.service';
import { RoleCode } from '../role/role.enum';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';
import { User } from '../user/user.entity';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { PoliticalParty } from '../political-party/political-party.entity';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';
import { UserStatus } from 'src/shared/enums/status.enum';
import { Admin } from '../admin/admin.entity';

@Injectable()
export class AspirantService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    private readonly dataSource: DataSource,
    private readonly aspirantRepo: AspirantRepository,
    @InjectRepository(PoliticalParty)
    private readonly parties: Repository<PoliticalParty>,
    @InjectRepository(ElectoralOffice)
    private readonly offices: Repository<ElectoralOffice>,
    private readonly roleService: RoleService,
    private readonly verification: EmailVerificationService,
  ) {}

  async create(dto: CreateAspirantDto, createdByAdminId: number) {
    const role = await this.roleService.getRoleByCode(RoleCode.ASPIRANT);
    if (!role) {
      throw new NotFoundException('Active aspirant role not found.');
    }
    if (!role.status) {
      throw new BadRequestException(
        'The specified ASPIRANT role is currently inactive.',
      );
    }

    const [party, office] = await Promise.all([
      this.parties.findOne({ where: { id: dto.politicalPartyId } }),
      this.offices.findOne({ where: { id: dto.electoralOfficeId } }),
    ]);

    if (!party) {
      throw new NotFoundException(
        'Aspirant Political party not found or inactive',
      );
    }
    if (!office) {
      throw new NotFoundException(
        'Assigned Electoral office not found or inactive',
      );
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
        createdByAdminId,
      });
      const savedAspirant = await manager.save(aspirant);

      const account = manager.create(User, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        emailAddress: dto.emailAddress,
        phoneNumber: dto.phoneNumber,
        password,
        role,
        status: UserStatus.PENDING,
        isVerified: false,
        createdByAdmin: { id: createdByAdminId } as Admin,
        aspirant: savedAspirant,
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
      status: result.account.status,
      createdAt: result.aspirant.createdAt,
      updatedAt: result.aspirant.updatedAt,
    };
  }

  async findAll(queryDto?: AspirantQueryDto): Promise<{
    data: Aspirant[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.aspirantRepo.findAll(queryDto);
  }

  async getStats() {
    return this.aspirantRepo.getStats();
  }

  async findOne(id: number): Promise<Aspirant> {
    const aspirant = await this.aspirantRepo.findById(id);
    if (!aspirant) {
      throw new NotFoundException(`Aspirant with ID #${id} not found.`);
    }
    return aspirant;
  }
}
