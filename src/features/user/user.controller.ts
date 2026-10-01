import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './user.dto';
import { Allowed } from 'src/shared/decorators/allowed.decorator';
import { GetUser } from 'src/shared/decorators/get-user.decorator';
import { RoleCode } from '../role/role.enum';
import { Admin } from '../admin/admin.entity';
import { User } from './user.entity';

@Controller(['user', 'users'])
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post('aspirant/:aspirantId')
  @HttpCode(HttpStatus.CREATED)
  createForAdmin(
    @Param('aspirantId') aspirantId: string,
    @Body() createUserDto: CreateUserDto,
    @GetUser() admin: Admin,
  ) {
    return this.userService.createForAdmin(+aspirantId, createUserDto, admin);
  }

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createForTeam(@Body() createUserDto: CreateUserDto, @GetUser() user: User) {
    return this.userService.createForTeam(createUserDto, user);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Get()
  findAll(@Query() query: UserQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Put(':id')
  updatePut(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() actor: any,
  ) {
    return this.userService.update(+id, updateUserDto, actor);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() actor: any,
  ) {
    return this.userService.update(+id, updateUserDto, actor);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_USER,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Delete(':id')
  remove(@Param('id') id: string, @GetUser() actor: any) {
    return this.userService.remove(+id, actor);
  }
}
