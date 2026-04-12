export interface AsyncInstrumentOptions {
  include?: RegExp | RegExp[];
  exclude?: RegExp | RegExp[];
  transform?: (
    code: string,
    id: string
  ) => string | null | undefined | Promise<string | null | undefined>;
}
