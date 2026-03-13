import axios, { AxiosInstance } from 'axios';

export interface ChatRequest {
    userId: string;
    message: string;
    model?: string;
}

export interface ChatResponse {
    userId: string;
    message: string;
    model: string;
    createdAt: string;
}

export interface VectorIndexRequest {
    id: string;
    code: string;
    filePath: string;
    language?: string;
}

export interface VectorSearchRequest {
    query: string;
    limit?: number;
}

export interface VectorSearchResponse {
    id: string;
    score: number;
    filePath: string;
    code: string;
    language: string;
}

export class InternalClient {
    private client: AxiosInstance;

    constructor(baseUrl: string = 'http://localhost:8081') {
        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 60000,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const response = await this.client.post<ChatResponse>('/api/v1/chat/completions', request);
        return response.data;
    }

    async indexCode(request: VectorIndexRequest): Promise<void> {
        await this.client.post('/api/v1/vector/index', request);
    }

    async searchCode(request: VectorSearchRequest): Promise<VectorSearchResponse[]> {
        const response = await this.client.post<VectorSearchResponse[]>('/api/v1/vector/search', request);
        return response.data;
    }

    async health(): Promise<boolean> {
        try {
            await this.client.get('/api/v1/health');
            return true;
        } catch {
            return false;
        }
    }
}

export const internalClient = new InternalClient();