export interface IReporter {
  reportUnused(keys: string[]): void;
  reportAllAccounted(): void;
}
