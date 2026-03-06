# SIA - Student Information Analysis System

A comprehensive web-based system for managing student data, conducting exams, and analyzing academic performance built with Next.js and Firebase.

## Features

### 🎓 Student Management
- Import/export student rosters via Excel files
- Bulk student data validation and processing
- Duplicate detection and data quality checks
- Student ID validation and management

### 📝 Exam Management
- Create and configure exams with customizable settings
- Answer key management and validation
- Automated paper scanning and grading
- Multiple choice question analysis

### 📊 Analytics & Reporting
- Comprehensive exam results analysis
- Item analysis and statistics
- Performance reports and insights
- Export capabilities for further analysis

### 👥 Class Management
- Create and manage classes with enrollment limits
- Student roster management per class
- Class-specific exam assignments
- Academic year and semester organization

### 🔐 Authentication & Security
- Secure Firebase authentication
- Google Sign-in integration
- Role-based access control
- Audit logging for all actions

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Styling**: Tailwind CSS
- **UI Components**: Custom component library
- **File Processing**: XLSX for Excel file handling
- **PDF Generation**: Custom PDF reporting system

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project setup

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Cristineddd/Web-Based-for-SIA.git
cd Web-Based-for-SIA-main
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with your Firebase configuration:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── classes/           # Class management pages
│   ├── exams/             # Exam management pages
│   ├── results/           # Results and analytics pages
│   └── dashboard/         # Main dashboard
├── src/
│   ├── components/        # React components
│   │   ├── auth/         # Authentication components
│   │   ├── layout/       # Layout components
│   │   ├── modals/       # Modal dialogs
│   │   ├── pages/        # Page-specific components
│   │   └── ui/           # Reusable UI components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   ├── services/         # Business logic services
│   └── types/            # TypeScript type definitions
├── public/               # Static assets
└── firebase.json         # Firebase configuration
```

## Key Features

### Student Data Management
- **Excel Import**: Support for .xlsx files with validation
- **Data Validation**: Real-time validation with error reporting
- **Duplicate Detection**: Automatic identification of duplicate entries
- **Bulk Operations**: Mass import/export capabilities

### Exam System
- **Flexible Configuration**: Customizable exam settings
- **Answer Key Management**: Easy answer key input and validation
- **Automated Grading**: Quick processing of exam results
- **Performance Analytics**: Detailed statistics and insights

### Responsive Design
- Mobile-friendly interface
- Touch-optimized controls
- Adaptive layouts for all screen sizes

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository.

## Development Status

This project is actively maintained and developed. Current version includes comprehensive student management, exam processing, and analytics capabilities.