import { ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class DeleteJobsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  jobIds!: string[];
}
