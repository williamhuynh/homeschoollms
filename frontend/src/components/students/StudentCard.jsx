import { User } from 'react-feather'
import styles from '../../styles/StudentCard.module.css'

const StudentCard = ({ name, onClick }) => {
  const handleClick = () => {
    console.log('Card clicked!') // Add this debug log
    if (onClick) {
      onClick()
    }
  }

  return (
    <div className={styles.card} onClick={handleClick}>
      <div className={styles.imageContainer}>
        <div className={styles.placeholder}>
          <User size={32} />
        </div>
      </div>
      <span className={styles.name}>{name}</span>
    </div>
  )
}

export default StudentCard