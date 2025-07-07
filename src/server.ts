import { app } from './infrastructure/app';

const PORT = parseInt(process.env['PORT'] || '30000', 10);
const HOST = process.env['HOST'] || 'localhost';

app.start(PORT, HOST);