import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`ShokAI API available at http://localhost:${env.PORT}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received. Shutting down the server...`);
  server.close((error) => {
    if (error) {
      console.error('Error while shutting down the server:', error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
