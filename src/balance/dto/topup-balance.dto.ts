import { IsInt, Max, Min } from 'class-validator';

export class TopupBalanceDto {
  @IsInt()
  @Min(1)
  @Max(9_999_999)
  amount: number;
}
