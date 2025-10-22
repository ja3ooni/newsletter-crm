import {
    AutomationEvent,
    CampaignSubscription,
    DripCampaign,
    DripEmail,
    EventTrigger,
    TriggerCondition,
    Workflow,
    WorkflowExecution,
    WorkflowStep
} from '../../src/types';

export const mockTriggerConditions: TriggerCondition[] = [
  {
    field: 'data.plan',
    operator: 'equals',
    value: 'premium'
  },
  {
    field: 'data.source',
    operator: 'equals',
    value: 'website',
    logicalOperator: 'AND'
  }
];

export const mockAutomationEvent: AutomationEvent = {
  id: 'event-123',
  type: 'user_signup',
  contactId: 'contact-123',
  data: {
    plan: 'premium',
    source: 'website',
    utm_campaign: 'summer-promo'
  },
  source: 'user-service',
  processed: false,
  processedAt: undefined,
  timestamp: new Date('2024-01-15T10:00:00Z')
};

export const mockProcessedEvent: AutomationEvent = {
  ...mockAutomationEvent,
  id: 'event-456',
  processed: true,
  processedAt: new Date('2024-01-15T10:05:00Z')
};

export const mockEventTrigger: EventTrigger = {
  id: 'trigger-123',
  name: 'Welcome Workflow Trigger',
  eventType: 'user_signup',
  conditions: mockTriggerConditions,
  workflowId: 'workflow-123',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15')
};

export const mockWorkflowSteps: WorkflowStep[] = [
  {
    id: 'step-1',
    type: 'email',
    config: {
      templateId: 'welcome-template',
      subject: 'Welcome to our platform!',
      delay: 0
    },
    nextSteps: ['step-2'],
    position: { x: 100, y: 100 }
  },
  {
    id: 'step-2',
    type: 'wait',
    config: {
      duration: 24,
      unit: 'hours'
    },
    nextSteps: ['step-3'],
    position: { x: 100, y: 200 }
  },
  {
    id: 'step-3',
    type: 'condition',
    config: {
      conditions: [
        {
          field: 'contact.leadScore',
          operator: 'greater_than',
          value: 50
        }
      ]
    },
    nextSteps: ['step-4', 'step-5'],
    position: { x: 100, y: 300 }
  },
  {
    id: 'step-4',
    type: 'email',
    config: {
      templateId: 'high-score-template',
      subject: 'Special offer for you!'
    },
    nextSteps: [],
    position: { x: 50, y: 400 }
  },
  {
    id: 'step-5',
    type: 'tag',
    config: {
      action: 'add',
      tags: ['needs-nurturing']
    },
    nextSteps: [],
    position: { x: 150, y: 400 }
  }
];

export const mockWorkflow: Workflow = {
  id: 'workflow-123',
  name: 'Welcome Onboarding Workflow',
  description: 'Automated welcome sequence for new users',
  trigger: {
    type: 'event',
    conditions: mockTriggerConditions,
    settings: {
      eventType: 'user_signup'
    }
  },
  steps: mockWorkflowSteps,
  status: 'active',
  metrics: {
    totalExecutions: 150,
    completedExecutions: 120,
    failedExecutions: 5,
    averageCompletionTime: 86400000, // 24 hours in ms
    conversionRate: 0.8
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15')
};

export const mockWorkflowExecution: WorkflowExecution = {
  id: 'execution-123',
  workflowId: 'workflow-123',
  contactId: 'contact-123',
  status: 'running',
  currentStep: 'step-1',
  startedAt: new Date('2024-01-15T10:00:00Z'),
  completedAt: undefined,
  metadata: {
    triggeredBy: 'event',
    eventId: 'event-123',
    eventType: 'user_signup'
  },
  executionLog: [
    {
      stepId: 'step-1',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      status: 'started',
      metadata: { stepType: 'email' }
    }
  ]
};

export const mockDripEmails: DripEmail[] = [
  {
    id: 'email-1',
    subject: 'Welcome to our platform!',
    preheader: 'Get started with your new account',
    content: '<h1>Welcome!</h1><p>Thanks for joining us.</p>',
    templateId: 'welcome-template',
    delay: 0,
    order: 0
  },
  {
    id: 'email-2',
    subject: 'Getting started guide',
    preheader: 'Learn how to make the most of our platform',
    content: '<h1>Getting Started</h1><p>Here are some tips...</p>',
    templateId: 'guide-template',
    delay: 24,
    order: 1
  },
  {
    id: 'email-3',
    subject: 'Special offer just for you',
    preheader: 'Limited time offer for new users',
    content: '<h1>Special Offer</h1><p>Get 20% off...</p>',
    templateId: 'offer-template',
    delay: 72,
    order: 2,
    conditions: [
      {
        field: 'contact.leadScore',
        operator: 'greater_than',
        value: 30
      }
    ]
  }
];

export const mockDripCampaign: DripCampaign = {
  id: 'campaign-123',
  name: 'Welcome Email Series',
  description: 'Automated welcome email sequence for new subscribers',
  emails: mockDripEmails,
  trigger: {
    type: 'event',
    eventType: 'user_signup',
    conditions: []
  },
  status: 'active',
  metrics: {
    totalSubscribers: 500,
    activeSubscribers: 350,
    completedSubscribers: 120,
    unsubscribed: 30,
    averageOpenRate: 0.65,
    averageClickRate: 0.15,
    conversionRate: 0.08
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15')
};

export const mockCampaignSubscription: CampaignSubscription = {
  id: 'subscription-123',
  campaignId: 'campaign-123',
  contactId: 'contact-123',
  status: 'active',
  currentEmailIndex: 0,
  subscribedAt: new Date('2024-01-15T10:00:00Z'),
  nextEmailAt: new Date('2024-01-15T10:00:00Z'),
  completedAt: undefined,
  metadata: {
    triggeredBy: 'event',
    eventId: 'event-123',
    source: 'signup-form'
  }
};

export const mockCompletedSubscription: CampaignSubscription = {
  ...mockCampaignSubscription,
  id: 'subscription-456',
  status: 'completed',
  currentEmailIndex: 3,
  completedAt: new Date('2024-01-18T10:00:00Z')
};

export const validCreateWorkflowRequest = {
  name: 'New Customer Onboarding',
  description: 'Comprehensive onboarding workflow for new customers',
  trigger: {
    type: 'event' as const,
    conditions: [
      {
        field: 'data.customerType',
        operator: 'equals' as const,
        value: 'premium'
      }
    ],
    settings: {
      eventType: 'customer_created'
    }
  },
  steps: [
    {
      id: 'welcome-email',
      type: 'email' as const,
      config: {
        templateId: 'customer-welcome',
        subject: 'Welcome to Premium!'
      },
      nextSteps: [],
      position: { x: 100, y: 100 }
    }
  ]
};

export const validCreateDripCampaignRequest = {
  name: 'Product Education Series',
  description: 'Educational email series about product features',
  emails: [
    {
      id: 'edu-1',
      subject: 'Feature Spotlight: Analytics',
      preheader: 'Discover powerful analytics features',
      content: '<h1>Analytics</h1><p>Learn about our analytics...</p>',
      delay: 0,
      order: 0
    },
    {
      id: 'edu-2',
      subject: 'Feature Spotlight: Automation',
      preheader: 'Automate your workflows',
      content: '<h1>Automation</h1><p>Save time with automation...</p>',
      delay: 48,
      order: 1
    }
  ],
  trigger: {
    type: 'manual' as const,
    conditions: [],
    settings: {}
  }
};
