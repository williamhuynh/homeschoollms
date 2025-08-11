import { Center, Box, Image, useColorModeValue } from '@chakra-ui/react'
import { motion } from 'framer-motion'

const MotionBox = motion(Box)

export default function SplashScreen() {
  const backgroundColor = useColorModeValue('#ffffff', '#111111')

  return (
    <Center w="100vw" h="100vh" bg={backgroundColor}>
      <MotionBox
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <Image
          src="/icons/manifest-icon-512.maskable.png"
          alt="HomeschoolLMS"
          boxSize={{ base: '96px', md: '128px' }}
          objectFit="contain"
        />
      </MotionBox>
    </Center>
  )
}