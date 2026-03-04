import { Prisma, PrismaClient, type Document,type DocumentEvent } from "@prisma/client";

export class DocumentRepository{

    private prismaClient: PrismaClient;

    public constructor(){
        this.prismaClient = new PrismaClient();
    }

    public async createDocument(title: string): Promise<Document>{
        const document = await this.prismaClient.document.create(
            {
                data:{
                    title:title
                }
            }
        )
        return document;
    }

    public async loadDocument(documentId:string): Promise<Document | null>{
        const document = await this.prismaClient.document.findUnique(
            {
                where: {
                    id: documentId
                }
            }
        )

        return document;
    }

    public async saveEvent(documentId:string, eventType:string, payload:unknown): Promise<DocumentEvent>{
        const document = await this.prismaClient.documentEvent.create({
            data:{
                documentId: documentId,
                type: eventType,
                payload: payload as Prisma.InputJsonValue
            }
        })

        return document;
    }

    public async consolidateDocument(documentId:string, consolidateState:unknown): Promise<Document>{
        const [updateDocument, deleteEvent] = await this.prismaClient.$transaction([
            this.prismaClient.document.update({
                where:{
                    id: documentId
                },
                data:{
                    state:consolidateState as Prisma.InputJsonValue
                }
            }),
            this.prismaClient.documentEvent.deleteMany({
                where:{documentId:documentId}
            })
        ])

        return updateDocument;
    }
}