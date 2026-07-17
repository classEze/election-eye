import { Transform } from 'class-transformer';
import { IsString } from 'class-validator';

export class GetRoleDTO {
  @IsString({ message: 'invalid query parameter for role type' })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  type: string = 'client';

  @Transform(({ value }) => {
    if (value === undefined || value === null) return true;
    return String(value).trim().toLowerCase() === 'true';
  })
  status: boolean = true;
}
