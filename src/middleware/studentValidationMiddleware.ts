import { StudentIDValidationService } from '@/services/studentIDValidationService';

export interface CreateStudentValidationInput {
  student_id: string;
  first_name: string;
  last_name: string;
  grade: string;
  section: string;
}

export interface UpdateStudentValidationInput {
  currentStudentId: string;
  requestedStudentId?: string;
}

export interface CreateStudentValidationResult {
  normalizedStudentId: string;
  normalizedGrade: string;
  normalizedSection: string;
}


 //Middleware validator for student creation
 //Enforces canonical student ID format and full record validation.
 
export async function validateCreateStudentInput(
  input: CreateStudentValidationInput
): Promise<CreateStudentValidationResult> {
  const normalizedStudentId = (input.student_id || '').trim();
  const normalizedGrade = (input.grade || '').trim();
  const normalizedSection = (input.section || '').trim();
  if (!normalizedStudentId) {
    throw new Error('Student ID is required');
  }

  const recordValidation = await StudentIDValidationService.validateStudentRecord(
    normalizedStudentId,
    input.first_name,
    input.last_name,
    normalizedGrade,
    normalizedSection
  );

  if (!recordValidation.isValid) {
    throw new Error(`Validation failed: ${recordValidation.errors.join('; ')}`);
  }

  const idValidation = await StudentIDValidationService.validateStudentId(normalizedStudentId);
  if (!idValidation.isValid) {
    throw new Error(idValidation.error || 'Invalid student ID');
  }

  return {
    normalizedStudentId,
    normalizedGrade,
    normalizedSection,
  };
}


//Middleware validator for student update.
//Keeps student IDs permanent while validating provided IDs for format correctness.
 
export function validateUpdateStudentInput(input: UpdateStudentValidationInput): string {
  const normalizedStudentId = (input.currentStudentId || '').trim();
  if (!normalizedStudentId) {
    throw new Error('Student ID is required');
  }

  if (input.requestedStudentId !== undefined) {
    const requestedId = input.requestedStudentId.trim();
    const formatValidation = StudentIDValidationService.validateStudentIdFormat(requestedId);
    if (!formatValidation.isValid) {
      throw new Error(formatValidation.error || 'Invalid student ID format');
    }

    if (requestedId !== normalizedStudentId) {
      throw new Error('Student ID cannot be changed after creation');
    }
  }

  return normalizedStudentId;
}
