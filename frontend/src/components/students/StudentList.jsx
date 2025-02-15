import { SimpleGrid } from '@chakra-ui/react'
import StudentCard from './StudentCard'

const StudentList = ({ students, onStudentSelect }) => {
  return (
    <SimpleGrid 
      columns={2} 
      spacing={6}
      width="100%"
      justifyItems="center"
      px={4}
    >
      {students.map((student) => (
        <StudentCard
          key={student.id}
          name={student.name}
          imageUrl={student.imageUrl}
          onClick={() => onStudentSelect(student)}
        />
      ))}
    </SimpleGrid>
  )
}

export default StudentList