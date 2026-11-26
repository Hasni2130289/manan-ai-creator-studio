import { createApp } from './app.js';
import { info, error as logError } from './logger.js';

const PORT = Number(process.env.PORT || 5000);

const { app } = await createApp();
app.listen(PORT, () => {
  info('manan-ai-creator-studio server listening', { port: PORT });
});

process.on('unhandledRejection', (err) => {
  logError('unhandled rejection', { message: String(err?.message || err) });
});
