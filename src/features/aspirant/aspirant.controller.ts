import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CreateAspirantDto, AspirantQueryDto } from './aspirant.dto';
import { AspirantService } from './aspirant.service';
import { UserService } from '../user/user.service';
import {
  AspirantUsersQueryDto,
  CreateUserDto,
  UpdateUserDto,
} from '../user/user.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { GetUser } from 'src/shared/decorators/get-user.decorator';
import { RoleCode } from '../role/role.enum';
import { Admin } from '../admin/admin.entity';
import { User } from '../user/user.entity';

@Controller('aspirants')
export class AspirantController {
  constructor(
    private readonly aspirantService: AspirantService,
    private readonly userService: UserService,
  ) {}

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@GetUser() admin: Admin, @Body() dto: CreateAspirantDto) {
    const adminId = Number(admin?.id);
    return this.aspirantService.create(dto, adminId);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get()
  findAll(@Query() query: AspirantQueryDto) {
    return this.aspirantService.findAll(query);
  }

  // --- Logged-in Aspirant Campaign Team Endpoints (Must be declared before :id / :aspirantId) ---

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Post('me/users')
  @HttpCode(HttpStatus.CREATED)
  createMyUser(@GetUser() user: User, @Body() dto: CreateUserDto) {
    return this.userService.createForTeam(dto, user);
  }

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get('me/users')
  findMyUsers(@GetUser() user: User, @Query() query: AspirantUsersQueryDto) {
    return this.userService.findMyAspirantUsers(
      user,
      query?.roleId ?? query?.role,
      query,
    );
  }

  @Allowed([RoleCode.ASPIRANT, RoleCode.CLIENT_USER])
  @Get('me/lga-coordinators')
  findMyLgaCoordinators(
    @GetUser() user: User,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findMyLgaCoordinators(user, query);
  }

  @Allowed([RoleCode.ASPIRANT, RoleCode.CLIENT_USER, RoleCode.LGA_COORDINATOR])
  @Get('me/ward-coordinators')
  findMyWardCoordinators(
    @GetUser() user: User,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findMyWardCoordinators(user, query);
  }

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get('me/team-members')
  findMyTeamMembers(
    @GetUser() user: User,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findMyAspirantUsers(
      user,
      query?.roleId ?? query?.role,
      query,
    );
  }

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Patch('me/users/:id')
  updateMyUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @GetUser() user: User,
  ) {
    return this.userService.updateForTeam(+id, dto, user);
  }

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Put('me/users/:id')
  updateMyUserPut(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @GetUser() user: User,
  ) {
    return this.userService.updateForTeam(+id, dto, user);
  }

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Delete('me/users/:id')
  removeMyUser(@Param('id') id: string, @GetUser() user: User) {
    return this.userService.removeForTeam(+id, user);
  }

  // --- Specific Aspirant Campaign Team Endpoints ---

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post(':aspirantId/users')
  @HttpCode(HttpStatus.CREATED)
  createAspirantUser(
    @Param('aspirantId') aspirantId: string,
    @Body() dto: CreateUserDto,
    @GetUser() admin: Admin,
  ) {
    return this.userService.createForAdmin(+aspirantId, dto, admin);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
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

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get(':aspirantId/team-members')
  findAspirantTeamMembers(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantUsers(
      +aspirantId,
      query?.roleId ?? query?.role,
      query,
    );
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get(':aspirantId/lga-coordinators')
  findAspirantLgaCoordinators(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantLgaCoordinators(+aspirantId, query);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get(':aspirantId/ward-coordinators')
  findAspirantWardCoordinators(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantWardCoordinators(+aspirantId, query);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Get(':aspirantId/polling-unit-agents')
  findAspirantPuAgents(
    @Param('aspirantId') aspirantId: string,
    @Query() query: AspirantUsersQueryDto,
  ) {
    return this.userService.findAspirantPuAgents(+aspirantId, query);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Patch(':aspirantId/users/:id')
  updateAspirantUser(
    @Param('aspirantId') aspirantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @GetUser() admin: Admin,
  ) {
    return this.userService.updateForAdmin(+id, dto, admin);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Put(':aspirantId/users/:id')
  updateAspirantUserPut(
    @Param('aspirantId') aspirantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @GetUser() admin: Admin,
  ) {
    return this.userService.updateForAdmin(+id, dto, admin);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Delete(':aspirantId/users/:id')
  removeAspirantUser(
    @Param('aspirantId') aspirantId: string,
    @Param('id') id: string,
    @GetUser() admin: Admin,
  ) {
    return this.userService.removeForAdmin(+id, admin);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get('stats')
  getStats() {
    return this.aspirantService.getStats();
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aspirantService.findOne(+id);
  }
}
