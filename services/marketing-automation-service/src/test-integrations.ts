import { MarketingIntegrationConfig } from './integrations/base-marketing-integration';
import { IntegrationService } from './services/IntegrationService';

async function testIntegrations() {
  const integrationService = new IntegrationService();

  console.log('Testing Marketing Integrations...\n');

  // Test getting integration templates
  console.log('1. Getting integration templates:');
  const templates = integrationService.getIntegrationTemplates();

  templates.forEach(template => {
    console.log(
      `   - ${template.name} (${template.type}): ${template.description}`
    );
  });

  // Test creating a Google Analytics integration
  console.log('\n2. Creating Google Analytics integration:');
  const gaConfig: MarketingIntegrationConfig = {
    id: 'ga-test-integration',
    name: 'Test Google Analytics',
    type: 'google_analytics',
    credentials: {
      measurementId: 'G-XXXXXXXXXX',
      apiSecret: 'test-api-secret',
    },
    settings: {},
    isActive: true,
    trackingSettings: {
      trackPageViews: true,
      trackEvents: true,
      trackConversions: true,
      trackCustomEvents: true,
      customEventMappings: {},
    },
  };

  const gaResult = await integrationService.createIntegration(gaConfig);

  console.log(`   Result: ${gaResult.success ? 'Success' : 'Failed'}`);
  if (gaResult.error) {
    console.log(`   Error: ${gaResult.error}`);
  }

  // Test creating a Facebook Pixel integration
  console.log('\n3. Creating Facebook Pixel integration:');
  const fbConfig: MarketingIntegrationConfig = {
    id: 'fb-test-integration',
    name: 'Test Facebook Pixel',
    type: 'facebook_pixel',
    credentials: {
      pixelId: '123456789',
      accessToken: 'test-access-token',
    },
    settings: {},
    isActive: true,
    trackingSettings: {
      trackPageViews: true,
      trackEvents: true,
      trackConversions: true,
      trackCustomEvents: true,
      customEventMappings: {},
    },
  };

  const fbResult = await integrationService.createIntegration(fbConfig);

  console.log(`   Result: ${fbResult.success ? 'Success' : 'Failed'}`);
  if (fbResult.error) {
    console.log(`   Error: ${fbResult.error}`);
  }

  // Test creating a Segment integration
  console.log('\n4. Creating Segment integration:');
  const segmentConfig: MarketingIntegrationConfig = {
    id: 'segment-test-integration',
    name: 'Test Segment',
    type: 'segment',
    credentials: {
      writeKey: 'test-write-key',
    },
    settings: {},
    isActive: true,
    trackingSettings: {
      trackPageViews: true,
      trackEvents: true,
      trackConversions: true,
      trackCustomEvents: true,
      customEventMappings: {},
    },
  };

  const segmentResult =
    await integrationService.createIntegration(segmentConfig);

  console.log(`   Result: ${segmentResult.success ? 'Success' : 'Failed'}`);
  if (segmentResult.error) {
    console.log(`   Error: ${segmentResult.error}`);
  }

  // Test creating a Zapier integration
  console.log('\n5. Creating Zapier integration:');
  const zapierConfig: MarketingIntegrationConfig = {
    id: 'zapier-test-integration',
    name: 'Test Zapier',
    type: 'zapier',
    credentials: {
      webhookUrl: 'https://hooks.zapier.com/hooks/catch/test/webhook',
    },
    settings: {},
    isActive: true,
    trackingSettings: {
      trackPageViews: true,
      trackEvents: true,
      trackConversions: true,
      trackCustomEvents: true,
      customEventMappings: {},
    },
  };

  const zapierResult = await integrationService.createIntegration(zapierConfig);

  console.log(`   Result: ${zapierResult.success ? 'Success' : 'Failed'}`);
  if (zapierResult.error) {
    console.log(`   Error: ${zapierResult.error}`);
  }

  // Test tracking a unified event
  console.log('\n6. Testing unified event tracking:');
  const eventResult = await integrationService.trackUnifiedEvent({
    eventName: 'test_event',
    eventType: 'custom',
    userId: 'test-user-123',
    sessionId: 'test-session-456',
    properties: {
      page_url: 'https://example.com/test',
      source: 'test',
    },
  });

  console.log(
    `   Event tracking result: ${eventResult.success ? 'Success' : 'Failed'}`
  );
  console.log(
    `   Summary: ${eventResult.summary.successful}/${eventResult.summary.total} integrations succeeded`
  );

  // Test getting integration insights
  console.log('\n7. Getting integration insights:');
  const insights = await integrationService.getIntegrationInsights();

  console.log(`   Total integrations: ${insights.totalIntegrations}`);
  console.log(`   Active integrations: ${insights.activeIntegrations}`);
  console.log(`   Health status: ${insights.healthStatus}`);
  console.log(`   Integration types:`, insights.integrationTypes);
  console.log(`   Recommendations:`, insights.recommendations);

  console.log('\nIntegration testing completed!');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testIntegrations().catch(console.error);
}

export { testIntegrations };
