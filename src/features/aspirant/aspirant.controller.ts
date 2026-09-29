import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CreateAspirantDto, AspirantQueryDto } from './aspirant.dto';
import { AspirantService } from './aspirant.service';
import { UserService } from '../user/user.service';
import { AspirantUsersQueryDto, CreateUserDto } from '../user/user.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { GetUser } from 'src/shared/decorators/get-user.decorator';
import { RoleCode } from '../role/role.enum';

@Controller('aspirants')
export class AspirantController {
  constructor(
    private readonly aspirantService: AspirantService,
    private readonly userService: UserService,
  ) {}

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@GetUser() admin: any, @Body() dto: CreateAspirantDto) {
    const adminId = Number(admin?.id || admin?.sub);
    return this.aspirantService.create(dto, adminId);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get()
  findAll(@Query() query: AspirantQueryDto) {
    return this.aspirantService.findAll(query);
  }

  // --- Logged-in Aspirant Campaign Team Endpoints (Must be declared before :id / :aspirantId) ---

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Post('me/users')
  @HttpCode(HttpStatus.CREATED)
  createMyUser(@GetUser() user: any, @Body() dto: CreateUserDto) {
    return this.userService.createForTeam(dto, user);
  }

  @Allowed([RoleCode.ASPIRANT])
  @Get('me/users')
  findMyUsers(@GetUser() user: any, @Query() query: AspirantUsersQueryDto) {
    return this.userService.findMyAspirantUsers(
      user,
      query?.roleId ?? query?.role,
      query,
    );
  }

  @Allowed([RoleCode.ASPIRANT])
  @Get('me/lga-coordinators')
  findMyLgaCoordinators(
    @GetUser() user: any,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findMyLgaCoordinators(user, query);
  }

  @Allowed([RoleCode.ASPIRANT])
  @Get('me/ward-coordinators')
  findMyWardCoordinators(
    @GetUser() user: any,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findMyWardCoordinators(user, query);
  }

  @Allowed([RoleCode.ASPIRANT])
  @Get('me/polling-unit-agents')
  findMyPuAgents(@GetUser() user: any, @Query() query: AspirantUsersQueryDto) {
    return this.userService.findMyPuAgents(user, query);
  }

  // --- Specific Aspirant Campaign Team Endpoints ---

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post(':aspirantId/users')
  @HttpCode(HttpStatus.CREATED)
  createAspirantUser(
    @Param('aspirantId') aspirantId: string,
    @Body() dto: CreateUserDto,
    @GetUser() admin: any,
  ) {
    return this.userService.createForAdmin(+aspirantId, dto, admin);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get(':aspirantId/users')
  findAspirantUsers(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantUsers(
      +aspirantId,
      query?.roleId ?? query?.role,
      query,
    );
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get(':aspirantId/lga-coordinators')
  findAspirantLgaCoordinators(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantLgaCoordinators(+aspirantId, query);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get(':aspirantId/ward-coordinators')
  findAspirantWardCoordinators(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantWardCoordinators(+aspirantId, query);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get(':aspirantId/polling-unit-agents')
  findAspirantPuAgents(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantPuAgents(+aspirantId, query);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
    RoleCode.ASPIRANT,
  ])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantService.findOne(+id);
  }
}
