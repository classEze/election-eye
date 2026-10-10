import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateUserDto,
  UpdateUserDto,
  UserQueryDto,
  AspirantUsersQueryDto,
} from './user.dto';
import { UserRepository } from './user.repository';
import { RoleService } from '../role/role.service';
import { RoleCode } from '../role/role.enum';
import PasswordHelper from 'src/shared/helpers/password.helper';
import { EmailVerificationService } from 'src/shared/verification/email-verification.service';
import { APP_QUEUES } from '@/shared/constants/queue.constants';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { getUserInfoCacheKey } from 'src/shared/constants/cache.constant';
import { ElectoralOfficeService } from '../electoral-office/electoral-office.service';
import { Aspirant } from '../aspirant/aspirant.entity';
import { Lga } from '../lga/lga.entity';
import { Ward } from '../ward/ward.entity';
import { PollingUnit } from '../polling-unit/polling-unit.entity';

@Injectable()
export class UserService {
  private readonly passwordHelper = new PasswordHelper();

  constructor(
    private readonly roleService: RoleService,
    private readonly repo: UserRepository,
    private readonly verification: EmailVerificationService,
    private readonly electoralOfficeService: ElectoralOfficeService,
    @InjectRepository(Aspirant)
    private readonly aspirantRepository: Repository<Aspirant>,
    @InjectRepository(Lga)
    private readonly lgaRepository: Repository<Lga>,
    @InjectRepository(Ward)
    private readonly wardRepository: Repository<Ward>,
    @InjectRepository(PollingUnit)
    private readonly puRepository: Repository<PollingUnit>,
    @InjectQueue(APP_QUEUES.mail) private readonly mailQueue: Queue,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Creates a user under a specific aspirant on behalf of an administrator.
   */
  async createForAdmin(
    aspirantId: number,
    userDto: CreateUserDto,
    admin?: any,
  ) {
    if (!aspirantId || isNaN(aspirantId)) {
      throw new BadRequestException('A valid aspirantId must be provided.');
    }
    return this.processUserCreation(aspirantId, userDto, admin, true);
  }

  /**
   * Creates a user on behalf of the authenticated aspirant or team member.
   */
  async createForTeam(userDto: CreateUserDto, user: any) {
    let aspirantId =
      user?.aspirantAccount?.id || user?.aspirant?.id || userDto.aspirantId;

    if (!aspirantId && user?.id) {
      const fullUser = await this.repo.findByIdWithRelations(user.id);
      aspirantId = fullUser?.aspirantAccount?.id || fullUser?.aspirant?.id;
    }

    if (!aspirantId) {
      throw new BadRequestException(
        'No associated aspirant account found for the current authenticated user.',
      );
    }

    return this.processUserCreation(aspirantId, userDto, user, false);
  }

  /**
   * Generic create endpoint fallback.
   */
  async create(userDto: CreateUserDto, creator?: any) {
    const aspirantId =
      userDto.aspirantId ||
      creator?.aspirantAccount?.id ||
      creator?.aspirant?.id;
    if (!aspirantId) {
      throw new BadRequestException('aspirantId is required.');
    }
    return this.processUserCreation(aspirantId, userDto, creator, false);
  }

  /**
   * Core user creation processor with boundary validations, role checks, and credential issuance.
   */
  private async processUserCreation(
    aspirantId: number,
    userDto: CreateUserDto,
    creator?: any,
    isCreatorAdmin = false,
  ) {
    // 1. Verify Aspirant & Electoral Office
    const aspirant = await this.aspirantRepository.findOne({
      where: { id: aspirantId },
      relations: { electoralOffice: true, accountUser: true },
    });

    if (!aspirant) {
      throw new NotFoundException(`Aspirant with ID #${aspirantId} not found.`);
    }

    if (!aspirant.electoralOffice) {
      throw new BadRequestException(
        'Aspirant is not assigned to any electoral office. Team members cannot be created without defined office boundaries.',
      );
    }

    // 2. Fetch Active Role & Validate Role Permissions
    const role = await this.roleService.getRoleById(userDto.role_id);
    if (!role || !role.status) {
      throw new NotFoundException('Active role not found.');
    }

    const permittedRoles = [
      RoleCode.CLIENT_USER,
      RoleCode.LGA_COORDINATOR,
      RoleCode.WARD_COORDINATOR,
      RoleCode.PU_AGENT,
    ];

    if (!permittedRoles.includes(role.code)) {
      throw new BadRequestException(
        'Invalid role for user creation. Only CLIENT_USER, LGA_COORDINATOR, WARD_COORDINATOR, and PU_AGENT roles are permitted for user accounts.',
      );
    }

    // 3. Creator Role Restrictions (Hierarchical on-boarding permissions)
    if (!isCreatorAdmin && creator?.role?.code) {
      const creatorRoleCode = creator.role.code;

      if (creatorRoleCode === RoleCode.LGA_COORDINATOR) {
        if (
          ![RoleCode.WARD_COORDINATOR, RoleCode.PU_AGENT].includes(role.code)
        ) {
          throw new BadRequestException(
            'LGA Coordinators can only onboard Ward Coordinators and Polling Unit Agents.',
          );
        }
      } else if (creatorRoleCode === RoleCode.WARD_COORDINATOR) {
        if (role.code !== RoleCode.PU_AGENT) {
          throw new BadRequestException(
            'Ward Coordinators can only onboard Polling Unit Agents.',
          );
        }
      }
    }

    // 4. Retrieve Aspirant Office Boundaries (only required for territorial roles)
    let boundaries: any = null;
    if (role.code !== RoleCode.CLIENT_USER) {
      boundaries = await this.electoralOfficeService.getOfficeBoundaries(
        aspirant.electoralOffice.id,
      );
    }

    // 5. Role-Specific Boundary Validations and Upward Hierarchy Population
    switch (role.code) {
      case RoleCode.LGA_COORDINATOR: {
        if (!userDto.assignedLgaId) {
          throw new BadRequestException(
            'assignedLgaId is required when creating an LGA Coordinator.',
          );
        }

        if (!boundaries.lgaIds.includes(userDto.assignedLgaId)) {
          throw new BadRequestException(
            `Assigned LGA ID #${userDto.assignedLgaId} is not within the aspirant's electoral boundaries.`,
          );
        }

        // Creator scope check
        if (
          !isCreatorAdmin &&
          creator?.role?.code === RoleCode.LGA_COORDINATOR
        ) {
          const creatorLgaId = creator.assignedLga?.id;
          if (creatorLgaId && creatorLgaId !== userDto.assignedLgaId) {
            throw new BadRequestException(
              'LGA Coordinators can only assign users within their own assigned LGA.',
            );
          }
        }

        // Downward sanitization
        userDto.assignedWardId = undefined;
        userDto.assignedPuId = undefined;
        break;
      }

      case RoleCode.WARD_COORDINATOR: {
        if (!userDto.assignedWardId) {
          throw new BadRequestException(
            'assignedWardId is required when creating a Ward Coordinator.',
          );
        }

        if (!boundaries.wardIds.includes(userDto.assignedWardId)) {
          throw new BadRequestException(
            `Assigned Ward ID #${userDto.assignedWardId} is not within the aspirant's electoral boundaries.`,
          );
        }

        const ward = await this.wardRepository.findOne({
          where: { id: userDto.assignedWardId },
          relations: { lga: true },
        });

        if (!ward) {
          throw new NotFoundException(
            `Ward with ID #${userDto.assignedWardId} not found.`,
          );
        }

        // Upward boundary validation & auto-population
        if (userDto.assignedLgaId) {
          if (ward.lga && ward.lga.id !== userDto.assignedLgaId) {
            throw new BadRequestException(
              `The provided assignedLgaId (#${userDto.assignedLgaId}) does not match the LGA of Ward #${userDto.assignedWardId}.`,
            );
          }
          if (!boundaries.lgaIds.includes(userDto.assignedLgaId)) {
            throw new BadRequestException(
              `Assigned LGA ID #${userDto.assignedLgaId} is not within the aspirant's electoral boundaries.`,
            );
          }
        } else if (ward.lga) {
          userDto.assignedLgaId = ward.lga.id;
        }

        // Creator scope check
        if (!isCreatorAdmin) {
          if (creator?.role?.code === RoleCode.LGA_COORDINATOR) {
            const creatorLgaId = creator.assignedLga?.id;
            if (creatorLgaId && userDto.assignedLgaId !== creatorLgaId) {
              throw new BadRequestException(
                'LGA Coordinators can only assign Ward Coordinators within their own assigned LGA.',
              );
            }
          } else if (creator?.role?.code === RoleCode.WARD_COORDINATOR) {
            const creatorWardId = creator.assignedWard?.id;
            if (creatorWardId && creatorWardId !== userDto.assignedWardId) {
              throw new BadRequestException(
                'Ward Coordinators can only assign users within their own assigned Ward.',
              );
            }
          }
        }

        // Downward sanitization
        userDto.assignedPuId = undefined;
        break;
      }

      case RoleCode.PU_AGENT: {
        if (!userDto.assignedPuId) {
          throw new BadRequestException(
            'assignedPuId is required when creating a Polling Unit Agent.',
          );
        }

        if (!boundaries.pollingUnitIds.includes(userDto.assignedPuId)) {
          throw new BadRequestException(
            `Assigned Polling Unit ID #${userDto.assignedPuId} is not within the aspirant's electoral boundaries.`,
          );
        }

        const pu = await this.puRepository.findOne({
          where: { id: userDto.assignedPuId },
          relations: { ward: { lga: true } },
        });

        if (!pu) {
          throw new NotFoundException(
            `Polling Unit with ID #${userDto.assignedPuId} not found.`,
          );
        }

        // Upward Ward validation & auto-population
        if (userDto.assignedWardId) {
          if (pu.ward && pu.ward.id !== userDto.assignedWardId) {
            throw new BadRequestException(
              `The provided assignedWardId (#${userDto.assignedWardId}) does not match the Ward of Polling Unit #${userDto.assignedPuId}.`,
            );
          }
        } else if (pu.ward) {
          userDto.assignedWardId = pu.ward.id;
        }

        // Upward LGA validation & auto-population
        if (userDto.assignedLgaId) {
          if (pu.ward?.lga && pu.ward.lga.id !== userDto.assignedLgaId) {
            throw new BadRequestException(
              `The provided assignedLgaId (#${userDto.assignedLgaId}) does not match the LGA of Polling Unit #${userDto.assignedPuId}.`,
            );
          }
        } else if (pu.ward?.lga) {
          userDto.assignedLgaId = pu.ward.lga.id;
        }

        // Creator scope check
        if (!isCreatorAdmin) {
          if (creator?.role?.code === RoleCode.WARD_COORDINATOR) {
            const creatorWardId = creator.assignedWard?.id;
            if (creatorWardId && userDto.assignedWardId !== creatorWardId) {
              throw new BadRequestException(
                'Ward Coordinators can only assign Polling Unit Agents within their own assigned Ward.',
              );
            }
          } else if (creator?.role?.code === RoleCode.LGA_COORDINATOR) {
            const creatorLgaId = creator.assignedLga?.id;
            if (creatorLgaId && userDto.assignedLgaId !== creatorLgaId) {
              throw new BadRequestException(
                'LGA Coordinators can only assign Polling Unit Agents within their own assigned LGA.',
              );
            }
          }
        }
        break;
      }

      case RoleCode.CLIENT_USER: {
        // Client user is campaign-wide; inherits aspirant's entire electoral office scope.
        // Sanitizing territorial assignments so client users operate campaign-wide.
        userDto.assignedLgaId = undefined;
        userDto.assignedWardId = undefined;
        userDto.assignedPuId = undefined;
        break;
      }
    }

    // 6. Set Metadata: Aspirant Link & Creator Provenance
    userDto.aspirantId = Number(aspirantId);
    if (isCreatorAdmin && creator?.id) {
      userDto.createdByAdminId = Number(creator.id);
      userDto.onboardedByUserId = undefined;
    } else if (!isCreatorAdmin && creator?.id) {
      userDto.onboardedByUserId = Number(creator.id);
      userDto.createdByAdminId = undefined;
    }

    // 7. Generate Temporary Password & Hash
    const randomPassword = this.passwordHelper.generatePassword(18);
    const hashedPassword =
      await this.passwordHelper.hashUserPassword(randomPassword);

    // 8. Insert User
    const result = await this.repo.insertOne(userDto, hashedPassword);

    // 9. Dispatch Verification & Credentials Email
    await this.verification.issueForUser(result, randomPassword);

    const {
      password,
      loginCount,
      forcePasswordReset,
      lastLogin,
      ...filteredResult
    } = result;

    return filteredResult;
  }

  async findAll(queryDto?: UserQueryDto) {
    return this.repo.findAll(queryDto);
  }

  async findOne(id: number) {
    const user = await this.repo.findOneById(id);
    if (!user) {
      throw new NotFoundException(`User with ID #${id} not found.`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto, actor?: any) {
    const isActorAdmin =
      actor?.role?.code === RoleCode.SUPER_ADMIN ||
      actor?.role?.code === RoleCode.SYSTEM_ADMIN;
    return this.processUserUpdate(id, updateUserDto, actor, isActorAdmin);
  }

  async updateForAdmin(
    id: number,
    updateUserDto: UpdateUserDto,
    admin?: any,
  ) {
    return this.processUserUpdate(id, updateUserDto, admin, true);
  }

  async updateForTeam(
    id: number,
    updateUserDto: UpdateUserDto,
    user: any,
  ) {
    return this.processUserUpdate(id, updateUserDto, user, false);
  }

  async remove(id: number, actor?: any) {
    const isActorAdmin =
      actor?.role?.code === RoleCode.SUPER_ADMIN ||
      actor?.role?.code === RoleCode.SYSTEM_ADMIN;
    return this.processUserDeletion(id, actor, isActorAdmin);
  }

  async removeForAdmin(id: number, admin?: any) {
    return this.processUserDeletion(id, admin, true);
  }

  async removeForTeam(id: number, user: any) {
    return this.processUserDeletion(id, user, false);
  }

  /**
   * Core user update processor with boundary validations, role checks, and hierarchical permissions.
   */
  private async processUserUpdate(
    id: number,
    updateUserDto: UpdateUserDto,
    actor?: any,
    isActorAdmin = false,
  ) {
    const targetUser = await this.repo.findByIdWithRelations(id);
    if (!targetUser) {
      throw new NotFoundException(`User with ID #${id} not found.`);
    }

    const aspirantId =
      targetUser.aspirant?.id || targetUser.aspirantAccount?.id;

    if (!isActorAdmin) {
      const actorUserId = Number(actor?.id || actor?.sub);
      if (actorUserId && actorUserId === id) {
        throw new ForbiddenException(
          'Users are not permitted to edit their own data or status. A team coordinator or administrator must perform this action.',
        );
      }

      if (targetUser.aspirantAccount) {
        throw new ForbiddenException(
          'Team members cannot modify the aspirant root account.',
        );
      }

      const actorAspirantId =
        actor?.aspirantAccount?.id || actor?.aspirant?.id;
      if (!actorAspirantId || actorAspirantId !== aspirantId) {
        throw new ForbiddenException(
          'You can only modify team members within your own campaign.',
        );
      }

      const actorRoleCode = actor?.role?.code;
      if (actorRoleCode === RoleCode.LGA_COORDINATOR) {
        if (
          ![RoleCode.WARD_COORDINATOR, RoleCode.PU_AGENT].includes(
            targetUser.role?.code,
          )
        ) {
          throw new ForbiddenException(
            'LGA Coordinators can only modify Ward Coordinators and Polling Unit Agents.',
          );
        }
        if (targetUser.assignedLga?.id !== actor.assignedLga?.id) {
          throw new ForbiddenException(
            'LGA Coordinators can only modify team members within their assigned LGA.',
          );
        }
      } else if (actorRoleCode === RoleCode.WARD_COORDINATOR) {
        if (targetUser.role?.code !== RoleCode.PU_AGENT) {
          throw new ForbiddenException(
            'Ward Coordinators can only modify Polling Unit Agents.',
          );
        }
        if (targetUser.assignedWard?.id !== actor.assignedWard?.id) {
          throw new ForbiddenException(
            'Ward Coordinators can only modify Polling Unit Agents within their assigned Ward.',
          );
        }
      }
    }

    let role = targetUser.role;
    if (updateUserDto.role_id) {
      const fetchedRole = await this.roleService.getRoleById(
        updateUserDto.role_id,
      );
      if (!fetchedRole || !fetchedRole.status) {
        throw new NotFoundException('Active role not found.');
      }
      const permittedRoles = [
        RoleCode.CLIENT_USER,
        RoleCode.LGA_COORDINATOR,
        RoleCode.WARD_COORDINATOR,
        RoleCode.PU_AGENT,
      ];
      if (!permittedRoles.includes(fetchedRole.code)) {
        throw new BadRequestException(
          'Invalid role for user update. Permitted roles: CLIENT_USER, LGA_COORDINATOR, WARD_COORDINATOR, PU_AGENT.',
        );
      }
      if (!isActorAdmin) {
        const actorRoleCode = actor?.role?.code;
        if (actorRoleCode === RoleCode.LGA_COORDINATOR) {
          if (
            ![RoleCode.WARD_COORDINATOR, RoleCode.PU_AGENT].includes(
              fetchedRole.code,
            )
          ) {
            throw new ForbiddenException(
              'LGA Coordinators can only assign Ward Coordinator or Polling Unit Agent roles.',
            );
          }
        } else if (actorRoleCode === RoleCode.WARD_COORDINATOR) {
          if (fetchedRole.code !== RoleCode.PU_AGENT) {
            throw new ForbiddenException(
              'Ward Coordinators can only assign Polling Unit Agent roles.',
            );
          }
        }
      }
      role = fetchedRole;
    }

    if (aspirantId) {
      const aspirant = await this.aspirantRepository.findOne({
        where: { id: aspirantId },
        relations: { electoralOffice: true },
      });

      if (aspirant?.electoralOffice) {
        const boundaries =
          await this.electoralOfficeService.getOfficeBoundaries(
            aspirant.electoralOffice.id,
          );

        let effectiveLgaId =
          updateUserDto.assignedLgaId !== undefined
            ? updateUserDto.assignedLgaId
            : targetUser.assignedLga?.id;
        let effectiveWardId =
          updateUserDto.assignedWardId !== undefined
            ? updateUserDto.assignedWardId
            : targetUser.assignedWard?.id;
        let effectivePuId =
          updateUserDto.assignedPuId !== undefined
            ? updateUserDto.assignedPuId
            : targetUser.assignedPu?.id;

        switch (role?.code) {
          case RoleCode.LGA_COORDINATOR: {
            if (!effectiveLgaId) {
              throw new BadRequestException(
                'assignedLgaId is required when updating an LGA Coordinator.',
              );
            }
            if (!boundaries.lgaIds.includes(effectiveLgaId)) {
              throw new BadRequestException(
                `Assigned LGA ID #${effectiveLgaId} is not within the aspirant's electoral boundaries.`,
              );
            }
            if (!isActorAdmin && actor?.role?.code === RoleCode.LGA_COORDINATOR) {
              if (effectiveLgaId !== actor.assignedLga?.id) {
                throw new ForbiddenException(
                  'LGA Coordinators can only assign users within their own assigned LGA.',
                );
              }
            }
            updateUserDto.assignedLgaId = effectiveLgaId;
            updateUserDto.assignedWardId = undefined;
            updateUserDto.assignedPuId = undefined;
            break;
          }

          case RoleCode.WARD_COORDINATOR: {
            if (!effectiveWardId) {
              throw new BadRequestException(
                'assignedWardId is required when updating a Ward Coordinator.',
              );
            }
            if (!boundaries.wardIds.includes(effectiveWardId)) {
              throw new BadRequestException(
                `Assigned Ward ID #${effectiveWardId} is not within the aspirant's electoral boundaries.`,
              );
            }
            const ward = await this.wardRepository.findOne({
              where: { id: effectiveWardId },
              relations: { lga: true },
            });
            if (!ward) {
              throw new NotFoundException(
                `Ward with ID #${effectiveWardId} not found.`,
              );
            }
            if (effectiveLgaId) {
              if (ward.lga && ward.lga.id !== effectiveLgaId) {
                throw new BadRequestException(
                  `The provided assignedLgaId (#${effectiveLgaId}) does not match the LGA of Ward #${effectiveWardId}.`,
                );
              }
              if (!boundaries.lgaIds.includes(effectiveLgaId)) {
                throw new BadRequestException(
                  `Assigned LGA ID #${effectiveLgaId} is not within the aspirant's electoral boundaries.`,
                );
              }
            } else if (ward.lga) {
              effectiveLgaId = ward.lga.id;
            }
            if (!isActorAdmin && actor?.role?.code === RoleCode.LGA_COORDINATOR) {
              if (effectiveLgaId !== actor.assignedLga?.id) {
                throw new ForbiddenException(
                  'LGA Coordinators can only assign Ward Coordinators within their own assigned LGA.',
                );
              }
            }
            updateUserDto.assignedLgaId = effectiveLgaId;
            updateUserDto.assignedWardId = effectiveWardId;
            updateUserDto.assignedPuId = undefined;
            break;
          }

          case RoleCode.PU_AGENT: {
            if (!effectivePuId) {
              throw new BadRequestException(
                'assignedPuId is required when updating a Polling Unit Agent.',
              );
            }
            if (!boundaries.pollingUnitIds.includes(effectivePuId)) {
              throw new BadRequestException(
                `Assigned Polling Unit ID #${effectivePuId} is not within the aspirant's electoral boundaries.`,
              );
            }
            const pu = await this.puRepository.findOne({
              where: { id: effectivePuId },
              relations: { ward: { lga: true } },
            });
            if (!pu) {
              throw new NotFoundException(
                `Polling Unit with ID #${effectivePuId} not found.`,
              );
            }
            if (effectiveWardId) {
              if (pu.ward && pu.ward.id !== effectiveWardId) {
                throw new BadRequestException(
                  `The provided assignedWardId (#${effectiveWardId}) does not match the Ward of Polling Unit #${effectivePuId}.`,
                );
              }
              if (!boundaries.wardIds.includes(effectiveWardId)) {
                throw new BadRequestException(
                  `Assigned Ward ID #${effectiveWardId} is not within the aspirant's electoral boundaries.`,
                );
              }
            } else if (pu.ward) {
              effectiveWardId = pu.ward.id;
            }
            if (effectiveLgaId) {
              if (pu.ward?.lga && pu.ward.lga.id !== effectiveLgaId) {
                throw new BadRequestException(
                  `The provided assignedLgaId (#${effectiveLgaId}) does not match the LGA of Polling Unit #${effectivePuId}.`,
                );
              }
              if (!boundaries.lgaIds.includes(effectiveLgaId)) {
                throw new BadRequestException(
                  `Assigned LGA ID #${effectiveLgaId} is not within the aspirant's electoral boundaries.`,
                );
              }
            } else if (pu.ward?.lga) {
              effectiveLgaId = pu.ward.lga.id;
            }
            if (!isActorAdmin) {
              if (actor?.role?.code === RoleCode.WARD_COORDINATOR) {
                if (effectiveWardId !== actor.assignedWard?.id) {
                  throw new ForbiddenException(
                    'Ward Coordinators can only assign Polling Unit Agents within their own assigned Ward.',
                  );
                }
              } else if (actor?.role?.code === RoleCode.LGA_COORDINATOR) {
                if (effectiveLgaId !== actor.assignedLga?.id) {
                  throw new ForbiddenException(
                    'LGA Coordinators can only assign Polling Unit Agents within their own assigned LGA.',
                  );
                }
              }
            }
            updateUserDto.assignedLgaId = effectiveLgaId;
            updateUserDto.assignedWardId = effectiveWardId;
            updateUserDto.assignedPuId = effectivePuId;
            break;
          }

          case RoleCode.CLIENT_USER: {
            // Client user is campaign-wide; inherits aspirant's entire electoral office scope.
            updateUserDto.assignedLgaId = null as any;
            updateUserDto.assignedWardId = null as any;
            updateUserDto.assignedPuId = null as any;
            break;
          }
        }
      }
    }

    if (updateUserDto.password) {
      updateUserDto.password = await this.passwordHelper.hashUserPassword(
        updateUserDto.password,
      );
    }

    const updated = await this.repo.update(id, updateUserDto);
    await this.cacheManager.del(getUserInfoCacheKey(id));
    return updated;
  }

  /**
   * Core user deletion processor with hierarchical permissions.
   */
  private async processUserDeletion(
    id: number,
    actor?: any,
    isActorAdmin = false,
  ) {
    const targetUser = await this.repo.findByIdWithRelations(id);
    if (!targetUser) {
      throw new NotFoundException(`User with ID #${id} not found.`);
    }

    if (!isActorAdmin) {
      const actorUserId = Number(actor?.id || actor?.sub);
      if (actorUserId && actorUserId === id) {
        throw new ForbiddenException(
          'Users are not permitted to delete their own account.',
        );
      }

      if (targetUser.aspirantAccount) {
        throw new ForbiddenException(
          'Team members cannot delete the aspirant root account.',
        );
      }
      const aspirantId = targetUser.aspirant?.id;
      const actorAspirantId =
        actor?.aspirantAccount?.id || actor?.aspirant?.id;
      if (!actorAspirantId || actorAspirantId !== aspirantId) {
        throw new ForbiddenException(
          'You can only delete team members within your own campaign.',
        );
      }

      const actorRoleCode = actor?.role?.code;
      if (actorRoleCode === RoleCode.LGA_COORDINATOR) {
        if (
          ![RoleCode.WARD_COORDINATOR, RoleCode.PU_AGENT].includes(
            targetUser.role?.code,
          )
        ) {
          throw new ForbiddenException(
            'LGA Coordinators can only delete Ward Coordinators and Polling Unit Agents.',
          );
        }
        if (targetUser.assignedLga?.id !== actor.assignedLga?.id) {
          throw new ForbiddenException(
            'LGA Coordinators can only delete team members within their assigned LGA.',
          );
        }
      } else if (actorRoleCode === RoleCode.WARD_COORDINATOR) {
        if (targetUser.role?.code !== RoleCode.PU_AGENT) {
          throw new ForbiddenException(
            'Ward Coordinators can only delete Polling Unit Agents.',
          );
        }
        if (targetUser.assignedWard?.id !== actor.assignedWard?.id) {
          throw new ForbiddenException(
            'Ward Coordinators can only delete Polling Unit Agents within their assigned Ward.',
          );
        }
      }
    }

    const success = await this.repo.softDelete(id);
    if (!success) {
      throw new NotFoundException(`User with ID #${id} could not be deleted.`);
    }

    await this.cacheManager.del(getUserInfoCacheKey(id));

    return {
      message: `User with ID #${id} was successfully soft-deleted.`,
    };
  }

  async findAspirantUsers(
    aspirantId: number,
    roleIdOrCode?: number | string,
    queryDto?: AspirantUsersQueryDto,
  ) {
    const aspirant = await this.aspirantRepository.findOne({
      where: { id: aspirantId },
    });
    if (!aspirant) {
      throw new NotFoundException(`Aspirant with ID #${aspirantId} not found.`);
    }
    return this.repo.findAspirantUsers(aspirantId, roleIdOrCode, queryDto);
  }

  async findAspirantLgaCoordinators(
    aspirantId: number,
    queryDto?: AspirantUsersQueryDto,
  ) {
    return this.findAspirantUsers(
      aspirantId,
      RoleCode.LGA_COORDINATOR,
      queryDto,
    );
  }

  async findAspirantWardCoordinators(
    aspirantId: number,
    queryDto?: AspirantUsersQueryDto,
  ) {
    return this.findAspirantUsers(
      aspirantId,
      RoleCode.WARD_COORDINATOR,
      queryDto,
    );
  }

  async findAspirantPuAgents(
    aspirantId: number,
    queryDto?: AspirantUsersQueryDto,
  ) {
    return this.findAspirantUsers(aspirantId, RoleCode.PU_AGENT, queryDto);
  }

  async findMyAspirantUsers(
    user: any,
    roleIdOrCode?: number | string,
    queryDto?: AspirantUsersQueryDto,
  ) {
    let aspirantId = user?.aspirantAccount?.id || user?.aspirant?.id;
    if (!aspirantId && user?.id) {
      const fullUser = await this.repo.findByIdWithRelations(user.id);
      aspirantId = fullUser?.aspirantAccount?.id || fullUser?.aspirant?.id;
    }
    if (!aspirantId) {
      throw new BadRequestException(
        'No associated aspirant account found for the current authenticated user.',
      );
    }
    return this.findAspirantUsers(aspirantId, roleIdOrCode, queryDto);
  }

  async findMyLgaCoordinators(user: any, queryDto?: AspirantUsersQueryDto) {
    return this.findMyAspirantUsers(user, RoleCode.LGA_COORDINATOR, queryDto);
  }

  async findMyWardCoordinators(user: any, queryDto?: AspirantUsersQueryDto) {
    return this.findMyAspirantUsers(user, RoleCode.WARD_COORDINATOR, queryDto);
  }

  async findMyPuAgents(user: any, queryDto?: AspirantUsersQueryDto) {
    return this.findMyAspirantUsers(user, RoleCode.PU_AGENT, queryDto);
  }
}
