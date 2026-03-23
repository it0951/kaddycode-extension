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

export interface TenantApiKeyInfo {
    id: number;
    provider: string;
    apiKey: string;
    apiUrl: string;
    model: string;
    active: boolean;
}

export interface TenantInfo {
    tenantId: number;
    name: string;
    active: boolean;
    aiProvider: string;
    aiModel: string;
    apiKeys: TenantApiKeyInfo[];
    activeProviders: string[];
}

// ── 설정 읽기 헬퍼 ─────────────────────────────────────────────────────────

function getConfig() {
    const cfg = vscode.workspace.getConfiguration('ustracode');
    return {
        serverUrl:       cfg.get<string>('serverUrl', 'http://localhost:8081'),
        email:           cfg.get<string>('email', ''),           // ← 추가
        apiKey:          cfg.get<string>('apiKey', ''),
        userId:          cfg.get<string>('userId', ''),
        defaultProvider: cfg.get<string>('defaultProvider', 'ollama'),
        defaultModel:    cfg.get<string>('defaultModel', 'qwen2.5-coder:14b'),
        ragEnabled:      cfg.get<boolean>('ragEnabled', true),
    };
}

// ── userId 결정 로직 ───────────────────────────────────────────────────────

export function getUserId(): string {
    const { userId } = getConfig();
    if (userId && userId.trim() !== '') {
        return userId.trim();
    }
    return vscode.env.machineId;
}

// ── 클라이언트 ─────────────────────────────────────────────────────────────

export class InternalClient {

    private _buildClient(): AxiosInstance {
        const { serverUrl, email, apiKey } = getConfig();

        const headers: Record<string, string> = {
            'Content-Type': 'application/json; charset=utf-8',
        };

        if (apiKey && apiKey.trim() !== '') {
            headers['X-Tenant-API-Key'] = apiKey.trim();
        }
        if (email && email.trim() !== '') {
            headers['X-Tenant-Email'] = email.trim();    // ← 추가
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
            useRag:            ragEnabled,
            ragLimit:          3,
            ragScoreThreshold: 0.5,
            provider:          defaultProvider,
            model:             defaultModel,
            ...request,
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

    async verifyApiKey(): Promise<{ valid: boolean; tenantName?: string; tenantInfo?: TenantInfo }> {
        const { apiKey, email } = getConfig();
        if (!apiKey || apiKey.trim() === '') {
            return { valid: false };
        }
        if (!email || email.trim() === '') {
            return { valid: false };
        }
        try {
            const response = await this._buildClient().post<TenantInfo>(
                '/api/v1/tenant/verify'
            );
            return {
                valid: response.data.active,
                tenantName: response.data.name,
                tenantInfo: response.data,
            };
        } catch {
            return { valid: false };
        }
    }

    getSettings() {
        return { ...getConfig(), userId: getUserId() };
    }
}

export const internalClient = new InternalClient();