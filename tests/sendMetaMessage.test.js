const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

// Mock environment variables before requiring the server
process.env.META_PAGE_ACCESS_TOKEN = 'test_token';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test_key';

const { sendMetaMessage } = require('../server');

describe('sendMetaMessage error handling', () => {
    let originalFetch;
    let originalConsoleError;

    before(() => {
        originalFetch = global.fetch;
        originalConsoleError = console.error;
    });

    after(() => {
        global.fetch = originalFetch;
        console.error = originalConsoleError;
    });

    test('should log error when fetch fails', async (t) => {
        const errorToThrow = new Error('Network failure');
        // Mock global fetch to throw an error
        global.fetch = t.mock.fn(async () => {
            throw errorToThrow;
        });

        // Mock console.error to track calls
        const consoleMock = t.mock.method(console, 'error', () => {});

        await sendMetaMessage('123', 'hello', 'instagram');

        // Check if console.error was called with the expected message and error
        assert.strictEqual(consoleMock.mock.callCount(), 1);
        const lastCall = consoleMock.mock.calls[0];
        assert.ok(lastCall.arguments[0].includes('❌ Error sending to instagram:'));
        assert.strictEqual(lastCall.arguments[1], errorToThrow);
    });

    test('should log error when response.json() fails', async (t) => {
        const errorToThrow = new Error('JSON parsing failed');
        // Mock global fetch to return a response that fails on .json()
        global.fetch = t.mock.fn(async () => {
            return {
                json: async () => { throw errorToThrow; }
            };
        });

        // Mock console.error
        const consoleMock = t.mock.method(console, 'error', () => {});

        await sendMetaMessage('123', 'hello', 'instagram');

        assert.strictEqual(consoleMock.mock.callCount(), 1);
        const lastCall = consoleMock.mock.calls[0];
        assert.ok(lastCall.arguments[0].includes('❌ Error sending to instagram:'));
        assert.strictEqual(lastCall.arguments[1], errorToThrow);
    });
});
