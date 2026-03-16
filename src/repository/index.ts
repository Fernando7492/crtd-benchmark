import type { IDocumentRepository } from "./IDocumentRepository.js";
import { PostgresDocumentRepository } from "./postgres/DocumentRepository.js";

export type { IDocumentRepository, DocumentModel, DocumentEventModel } from "./IDocumentRepository.js";
export { PostgresDocumentRepository };
export type DatabaseType = "postgres";

export function createDocumentRepository(
  type: DatabaseType
): IDocumentRepository {
  switch (type) {
    case "postgres":
      return new PostgresDocumentRepository();
    default:
      throw new Error(`Unknown database type: ${type}`);
  }
}
