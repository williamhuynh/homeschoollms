import { User } from 'react-feather'
import styles from '../../styles/StudentCard.module.css'

const StudentCard = ({ student, onClick }) => {
  const handleClick = () => {
    console.log('Card clicked!', student) // Add this debug log
    if (onClick) {
      onClick(student)
    }
  }

  // Create a display name from first_name and last_name
  const displayName = student ? `${student.first_name} ${student.last_name}` : 'Unknown Student'
  const avatarUrl = student?.avatar_thumbnail_url || student?.avatar_url

  return (
    <div className={styles.card} onClick={handleClick}>
      <div className={styles.imageContainer}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`${displayName} avatar`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div className={styles.placeholder}>
            <User size={32} />
          </div>
        )}
      </div>
      <span className={styles.name}>{displayName}</span>
    </div>
  )
}

export default StudentCard
