import { CsvLogProvider } from "~/server/logs/csv/provider";

export class CsvClientLogProvider extends CsvLogProvider {
  constructor(options: { directory: string }) {
    super({ ...options, perClient: true });
  }
}
