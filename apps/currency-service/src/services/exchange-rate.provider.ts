export abstract class ExchangeRateProvider {
  abstract getRate(params: { from: string; to: string; date?: string }): Promise<number>;
}
