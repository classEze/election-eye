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
import { Role } from '../role/role.entity';
import { RoleCode } from '../role/role.enum';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';
import { User } from '../user/user.entity';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { PoliticalParty } from '../political-party/political-party.entity';
import { ElectoralOffice } from '../electoral-office/electoral-office.entity';
import { UserStatus } from 'src/shared/enums/status.enum';

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
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    private readonly verification: EmailVerificationService,
  ) {}

  async create(dto: CreateAspirantDto) {
    let role: Role | null;

    if (dto.role_id) {
      role = await this.roles.findOne({ where: { id: dto.role_id } });
      if (!role) {
        throw new NotFoundException(`Role with ID #${dto.role_id} not found.`);
      }
      if (role.code !== RoleCode.ASPIRANT) {
        throw new BadRequestException(
          'Invalid role for aspirant creation. Only the ASPIRANT role is permitted.',
        );
      }
      if (!role.status) {
        throw new BadRequestException(
          'The specified ASPIRANT role is currently inactive.',
        );
      }
    } else {
      role = await this.roles.findOne({
        where: { code: RoleCode.ASPIRANT, status: true },
      });
      if (!role) {
        throw new NotFoundException('Active aspirant role not found.');
      }
    }

    const [party, office] = await Promise.all([
      this.parties.findOne({ where: { id: dto.politicalPartyId } }),
      this.offices.findOne({ where: { id: dto.electoralOfficeId } }),
    ]);

    if (!party) {
      throw new NotFoundException('Political party not found');
    }
    if (!office) {
      throw new NotFoundException('Electoral office not found');
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
        status: UserStatus.PENDING,
        isVerified: false,
      });
      const savedAccount = await manager.save(account);

      savedAspirant.accountUser = savedAccount;
      await manager.save(savedAspirant);

      return { account: savedAccount, aspirant: savedAspirant };
    });

    // Single unified email containing verification link + temporary password login instructions
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

  async findAll(queryDto?: AspirantQueryDto): Promise<{
    data: Aspirant[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    return this.aspirantRepo.findAll(queryDto);
  }

  async findOne(id: number): Promise<Aspirant> {
    const aspirant = await this.aspirantRepo.findById(id);
    if (!aspirant) {
      throw new NotFoundException(`Aspirant with ID #${id} not found.`);
    }
    return aspirant;
  }
}
