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

@Controller(['user', 'users'])
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN])
  @Post('aspirant/:aspirantId')
  @HttpCode(HttpStatus.CREATED)
  createForAdmin(
    @Param('aspirantId') aspirantId: string,
    @Body() createUserDto: CreateUserDto,
    @GetUser() admin: any,
  ) {
    return this.userService.createForAdmin(+aspirantId, createUserDto, admin);
  }

  @Allowed([
    RoleCode.ASPIRANT,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createForTeam(@Body() createUserDto: CreateUserDto, @GetUser() user: any) {
    return this.userService.createForTeam(createUserDto, user);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
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
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Put(':id')
  updatePut(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Allowed([
    RoleCode.SUPER_ADMIN,
    RoleCode.SYSTEM_ADMIN,
    RoleCode.CLIENT_ADMIN,
    RoleCode.LGA_COORDINATOR,
    RoleCode.WARD_COORDINATOR,
  ])
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Allowed([RoleCode.SUPER_ADMIN, RoleCode.SYSTEM_ADMIN, RoleCode.CLIENT_ADMIN])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
