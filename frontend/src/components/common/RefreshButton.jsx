import { IconButton, Tooltip } from '@chakra-ui/react'
import { Repeat } from 'react-feather'

const RefreshButton = ({ onClick, isLoading, label = 'Refresh' }) => (
  <Tooltip label={label}>
    <span>
      <IconButton
        icon={<Repeat />}
        aria-label={label}
        onClick={onClick}
        isLoading={isLoading}
        isDisabled={isLoading}
        variant="ghost"
      />
    </span>
  </Tooltip>
)

export default RefreshButton