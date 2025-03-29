import { SimpleGrid, Text, Center } from '@chakra-ui/react'
import StudentCard from './StudentCard'

const StudentList = ({ students, onStudentSelect }) => {
  // Add check for empty students array
  if (!students || students.length === 0) {
    return (
      <Center p={8}>
        <Text fontSize="lg" color="gray.500">No students found. Add your first student!</Text>
      </Center>
    );
  }

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
          key={student.id || student._id}
          student={student}
          onClick={() => onStudentSelect(student)}
        />
      ))}
    </SimpleGrid>
  )
}

export default StudentList
