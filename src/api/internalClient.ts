import axios, { AxiosInstance } from 'axios';
import * as vscode from 'vscode';

// ── 요청 타입 ──────────────────────────────────────────────────────────────

export interface ChatRequest {
    userId: string;
    message: string;
    provider?: string;
    model?: string;
    useRag?: boolean;
    ragLimit?: number;
    ragScoreThreshold?: number;
    bypassCache?: boolean;
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
    scoreThreshold?: number;
    language?: string;
    filePathPrefix?: string;
}

// ── 응답 타입 ──────────────────────────────────────────────────────────────

export interface ChatResponse {
    userId: string;
    message: string;
    model: string;
    createdAt: string;
    ragUsed: boolean;
    references: string[];
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

export interface TenantInfo {
    name: string;
    apiKey: string;
    active: boolean;
}

// ── 설정 읽기 헬퍼 ─────────────────────────────────────────────────────────

function getConfig() {
    const cfg = vscode.workspace.getConfiguration('ustracode');
    return {
        serverUrl:       cfg.get<string>('serverUrl', 'http://localhost:8081'),
        apiKey:          cfg.get<string>('apiKey', ''),
        defaultProvider: cfg.get<string>('defaultProvider', 'ollama'),
        defaultModel:    cfg.get<string>('defaultModel', 'qwen2.5-coder:14b'),
        ragEnabled:      cfg.get<boolean>('ragEnabled', true),
    };
}

// ── 클라이언트 ─────────────────────────────────────────────────────────────

export class InternalClient {

    // 설정이 바뀔 때마다 새 AxiosInstance를 만들어 반환
    private _buildClient(): AxiosInstance {
        const { serverUrl, apiKey } = getConfig();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json; charset=utf-8',
        };

        if (apiKey && apiKey.trim() !== '') {
            headers['X-Tenant-API-Key'] = apiKey.trim();
        }

        return axios.create({
            baseURL: serverUrl,
            timeout: 300000,
            headers,
        });
    }

    async chat(request: ChatRequest): Promise<ChatResponse> {
        const { defaultProvider, defaultModel, ragEnabled } = getConfig();

        const payload: ChatRequest = {
            useRag:             ragEnabled,
            ragLimit:           3,
            ragScoreThreshold:  0.5,
            provider:           defaultProvider,
            model:              defaultModel,
            ...request,   // 호출 측 값으로 덮어씀
        };

        const response = await this._buildClient().post<ChatResponse>(
            '/api/v1/chat/completions', payload
        );
        return response.data;
    }

    async indexCode(request: VectorIndexRequest): Promise<void> {
        await this._buildClient().post('/api/v1/vector/index', request);
    }

    async searchCode(request: VectorSearchRequest): Promise<VectorSearchResponse[]> {
        const payload: VectorSearchRequest = {
            limit: 5,
            scoreThreshold: 0.0,
            ...request,
        };
        const response = await this._buildClient().post<VectorSearchResponse[]>(
            '/api/v1/vector/search', payload
        );
        return response.data;
    }

    async health(): Promise<boolean> {
        try {
            const response = await this._buildClient().get<HealthResponse>('/api/v1/health');
            return response.data.server === 'UP' && response.data.qdrant === 'UP';
        } catch {
            return false;
        }
    }

    // 테넌트 API Key 유효성 검증
    async verifyApiKey(): Promise<{ valid: boolean; tenantName?: string }> {
        const { apiKey } = getConfig();
        if (!apiKey || apiKey.trim() === '') {
            return { valid: false };
        }
        try {
            const response = await this._buildClient().post<TenantInfo>(
                '/api/v1/tenant/verify'
            );
            return { valid: response.data.active, tenantName: response.data.name };
        } catch {
            return { valid: false };
        }
    }

    // 현재 설정값 반환 (UI 표시용)
    getSettings() {
        return getConfig();
    }
}

export const internalClient = new InternalClient();