import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAdminDto, UpdateAdminDto } from './admin.dto';
import { AdminRepository } from './admin.repository';
import { Role } from '../role/role.entity';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { NotificationService } from 'src/shared/notification/notification.service';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';

@Injectable()
export class AdminService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly adminRepo: AdminRepository,
    private readonly notify: NotificationService,
    private readonly verification: EmailVerificationService,
  ) {}

  async create(createAdminDto: CreateAdminDto) {
    const role = await this.roleRepository.findOne({
      where: { id: createAdminDto.role_id, type: 'ADMIN', status: true },
    });

    if (!role) {
      throw new NotFoundException('Active admin role not found');
    }

    const temporaryPassword = this.passwordHelper.generatePassword(18);
    const password =
      await this.passwordHelper.hashUserPassword(temporaryPassword);
    const result = await this.adminRepo.insertOne(
      createAdminDto,
      password,
      role,
    );

    await this.verification.issueForAdmin(result);

    await this.notify.sendMailTrap({
      to: result.emailAddress,
      subject: 'Your administrator account',
      message: `Your administrator account has been created. Temporary password: ${temporaryPassword}`,
      html: `<p>Your administrator account has been created.</p><p>Temporary password: ${temporaryPassword}</p>`,
    });

    return {
      id: result.id,
      firstName: result.firstName,
      lastName: result.lastName,
      emailAddress: result.emailAddress,
      phoneNumber: result.phoneNumber,
      role: result.role,
      isActive: result.isActive,
      isVerified: result.isVerified,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  findAll() {
    return this.adminRepo.findAll();
  }

  findOne(id: number) {
    return this.adminRepo.findOneById(id);
  }

  update(_id: number, _updateAdminDto: UpdateAdminDto) {
    return this.adminRepo.update(_id, _updateAdminDto);
  }

  remove(id: number) {
    return `This action removes a #${id} admin`;
  }
}
