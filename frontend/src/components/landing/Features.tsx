'use client'

import {
    BoltIcon,
    ChartBarIcon,
    CogIcon,
    GlobeAltIcon,
    ShieldCheckIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'

const features = [
  {
    name: 'Advanced CRM & Contact Management',
    description: 'Comprehensive contact profiles, lead scoring, dynamic segmentation, and complete interaction history tracking.',
    icon: UserGroupIcon,
  },
  {
    name: 'Marketing Automation Workflows',
    description: 'Visual workflow builder with conditional logic, drip campaigns, and event-driven automation sequences.',
    icon: CogIcon,
  },
  {
    name: 'Real-time Analytics & Insights',
    description: 'Detailed engagement metrics, predictive analytics, cohort analysis, and revenue attribution tracking.',
    icon: ChartBarIcon,
  },
  {
    name: 'Enterprise Security & Compliance',
    description: 'GDPR compliance, end-to-end encryption, audit logging, and comprehensive security monitoring.',
    icon: ShieldCheckIcon,
  },
  {
    name: 'AI-Powered Personalization',
    description: 'Machine learning content recommendations, optimal send time prediction, and behavioral personalization.',
    icon: BoltIcon,
  },
  {
    name: 'Multi-Channel Distribution',
    description: 'Email, Slack, Discord, webhooks, RSS feeds, and social media automation with unified analytics.',
    icon: GlobeAltIcon,
  },
]

export function Features(): JSX.Element {
  return (
    <section className="py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-base font-semibold leading-7 text-primary-600"
          >
            Everything you need
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl"
          >
            Professional newsletter platform built for scale
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="mt-6 text-lg leading-8 text-gray-600"
          >
            From startup to enterprise, our platform grows with your business.
            Advanced features that deliver results from day one.
          </motion.p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex flex-col"
              >
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                  <feature.icon className="h-5 w-5 flex-none text-primary-600" aria-hidden="true" />
                  {feature.name}
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">{feature.description}</p>
                </dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
