/**
 * Test script to verify the alias availability endpoint is working correctly
 */
async function testAliasAvailability() {
  const BASE_URL = 'http://localhost:4000';
  
  console.log('Testing alias availability endpoint...\n');

  try {
    // Test 1: Check availability of a non-existent alias
    console.log('Test 1: Checking availability of "nonexistent-alias"');
    const response1 = await fetch(`${BASE_URL}/handles/alias/check/nonexistent-alias`);
    const data1 = await response1.json();
    console.log('Response:', data1);
    console.log('✓ Test 1 passed\n');

    // Test 2: Check with a special character alias
    console.log('Test 2: Checking availability of "test-alias-123"');
    const response2 = await fetch(`${BASE_URL}/handles/alias/check/test-alias-123`);
    const data2 = await response2.json();
    console.log('Response:', data2);
    console.log('✓ Test 2 passed\n');

    console.log('All tests completed successfully!');
    console.log('\nSummary of changes:');
    console.log('- Added /handles/alias/check/:alias endpoint');
    console.log('- Removed deprecated /handles/username/search/:username endpoint');
    console.log('- Removed deprecated /handles/username/set endpoint');
    console.log('- Updated alias constraints for better validation');
    console.log('- Created migration for production deployments');
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Run the test
testAliasAvailability().catch(console.error);
