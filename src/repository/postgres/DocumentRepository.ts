import { Prisma, PrismaClient } from "@prisma/client";
import type { IDocumentRepository, DocumentModel, DocumentEventModel } from "../IDocumentRepository.js";

export class PostgresDocumentRepository implements IDocumentRepository {

  private prismaClient: PrismaClient;

  public constructor() {
    this.prismaClient = new PrismaClient();
  }

  public async createDocument(title: string): Promise<DocumentModel> {
    const document = await this.prismaClient.document.create({
      data: { title }
    });
    return this.mapDocument(document);
  }

  public async loadDocument(documentId: string): Promise<DocumentModel | null> {
    const document = await this.prismaClient.document.findUnique({
      where: { id: documentId }
    });
    return document ? this.mapDocument(document) : null;
  }

  public async saveEvent(documentId: string, eventType: string, payload: unknown): Promise<DocumentEventModel> {
    const event = await this.prismaClient.documentEvent.create({
      data: {
        documentId,
        type: eventType,
        payload: payload as Prisma.InputJsonValue
      }
    });
    return this.mapEvent(event);
  }

  public async consolidateDocument(documentId: string, consolidateState: unknown): Promise<DocumentModel> {
    const [updatedDocument] = await this.prismaClient.$transaction([
      this.prismaClient.document.update({
        where: { id: documentId },
        data: { state: consolidateState as Prisma.InputJsonValue }
      }),
      this.prismaClient.documentEvent.deleteMany({
        where: { documentId }
      })
    ]);
    return this.mapDocument(updatedDocument);
  }

  public async disconnect(): Promise<void> {
    await this.prismaClient.$disconnect();
  }

  private mapDocument(doc: { id: string; title: string; state: unknown; createdAt: Date; updatedAt: Date }): DocumentModel {
    return {
      id: doc.id,
      title: doc.title,
      state: doc.state,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private mapEvent(event: { id: string; documentId: string; type: string; payload: unknown; createdAt: Date }): DocumentEventModel {
    return {
      id: event.id,
      documentId: event.documentId,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt
    };
  }
}
