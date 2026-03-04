import mongoose, { Schema, Document as MongoDocument, model } from "mongoose";

export interface IDocument extends MongoDocument {
  title: string;
  state: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    title: { type: String, default: "untitled" },
    state: { type: Schema.Types.Mixed, default: [] }
  },
  { timestamps: true }
);

export const DocumentModel = model<IDocument>("Document", DocumentSchema);

export interface IDocumentEvent extends MongoDocument {
  documentId: string;
  type: string;
  payload: unknown;
  createdAt: Date;
}

const DocumentEventSchema = new Schema<IDocumentEvent>(
  {
    documentId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DocumentEventSchema.index({ documentId: 1, createdAt: 1 });

export const DocumentEventModel = model<IDocumentEvent>("DocumentEvent", DocumentEventSchema);

export async function connectMongo(uri: string): Promise<void> {
  await mongoose.connect(uri);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}
