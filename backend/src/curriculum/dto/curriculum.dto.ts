import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCurriculumItemDto {
  @IsString()
  @MaxLength(40)
  codigo: string;

  @IsString()
  @MaxLength(200)
  nombre: string;

  @IsInt()
  @Min(0)
  @Max(30)
  creditos: number;

  @IsInt()
  @Min(1)
  @Max(8)
  semestre: number;

  @IsString()
  @MaxLength(60)
  area: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerrequisitos?: string[];

  @IsOptional()
  @IsInt()
  orden?: number;
}

export class UpdateCurriculumItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  creditos?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  semestre?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  area?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prerrequisitos?: string[];
}
