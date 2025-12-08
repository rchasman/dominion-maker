import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/generate-action' && req.method === 'POST') {
            try {
              // Dynamically import the API handler
              const handler = await import('./api/generate-action');

              // Collect request body
              let body = '';
              req.on('data', chunk => {
                body += chunk.toString();
              });

              req.on('end', async () => {
                try {
                  // Convert Node.js request to Web Request
                  const request = new Request('http://localhost:5173/api/generate-action', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: body,
                  });

                  // Call the handler
                  const response = await handler.default(request);

                  // Convert Web Response to Node.js response
                  res.statusCode = response.status;
                  res.setHeader('Content-Type', 'application/json');
                  const responseBody = await response.text();
                  res.end(responseBody);
                } catch (err) {
                  console.error('API handler error:', err);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Internal server error' }));
                }
              });
            } catch (err) {
              console.error('Failed to load API handler:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Failed to load API handler' }));
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  define: {
    'import.meta.env.VITE_VERCEL_URL': JSON.stringify(process.env.VERCEL_URL),
  },
})
