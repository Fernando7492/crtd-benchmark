export interface Identifier{
    agentId: string;
    seq: number;
}

export interface RGANode<T>{
    id: Identifier;
    origin: Identifier | null;
    value: T;
    isDeleted: boolean;

}

export type RGAOperationType = 'INSERT' | 'DELETE';

export type PendingInsert<T> = {value: T, id: Identifier, origin: Identifier};

export interface RGAOperation<T>{
    type: RGAOperationType;
    node: RGANode<T>;
}