export interface CodegenTask {
  id: string;
  description: string;
  techStack: string;
}

export const codegenTasks: CodegenTask[] = [
  {
    id: 'react_express_crud',
    description:
      'Generate code for a small React + Express CRUD app to manage tasks (create, list, update, delete) with a PostgreSQL or SQLite database.',
    techStack: 'react-express-prisma',
  },
  {
    id: 'fastapi_sqlalchemy_crud',
    description:
      'Generate code for a FastAPI + SQLAlchemy CRUD API for managing appointments, with basic validation and database migrations.',
    techStack: 'fastapi-sqlalchemy',
  },
];

