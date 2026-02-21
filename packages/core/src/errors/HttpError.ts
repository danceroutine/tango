export interface HttpError {
    status: number;
    body: {
        error: string;
        details?: Record<string, string[]> | null;
    };
}
