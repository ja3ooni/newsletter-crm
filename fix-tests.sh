git checkout -- services/user-service/tests/services/UserService.test.ts
git checkout -- services/user-service/tests/services/UserService.simple.test.ts

# Actually properly patch the user service test types
node -e "
const fs = require('fs');
let c1 = fs.readFileSync('services/user-service/tests/services/UserService.test.ts', 'utf8');
c1 = c1.replace(/const mockHashPassword = jest\.fn\(\);\nconst mockVerifyPassword = jest\.fn\(\);\njest\.mock\('\.\.\/\.\.\/src\/utils\/auth', \(\) => \(\{[\s\S]*?\}\)\);/, \`
const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();
jest.mock('../../src/utils/auth', () => ({
  AuthUtils: {
    hashPassword: (...args) => mockHashPassword(...args),
    verifyPassword: (...args) => mockVerifyPassword(...args)
  }
}));\`);

c1 = c1.replace(/mockUserRepository\.create\.mockResolvedValue\((.*?)\);/g, 'mockUserRepository.create.mockResolvedValue(\$1 as any);');
c1 = c1.replace(/mockUserRepository\.findById\.mockResolvedValue\((.*?)\);/g, 'mockUserRepository.findById.mockResolvedValue(\$1 as any);');
c1 = c1.replace(/mockUserRepository\.findByEmail\.mockResolvedValue\((.*?)\);/g, 'mockUserRepository.findByEmail.mockResolvedValue(\$1 as any);');
c1 = c1.replace(/mockUserRepository\.update\.mockResolvedValue\((.*?)\);/g, 'mockUserRepository.update.mockResolvedValue(\$1 as any);');
c1 = c1.replace(/mockUserRepository\.updatePreferences\.mockResolvedValue\((.*?)\);/g, 'mockUserRepository.updatePreferences.mockResolvedValue(\$1 as any);');
c1 = c1.replace(/userService\.updatePreferences\(userId, (invalidPreferences|preferences)\)/g, 'userService.updatePreferences(userId, \$1 as any)');
c1 = c1.replace(/const result = await userService.createUser\(oauthUserData\);/g, 'const result = await userService.createUser(oauthUserData as any);');
c1 = c1.replace(/await expect\(userService.createUser\((weakPasswordUser|incompleteUser|invalidEmailUser|validCreateUserRequest)\)\)/g, 'await expect(userService.createUser(\$1 as any))');

fs.writeFileSync('services/user-service/tests/services/UserService.test.ts', c1);

let c2 = fs.readFileSync('services/user-service/tests/services/UserService.simple.test.ts', 'utf8');
c2 = c2.replace(/const mockValidateEmail = jest\.fn\(\);\nconst mockIsValidPassword = jest\.fn\(\);\nconst mockHashPassword = jest\.fn\(\);\nconst mockVerifyPassword = jest\.fn\(\);\n/g, '');
c2 = c2.replace(/await expect\(userService.createUser\((weakPasswordUser|incompleteUser|invalidEmailUser|validCreateUserRequest)\)\)/g, 'await expect(userService.createUser(\$1 as any))');
fs.writeFileSync('services/user-service/tests/services/UserService.simple.test.ts', c2);

fs.writeFileSync('services/user-service/tests/setup.ts', 'process.env.DATABASE_URL = \"postgres://localhost:5432/test\";\\nprocess.env.JWT_SECRET = \"test-secret\";\\nprocess.env.JWT_REFRESH_SECRET = \"test-refresh-secret\";\\n');
"
