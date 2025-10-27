// Simple test to verify UnauthorizedError class
const { UnauthorizedError } = require('./dist/types/index.js');

try {
  // Test default message
  const error1 = new UnauthorizedError();
  console.log('✓ Default UnauthorizedError created:', error1.message, 'Status:', error1.statusCode);

  // Test custom message
  const error2 = new UnauthorizedError('Custom unauthorized message');
  console.log('✓ Custom UnauthorizedError created:', error2.message, 'Status:', error2.statusCode);

  // Test inheritance
  console.log('✓ Is instance of Error:', error1 instanceof Error);
  console.log('✓ Is instance of UnauthorizedError:', error1 instanceof UnauthorizedError);

  console.log('\n✅ UnauthorizedError class is working correctly!');
} catch (error) {
  console.error('❌ Error testing UnauthorizedError:', error.message);
  process.exit(1);
}
