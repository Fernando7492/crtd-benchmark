import process from "process";
import type { IDocumentRepository } from "./IDocumentRepository.js";
import { PostgresDocumentRepository } from "./postgres/DocumentRepository.js";
import { MongoDocumentRepository } from "./mongo/DocumentRepository.js";

export type { IDocumentRepository, DocumentModel, DocumentEventModel } from "./IDocumentRepository.js";
export { PostgresDocumentRepository, MongoDocumentRepository };
export type DatabaseType = "postgres" | "mongo";

export function createDocumentRepository(
  type: DatabaseType
): IDocumentRepository {
  switch (type) {
    case "postgres":
      return new PostgresDocumentRepository();
    case "mongo":
      if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is required for MongoDB");
      }
      return new MongoDocumentRepository(process.env.MONGO_URI);
    default:
      throw new Error(`Unknown database type: ${type}`);
  }
}
