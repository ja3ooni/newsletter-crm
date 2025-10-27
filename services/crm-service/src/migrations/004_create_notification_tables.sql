-- Migration: Create notification tables
-- Description: Add tables for push notifications and CRM notifications

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL, -- Contains p256dh and auth keys
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, endpoint)
);

-- CRM notifications table
CREATE TABLE IF NOT EXISTS crm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL, -- lead_assignment, follow_up_reminder, deal_update, task_overdue, meeting_reminder, system
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  payload JSONB, -- Push notification payload
  metadata JSONB, -- Additional data (contactId, dealId, etc.)
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  scheduled_for TIMESTAMP WITH TIME ZONE, -- For scheduled notifications
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,

  -- CRM-specific preferences
  lead_assignments BOOLEAN DEFAULT true,
  follow_up_reminders BOOLEAN DEFAULT true,
  deal_updates BOOLEAN DEFAULT true,
  task_overdue BOOLEAN DEFAULT true,
  meeting_reminders BOOLEAN DEFAULT true,

  -- Timing preferences
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  timezone VARCHAR(50) DEFAULT 'UTC',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notification delivery log
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES crm_notifications(id) ON DELETE CASCADE,
  delivery_method VARCHAR(20) NOT NULL, -- push, email, sms
  status VARCHAR(20) NOT NULL, -- sent, failed, delivered, clicked
  error_message TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);

CREATE INDEX IF NOT EXISTS idx_crm_notifications_user_id ON crm_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_type ON crm_notifications(type);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_priority ON crm_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_crm_notifications_scheduled ON crm_notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_notifications_unread ON crm_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_crm_notifications_created_at ON crm_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_notification_id ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(status);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT DISTINCT owner_id
FROM contacts
WHERE owner_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Add some sample notification data for testing
INSERT INTO crm_notifications (user_id, type, title, message, priority, metadata) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'lead_assignment', 'New Lead Assigned', 'John Smith from TechCorp has been assigned to you', 'high', '{"contactId": "contact-123"}'),
('550e8400-e29b-41d4-a716-446655440000', 'follow_up_reminder', 'Follow-up Reminder', 'Follow up with Sarah Johnson about the proposal', 'medium', '{"contactId": "contact-456", "taskId": "task-789"}'),
('550e8400-e29b-41d4-a716-446655440000', 'deal_update', 'Deal Stage Changed', 'Enterprise Software Deal moved to Negotiation stage', 'medium', '{"dealId": "deal-101"}'),
('550e8400-e29b-41d4-a716-446655440000', 'task_overdue', 'Task Overdue', 'Call with Mike Davis is overdue by 2 hours', 'urgent', '{"taskId": "task-202"}'),
('550e8400-e29b-41d4-a716-446655440000', 'meeting_reminder', 'Meeting in 15 minutes', 'Demo call with ABC Company starts soon', 'high', '{"meetingId": "meeting-303"}');
