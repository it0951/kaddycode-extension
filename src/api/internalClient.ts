import axios, { AxiosInstance } from 'axios';

// ── 요청 타입 ──────────────────────────────────────────────────────────────

export interface ChatRequest {
    userId: string;
    message: string;
    model?: string;               // 기본값: qwen2.5-coder:7b
    useRag?: boolean;             // RAG 사용 여부 (기본 true)
    ragLimit?: number;            // RAG 검색 결과 수 (기본 3)
    ragScoreThreshold?: number;   // RAG score 임계값 (기본 0.5)
}

export interface VectorIndexRequest {
    id: string;
    code: string;
    filePath: string;
    language?: string;
    description?: string;
}

export interface VectorSearchRequest {
    query: string;
    limit?: number;
    scoreThreshold?: number;      // score 임계값 (기본 0.0 = 필터 없음)
    language?: string;            // 언어 필터
    filePathPrefix?: string;      // 파일 경로 prefix 필터
}

// ── 응답 타입 ──────────────────────────────────────────────────────────────

export interface ChatResponse {
    userId: string;
    message: string;
    model: string;
    createdAt: string;
    ragUsed: boolean;             // RAG 컨텍스트 사용 여부
    references: string[];         // 참조된 파일 경로 목록
}

export interface VectorSearchResponse {
    id: string;
    score: number;
    filePath: string;
    code: string;
    language: string;
}

export interface HealthResponse {
    server: string;
    database: string;
    qdrant: string;
}

// ── 클라이언트 ─────────────────────────────────────────────────────────────

export class InternalClient {
    private client: AxiosInstance;

    constructor(baseUrl: string = 'http://localhost:8081') {
        this.client = axios.create({
            baseURL: baseUrl,
            timeout: 120000,   // 7b 모델 응답 대기 여유 (2분)
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const payload: ChatRequest = {
            useRag: true,
            ragLimit: 3,
            ragScoreThreshold: 0.5,
            model: 'qwen2.5-coder:7b',
            ...request  // 호출 측 값으로 덮어씀
        };
        const response = await this.client.post<ChatResponse>(
            '/api/v1/chat/completions', payload
        );
        return response.data;
    }

    async indexCode(request: VectorIndexRequest): Promise<void> {
        await this.client.post('/api/v1/vector/index', request);
    }

    async searchCode(request: VectorSearchRequest): Promise<VectorSearchResponse[]> {
        const payload: VectorSearchRequest = {
            limit: 5,
            scoreThreshold: 0.0,
            ...request
        };
        const response = await this.client.post<VectorSearchResponse[]>(
            '/api/v1/vector/search', payload
        );
        return response.data;
    }

    async health(): Promise<boolean> {
        try {
            const response = await this.client.get<HealthResponse>('/api/v1/health');
            return response.data.server === 'UP' && response.data.qdrant === 'UP';
        } catch {
            return false;
        }
    }
}

export const internalClient = new InternalClient();