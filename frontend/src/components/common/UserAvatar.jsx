import { Avatar, Box } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'

/**
 * A reusable avatar component that can be linked to the avatar settings page
 * 
 * @param {Object} props Component props
 * @param {Object} props.user User object with name and avatar data
 * @param {string} props.size Avatar size (xs, sm, md, lg, xl, 2xl)
 * @param {Function} props.onClick Optional click handler (defaults to navigation)
 * @param {boolean} props.isClickable Whether the avatar should appear clickable
 */
const UserAvatar = ({ 
  user, 
  size = 'md',
  onClick,
  isClickable = true,
  ...rest
}) => {
  const navigate = useNavigate()
  
  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (isClickable) {
      navigate('/profile/avatar')
    }
  }

  return (
    <Box 
      display="inline-block"
      cursor={isClickable ? 'pointer' : 'default'}
      transition="transform 0.2s"
      _hover={isClickable ? { transform: 'scale(1.05)' } : {}}
      onClick={isClickable ? handleClick : undefined}
      {...rest}
    >
      <Avatar
        size={size}
        name={user ? `${user.first_name} ${user.last_name}` : ''}
        src={user?.avatar_url}
        boxShadow={isClickable ? "0 0 0 2px #63B3ED" : "none"}
      />
    </Box>
  )
}

export default UserAvatar 