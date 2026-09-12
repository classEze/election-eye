import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class GetRoleDTO {
  @IsString({ message: 'invalid query parameter for role type' })
  @Transform(({ value }) => String(value).trim().toUpperCase())
  type: string = 'CLIENT';

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return true;
    return String(value).trim().toLowerCase() === 'true';
  })
  status: boolean = true;
}
