import type { IDocumentRepository, DocumentModel, DocumentEventModel } from "../IDocumentRepository.js";
import {
  DocumentModel as MongoDocumentModel,
  DocumentEventModel as MongoDocumentEventModel,
  connectMongo,
  disconnectMongo
} from "./schemas.js";

export class MongoDocumentRepository implements IDocumentRepository {

  private readonly uri: string;
  private connected = false;

  public constructor(uri: string) {
    this.uri = uri;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await connectMongo(this.uri);
      this.connected = true;
    }
  }

  public async createDocument(title: string): Promise<DocumentModel> {
    await this.ensureConnected();
    const doc = await MongoDocumentModel.create({ title });
    return this.mapDocument(doc);
  }

  public async loadDocument(documentId: string): Promise<DocumentModel | null> {
    await this.ensureConnected();
    const doc = await MongoDocumentModel.findById(documentId).lean();
    return doc ? this.mapDocument(doc) : null;
  }

  public async saveEvent(documentId: string, eventType: string, payload: unknown): Promise<DocumentEventModel> {
    await this.ensureConnected();
    const event = await MongoDocumentEventModel.create({
      documentId,
      type: eventType,
      payload
    });
    return this.mapEvent(event);
  }

  public async consolidateDocument(documentId: string, consolidateState: unknown): Promise<DocumentModel> {
    await this.ensureConnected();

    const session = await MongoDocumentModel.startSession();
    session.startTransaction();

    try {
      const updatedDoc = await MongoDocumentModel.findByIdAndUpdate(
        documentId,
        { state: consolidateState },
        { new: true, session }
      ).lean();

      if (!updatedDoc) {
        throw new Error(`Document ${documentId} not found`);
      }

      await MongoDocumentEventModel.deleteMany({ documentId }, { session });

      await session.commitTransaction();
      return this.mapDocument(updatedDoc);
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  public async disconnect(): Promise<void> {
    await disconnectMongo();
    this.connected = false;
  }

  private mapDocument(doc: { _id: unknown; title: string; state: unknown; createdAt: Date; updatedAt: Date }): DocumentModel {
    return {
      id: String(doc._id),
      title: doc.title,
      state: doc.state,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private mapEvent(event: { _id: unknown; documentId: string; type: string; payload: unknown; createdAt: Date }): DocumentEventModel {
    return {
      id: String(event._id),
      documentId: event.documentId,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt
    };
  }
}
