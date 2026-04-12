export interface AsyncInstrumentOptions {
  include?: RegExp | RegExp[];
  exclude?: RegExp | RegExp[];
  transform: (code: string, id: string) => string;
}
