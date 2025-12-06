import { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  Select,
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Spinner,
  Text,
  Badge
} from '@chakra-ui/react';
import { getStudentParents, updateParentAccess, removeParentAccess } from '../../services/api';

const ParentAccessList = ({ studentId, studentName, onAccessUpdated }) => {
  const [parents, setParents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parentToDelete, setParentToDelete] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const toast = useToast();

  const fetchParents = async () => {
    if (!studentId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      const parentsList = await getStudentParents(studentId);
      setParents(parentsList);
    } catch (error) {
      console.error('Error fetching access list:', error);
      setError('Failed to load access list. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to load access list. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, [studentId, toast]);

  const handleAccessLevelChange = async (parentId, newAccessLevel) => {
    try {
      setIsUpdating(true);
      await updateParentAccess(studentId, parentId, newAccessLevel);
      toast({
        title: 'Access updated',
        description: `Access level changed to ${newAccessLevel}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchParents(); // Refresh the list
      if (onAccessUpdated) onAccessUpdated();
    } catch (error) {
      console.error('Error updating access level:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to update access level. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteDialog = (parent) => {
    setParentToDelete(parent);
    setIsDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setParentToDelete(null);
  };

  const handleRemoveAccess = async () => {
    if (!parentToDelete) return;
    
    try {
      setIsUpdating(true);
      await removeParentAccess(studentId, parentToDelete.parent_id);
      toast({
        title: 'Access removed',
        description: `Access removed for ${parentToDelete.full_name || parentToDelete.email}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      fetchParents(); // Refresh the list
      if (onAccessUpdated) onAccessUpdated();
    } catch (error) {
      console.error('Error removing access:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to remove access',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
      closeDeleteDialog();
    }
  };

  const getAccessLevelBadge = (accessLevel) => {
    const colorScheme = 
      accessLevel === 'admin' ? 'red' : 
      accessLevel === 'content' ? 'blue' : 
      'green';
    
    return (
      <Badge colorScheme={colorScheme} px={2} py={1} borderRadius="md">
        {accessLevel}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Box textAlign="center" py={4}>
        <Spinner size="lg" />
        <Text mt={2}>Loading access list...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box textAlign="center" py={4} color="red.500">
        <Text>{error}</Text>
        <Button mt={2} onClick={fetchParents}>Try Again</Button>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="sm" mb={4}>People with Access to {studentName}</Heading>
      
      {parents.length === 0 ? (
        <Text>No one else has access to this student yet.</Text>
      ) : (
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Access Level</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {parents.map((parent) => (
              <Tr key={parent.parent_id}>
                <Td>{parent.full_name}</Td>
                <Td>{parent.email}</Td>
                <Td>{getAccessLevelBadge(parent.access_level)}</Td>
                <Td>
                  <Select
                    size="sm"
                    value={parent.access_level}
                    onChange={(e) => handleAccessLevelChange(parent.parent_id, e.target.value)}
                    mr={2}
                    width="120px"
                    isDisabled={isUpdating}
                  >
                    <option value="admin">Admin</option>
                    <option value="content">Content</option>
                    <option value="view">View</option>
                  </Select>
                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    onClick={() => openDeleteDialog(parent)}
                    isDisabled={isUpdating}
                    ml={2}
                  >
                    Remove
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Confirmation Dialog for Removing Access */}
      <AlertDialog
        isOpen={isDeleteDialogOpen}
        leastDestructiveRef={undefined}
        onClose={closeDeleteDialog}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Remove Access
            </AlertDialogHeader>

            <AlertDialogBody>
              Remove access for <strong>{parentToDelete?.full_name || parentToDelete?.email}</strong>? 
              They will no longer be able to view or contribute to this student's profile.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button onClick={closeDeleteDialog}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleRemoveAccess} ml={3} isLoading={isUpdating}>
                Remove Access
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
};

export default ParentAccessList;
