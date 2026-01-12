'use client'

import { Button } from '@/components/ui/Button'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { motion } from 'framer-motion'
import Link from 'next/link'

export function CTA(): JSX.Element {
  return (
    <section className="bg-primary-600">
      <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Ready to transform your newsletter strategy?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-100"
          >
            Join thousands of businesses already using DatatechtonCRM to grow their audience
            and increase engagement. Start your free trial today.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="mt-10 flex items-center justify-center gap-x-6"
          >
            <Link href="/auth/register">
              <Button
                size="lg"
                variant="secondary"
                className="group bg-white text-primary-600 hover:bg-gray-50"
              >
                Get started for free
                <ArrowRightIcon className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact" className="text-sm font-semibold leading-6 text-white hover:text-primary-100">
              Contact sales <span aria-hidden="true">→</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
