const { EventSource } = require('eventsource');
const axios = require('axios');

async function run() {
    console.log('Connecting to SSE...');
    const es = new EventSource('http://localhost:4000/mcp/sse');

    es.onmessage = (event) => {
        console.log('Received event:', event.data);
    };

    es.addEventListener('endpoint', async (event) => {
        console.log('Received endpoint event:', event.data);
        const endpointUri = new URL(event.data, 'http://localhost:4000').toString();
        console.log('Endpoint URI:', endpointUri);

        // Once we have the endpoint, send a JSON-RPC message to list tools
        const msg = {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/list',
            params: {}
        };

        try {
            console.log('Sending tools/list request...');
            const res = await axios.post(endpointUri, msg);
            console.log('Response:', JSON.stringify(res.data, null, 2));

            // Do not close immediately, wait for response via SSE
            setTimeout(() => {
                console.log('Closing connection after timeout');
                es.close();
            }, 5000);
        } catch (e) {
            console.error('Error sending message:', e.message);
            if (e.response) {
                console.error('Response data:', e.response.data);
            }
            es.close();
        }
    });

    es.onopen = () => {
        console.log('SSE Connected!');
    };

    es.onerror = (err) => {
        console.error('SSE Error:', err);
        es.close();
    };
}

run();
