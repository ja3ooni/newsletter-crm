const fs = require('fs');
fs.writeFileSync('services/user-service/.env.test', 'DATABASE_URL=postgres://localhost/test\nJWT_SECRET=secret\nJWT_REFRESH_SECRET=secret');
