import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class TransferDto {
  @IsString()
  @IsNotEmpty()
  to_username: string;

  @IsInt()
  @Min(1)
  amount: number;
}
