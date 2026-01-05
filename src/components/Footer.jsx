import React from 'react'
import { motion } from 'framer-motion'
import { Heart } from 'lucide-react'

const Footer = () => {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-auto py-4 px-2 sm:px-4"
    >
      <div className="container mx-auto">
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2 text-gray-600 dark:text-gray-400">
            <span className="text-xs sm:text-sm">Made with</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-blue-500"
            >
              💙
            </motion.div>
            <span className="text-xs sm:text-sm">by</span>
            <span className="text-xs sm:text-sm font-bold text-kaist-blue dark:text-blue-400">Donghyuk</span>
          </div>
        </div>
      </div>
    </motion.footer>
  )
}

export default Footer

