export interface DocumentModel {
    id: string;
    title: string;
    state: unknown;
    createdAt: Date;
    updatedAt: Date;
}

export interface DocumentEventModel {
    id: string;
    documentId: string;
    type: string;
    payload: unknown;
    createdAt: Date;
}

export interface IDocumentRepository {
    createDocument(title: string): Promise<DocumentModel>;
    loadDocument(documentId: string): Promise<DocumentModel | null>;
    saveEvent(documentId: string, eventType: string, payload: unknown): Promise<DocumentEventModel>;
    consolidateDocument(documentId: string, consolidateState: unknown): Promise<DocumentModel>;
    disconnect(): Promise<void>;
}
