/**
 * Student Data Template Documentation
 * Defines expected format and schema for student CSV/Excel imports
 */

export interface StudentDataTemplate {
  student_id?: string; // Optional - auto-generated if not provided
  first_name: string; // Required
  last_name: string; // Required
  email?: string; // Optional
  year: string; // Required - grade level (1-6, A-F, or numeric)
  section: string; // Required - class section (A-J, 1-10)
  block?: string; // Optional - specialization block (STEM, HUMSS, ABM, etc.)
  grade?: string; // Optional - current grade level
}

export const STUDENT_DATA_TEMPLATE_INFO = {
  description: 'Student Data Import Template',
  version: '1.0',
  fileFormats: {
    supported: ['.xlsx', '.xls', '.csv'],
    recommended: '.xlsx',
  },
  fileSizeLimits: {
    maxMB: 10,
    note: 'Maximum 10MB per file',
  },
  columns: {
    student_id: {
      name: 'student_id',
      required: false,
      description: 'Unique student identifier',
      format: 'YYYY-XXXX (e.g., 2026-0001)',
      example: '2026-0001',
      autoGenerate: true,
      note: 'Leave empty to auto-generate IDs in YYYY-XXXX format',
    },
    first_name: {
      name: 'first_name',
      required: true,
      description: 'Student first name',
      format: 'Text, letters only',
      example: 'Juan',
      minLength: 2,
      maxLength: 50,
    },
    last_name: {
      name: 'last_name',
      required: true,
      description: 'Student last name',
      format: 'Text, letters only',
      example: 'Dela Cruz',
      minLength: 2,
      maxLength: 50,
    },
    email: {
      name: 'email',
      required: false,
      description: 'Student email address',
      format: 'Valid email format',
      example: 'juan.delacruz@example.com',
    },
    year: {
      name: 'year',
      required: true,
      description: 'Grade level or year',
      format: 'Numeric or letter (1-6, A-F)',
      validValues: ['1', '2', '3', '4', '5', '6', 'A', 'B', 'C', 'D', 'E', 'F'],
      example: '10',
    },
    section: {
      name: 'section',
      required: true,
      description: 'Class section or block',
      format: 'Letter or number (A-J, 1-10)',
      validValues: [
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
      ],
      example: 'A',
    },
    block: {
      name: 'block',
      required: false,
      description: 'Specialization block or strand',
      format: 'Text',
      validValues: ['STEM', 'HUMSS', 'ABM', 'GA', 'TVL', 'SPORTS', 'ARTS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      example: 'STEM',
    },
    grade: {
      name: 'grade',
      required: false,
      description: 'Current academic grade',
      format: 'Numeric or letter',
      example: '90',
    },
  },
  validationRules: {
    required: ['first_name', 'last_name', 'year', 'section'],
    format: {
      student_id: 'YYYY-XXXX',
      first_name: 'Letters only, 2-50 characters',
      last_name: 'Letters only, 2-50 characters',
      email: 'Valid email format',
      year: 'Must be in valid values list',
      section: 'Must be in valid values list',
    },
    duplicates: {
      check: ['student_id', 'first_name + last_name', 'email'],
      blocking: ['student_id'],
      warning: ['first_name + last_name'],
    },
  },
  exampleData: [
    {
      student_id: '',
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      email: 'juan.delacruz@example.com',
      year: '10',
      section: 'A',
      block: 'STEM',
    },
    {
      student_id: '2026-0001',
      first_name: 'Maria',
      last_name: 'Santos',
      email: 'maria.santos@example.com',
      year: '10',
      section: 'B',
      block: 'HUMSS',
    },
    {
      student_id: '2026-0002',
      first_name: 'Carlos',
      last_name: 'Rodriguez',
      email: 'carlos.rodriguez@example.com',
      year: '11',
      section: 'C',
      block: 'ABM',
    },
  ],
  processingSteps: [
    '1. Prepare CSV or Excel file with student data',
    '2. Use provided template or ensure column headers match',
    '3. Include at least first name, last name, year, and section',
    '4. Leave student_id blank for automatic generation (recommended)',
    '5. Upload file using import button',
    '6. Review preview and fix any validation errors',
    '7. System checks for duplicates and inconsistencies',
    '8. Confirm import to save records',
  ],
  commonErrors: [
    {
      error: 'Missing required fields',
      solution: 'Ensure all rows have: first_name, last_name, year, section',
      severity: 'CRITICAL',
    },
    {
      error: 'Invalid year or section values',
      solution: 'Year must be 1-6 or A-F, Section must be A-J or 1-10',
      severity: 'CRITICAL',
    },
    {
      error: 'Duplicate student IDs',
      solution: 'Ensure each student_id is unique or leave blank for auto-generation',
      severity: 'HIGH',
    },
    {
      error: 'Invalid email format',
      solution: 'Use standard email format: name@domain.com',
      severity: 'MEDIUM',
    },
    {
      error: 'Names with special characters',
      solution: 'First and last names should contain letters only',
      severity: 'MEDIUM',
    },
  ],
};

export class StudentDataTemplateHelper {
  /**
   * Get template documentation as formatted string
   */
  static getDocumentation(): string {
    const { columns } = STUDENT_DATA_TEMPLATE_INFO;

    let doc = '# Student Data Import Template\n\n';

    doc += '## Required Columns\n';
    doc += Object.values(columns)
      .filter((col) => col.required)
      .map((col) => `- **${col.name}**: ${col.description}\n`)
      .join('');

    doc += '\n## Optional Columns\n';
    doc += Object.values(columns)
      .filter((col) => !col.required)
      .map((col) => `- **${col.name}**: ${col.description}\n`)
      .join('');

    doc += '\n## Validation Rules\n';
    doc += '- All rows must have valid data in required columns\n';
    doc += `- Duplicate student IDs are not allowed\n`;
    doc += '- Email addresses must be in valid format\n';

    return doc;
  }

  /**
   * Validate data against template schema
   */
  static validateAgainstTemplate(data: Record<string, any>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const { columns } = STUDENT_DATA_TEMPLATE_INFO;

    // Check required fields
    for (const [key, colInfo] of Object.entries(columns)) {
      if (colInfo.required && !data[key]) {
        errors.push(`Missing required field: ${key}`);
      }
    }

    // Validate name format
    if (data.first_name && !/^[a-zA-Z\s'-]+$/.test(data.first_name)) {
      errors.push('First name contains invalid characters');
    }

    if (data.last_name && !/^[a-zA-Z\s'-]+$/.test(data.last_name)) {
      errors.push('Last name contains invalid characters');
    }

    // Validate email format
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Email is not in valid format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get example CSV content
   */
  static getExampleCSV(): string {
    const { exampleData, columns } = STUDENT_DATA_TEMPLATE_INFO;
    const headers = Object.keys(columns).join(',');
    const rows = exampleData
      .map((row) =>
        Object.keys(columns)
          .map((key) => `"${row[key as keyof typeof row] || ''}"`)
          .join(',')
      )
      .join('\n');

    return `${headers}\n${rows}`;
  }

  /**
   * Get template column information as array
   */
  static getColumnInfo(): Array<{
    name: string;
    required: boolean;
    description: string;
    example?: string;
  }> {
    return Object.values(STUDENT_DATA_TEMPLATE_INFO.columns).map((col) => ({
      name: col.name,
      required: col.required,
      description: col.description,
      example: col.example,
    }));
  }
}
