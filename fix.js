const fs = require('fs');

// We simply need to ensure .gitignore ignores all the junk.
const gitignore = `
node_modules/
dist/
coverage/
*.log
.DS_Store
.env
.env.local
*.tsbuildinfo
patch_*.js
fix_*.js
`;

fs.writeFileSync('.gitignore', gitignore);
