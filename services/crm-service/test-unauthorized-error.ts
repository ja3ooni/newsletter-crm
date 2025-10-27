// Simple TypeScript test to verify UnauthorizedError class
import { CRMError, UnauthorizedError } from './src/types/index';

// Test default message
const error1 = new UnauthorizedError();
console.log(
  '✓ Default UnauthorizedError created:',
  error1.message,
  'Status:',
  error1.statusCode
);

// Test custom message
const error2 = new UnauthorizedError('Custom unauthorized message');
console.log(
  '✓ Custom UnauthorizedError created:',
  error2.message,
  'Status:',
  error2.statusCode
);

// Test inheritance
console.log('✓ Is instance of Error:', error1 instanceof Error);
console.log('✓ Is instance of CRMError:', error1 instanceof CRMError);
console.log(
  '✓ Is instance of UnauthorizedError:',
  error1 instanceof UnauthorizedError
);

// Test that it has the correct status code
if (error1.statusCode === 401 && error2.statusCode === 401) {
  console.log('✓ Status code is correct (401)');
} else {
  console.error('❌ Status code is incorrect');
  process.exit(1);
}

console.log('\n✅ UnauthorizedError class is working correctly!');
