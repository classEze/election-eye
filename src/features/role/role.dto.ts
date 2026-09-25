import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class GetRoleDTO {
  @IsOptional()
  @IsString({ message: 'invalid query parameter for role type' })
  @IsIn(['CLIENT', 'ADMIN'], {
    message: 'invalid role type provided',
  })
  @Transform(({ value }) =>
    value === undefined ? undefined : String(value).trim().toUpperCase(),
  )
  type?: string;

  @IsOptional()
  @IsBoolean({ message: 'invalid role status provided' })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') return value;

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    return value;
  })
  status?: boolean;
}
