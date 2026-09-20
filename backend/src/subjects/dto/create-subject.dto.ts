import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @MaxLength(150)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  codigo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  creditos?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  semestre?: string;
}
